use std::collections::HashSet;
use std::fs::{File};
use std::path::Path;

use chrono::{DateTime, FixedOffset, TimeZone, Utc};
use thiserror::Error;

use git2::{Commit, ObjectType, Oid, Repository, TreeWalkMode, TreeWalkResult};

use parquet::errors::ParquetError;
use parquet::file::properties::{WriterProperties, WriterPropertiesPtr};
use parquet::file::writer::SerializedFileWriter;
use parquet::record::RecordWriter;
use parquet_derive::{ParquetRecordWriter};

use crate::indexing::source_code_analysis::calculate_source_code_stats;

#[derive(Default, Debug, ParquetRecordWriter)]
pub struct GitLogEntry {
    pub revision: String,
    pub date: i64,
    pub author: String,
    pub commit_message: String
}

#[derive(Default, Debug, ParquetRecordWriter)]
pub struct GitFileEntry {
    pub revision: String,
    pub file_name: String,
    pub date: i64,
    pub exists_at_head: bool,

    pub num_code_lines: u64,
    pub num_comment_lines: u64,
    pub num_blank_lines: u64,

    pub total_indent_levels: u64,
    pub avg_indent_levels: f64,
    pub std_indent_level: f64
}

pub fn try_index_repository(repository: &Path, output_directory: &Path) -> Result<(), IndexError> {
    if !(output_directory.join("git_log.parquet").exists() && output_directory.join("git_file_entries.parquet").exists()) {
        index_repository(repository, output_directory)
    } else {
        Ok(())
    }
}

pub fn index_repository(repository: &Path, output_directory: &Path) -> Result<(), IndexError> {
    println!("Indexing repository...");
    if !output_directory.exists() {
        std::fs::create_dir_all(output_directory)?;
    }

    let repository = Repository::open(repository)?;

    let mut git_log_writer = SerializedFileWriter::new(
        File::create(output_directory.join("git_log.parquet"))?,
        vec![GitLogEntry::default()].as_slice().schema()?,
        WriterPropertiesPtr::new(WriterProperties::default())
    )?;

    let mut git_entries_writer = SerializedFileWriter::new(
        File::create(output_directory.join("git_file_entries.parquet"))?,
        vec![GitFileEntry::default()].as_slice().schema()?,
        WriterPropertiesPtr::new(WriterProperties::default())
    )?;

    let mut head_files = HashSet::new();
    repository.head()?.peel_to_tree()?.walk(
        TreeWalkMode::PreOrder,
        |parent, entry| {
            if entry.kind() == Some(ObjectType::Blob) {
                head_files.insert(format!("{}{}", parent, entry.name().unwrap()));
            }

            TreeWalkResult::Ok
        }
    )?;

    let mut rev_walk = repository.revwalk()?;
    rev_walk.push_head()?;

    let mut ignore_commits = HashSet::<Oid>::new();
    let mut indexed_files = HashSet::new();
    while let Some(commit_id) = rev_walk.next() {
        let commit_id = commit_id?;
        let commit = repository.find_commit(commit_id)?;

        add_log_entry(&mut git_log_writer, &commit)?;

        if ignore_commits.remove(&commit.id()) {
            continue;
        }

        if commit.parent_count() == 0 {
            index_commit(
                &repository,
                &head_files,
                &mut indexed_files,
                &commit, None,
                &mut git_entries_writer
            )?;
        } else {
            for parent in commit.parents() {
                index_commit(
                    &repository,
                    &head_files,
                    &mut indexed_files,
                    &commit, Some(&parent),
                    &mut git_entries_writer
                )?;

                if commit.parent_count() >= 2 {
                    ignore_commits.insert(parent.id());
                }
            }
        }
    }

    git_log_writer.close()?;
    git_entries_writer.close()?;

    Ok(())
}

fn add_log_entry(git_log_writer: &mut SerializedFileWriter<File>, commit: &Commit) -> Result<(), IndexError> {
    let short_commit_hash = commit.as_object().short_id()?.as_str().unwrap().to_owned();
    let commit_time = commit.time().to_date_time().unwrap();

    // let parents_str = commit
    //     .parents()
    //     .map(|parent| parent.as_object().short_id().unwrap().as_str().unwrap().to_owned())
    //     .collect::<Vec<_>>()
    //     .join(", ");

    // const DATETIME_FORMAT: &str = "%Y-%m-%d %H:%M:%S";
    // println!(
    //     "{} ({}) ({}): {}",
    //     short_commit_hash,
    //     parents_str,
    //     commit_time.format(DATETIME_FORMAT),
    //     commit.message().unwrap_or("").trim().replace("\n", " ")
    // );

    let mut row_group = git_log_writer.next_row_group()?;
    vec![
        GitLogEntry {
            revision: short_commit_hash.clone(),
            date: commit_time.timestamp(),
            author: commit.author().name().unwrap_or("unknown").to_string(),
            commit_message: commit.message().unwrap_or("unknown").to_string(),
        }
    ].as_slice().write_to_row_group(&mut row_group)?;
    row_group.close()?;

    Ok(())
}

fn index_commit(
    repository: &Repository,
    head_files: &HashSet<String>,
    indexed_files: &mut HashSet<(String, String)>,
    commit: &Commit, parent: Option<&Commit>,
    git_entries_writer: &mut SerializedFileWriter<File>
) -> Result<(), IndexError> {
    let short_commit_hash = commit.as_object().short_id()?.as_str().unwrap().to_owned();
    let commit_time = commit.time().to_date_time().unwrap();
    let commit_tree = commit.tree();

    let parent_tree = parent.as_ref().map(|c| c.tree().ok()).flatten();

    let diff = repository.diff_tree_to_tree(
        parent_tree.as_ref(),
        commit_tree.as_ref().ok(),
        None
    )?;

    let mut git_file_entries = Vec::new();

    for delta in diff.deltas() {
        let file_path = delta.new_file().path().unwrap();
        let file_path_str = file_path.to_str().unwrap().to_owned();
        let file_entry = commit_tree.as_ref().unwrap().get_path(file_path).ok();

        let index_key = (short_commit_hash.clone(), file_path_str.clone());
        if indexed_files.contains(&index_key) {
            continue;
        }

        // println!(
        //     "\t{} ({:?})",
        //     file_path.display(),
        //     delta.status()
        // );

        let file_entry = file_entry.map(|entry| entry.to_object(&repository).ok()).flatten();
        let content = file_entry.as_ref()
            .map(|entry| entry.as_blob()).flatten()
            .map(|blob| std::str::from_utf8(blob.content()).ok())
            .flatten();

        let file_extension = file_path.extension().map(|x| x.to_str()).flatten().unwrap_or("unknown");
        let source_code_stats = content.map(|content| calculate_source_code_stats(file_extension, content));

        // println!("\t\t{:?}", source_code_stats);

        if let Some(source_stats) = source_code_stats {
            indexed_files.insert(index_key);

            git_file_entries.push(
                GitFileEntry {
                    revision: short_commit_hash.clone(),
                    file_name: file_path_str.clone(),
                    date: commit_time.timestamp(),
                    exists_at_head: head_files.contains(&file_path_str),

                    num_code_lines: source_stats.num_code_lines,
                    num_comment_lines: source_stats.num_comment_lines,
                    num_blank_lines: source_stats.num_blank_lines,

                    total_indent_levels: source_stats.total_indent_levels,
                    avg_indent_levels: source_stats.avg_indent_levels,
                    std_indent_level: source_stats.std_indent_level
                }
            );
        }
    }

    let mut row_group = git_entries_writer.next_row_group()?;
    git_file_entries.as_slice().write_to_row_group(&mut row_group)?;
    row_group.close()?;

    Ok(())
}

#[derive(Error, Debug)]
pub enum IndexError {
    #[error("Git: {0}")]
    Git(git2::Error),
    #[error("I/O: {0}")]
    IO(std::io::Error),
    #[error("Parquet: {0}")]
    Parquet(ParquetError),
}

impl From<git2::Error> for IndexError {
    fn from(err: git2::Error) -> Self {
        IndexError::Git(err)
    }
}

impl From<std::io::Error> for IndexError {
    fn from(err: std::io::Error) -> Self {
        IndexError::IO(err)
    }
}

impl From<ParquetError> for IndexError {
    fn from(err: ParquetError) -> Self {
        IndexError::Parquet(err)
    }
}

pub trait ToChronoDateTime {
    fn to_date_time(&self) -> Option<DateTime<FixedOffset>>;
}

impl ToChronoDateTime for git2::Time {
    fn to_date_time(&self) -> Option<DateTime<FixedOffset>> {
        let timezone = FixedOffset::east_opt(self.offset_minutes() * 60).unwrap();
        let time = DateTime::<Utc>::from_timestamp(self.seconds(), 0)?.naive_utc();
        Some(timezone.from_utc_datetime(&time))
    }
}