use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};

use log::warn;

use serde::{Deserialize, Serialize};

use datafusion::arrow::array::{Array, AsArray};
use datafusion::arrow::datatypes::{Int64Type, UInt64Type};
use datafusion::common::ScalarValue;
use datafusion::prelude::*;

use crate::indexing::{GIT_FILE_ENTRIES_PATH, GIT_LOG_PATH};
use crate::indexing::indexer::GitLogEntry;
use crate::querying::{custom_functions, QueryingResult};
use crate::querying::model_data_extraction::{collect_rows, collect_rows_into, yield_rows, FromRow};
use crate::querying::model::{ChangeCouplingEntry, CommitSpreadEntry, CustomAnalysis, CustomValue, FileEntry, FileHistoryEntry, HotspotEntry, MainDeveloperEntry, Module, RepositorySummary, SumOfCouplingEntry};
use crate::querying::querying_helpers::add_optional_limit;

#[derive(Clone, Deserialize, Serialize)]
pub struct RepositoryQueryingConfig {
    pub min_date: Option<i64>,
    pub max_date: Option<i64>
}

impl Default for RepositoryQueryingConfig {
    fn default() -> Self {
        RepositoryQueryingConfig {
            min_date: None,
            max_date: None
        }
    }
}

pub struct RepositoryQuerying {
    pub data_directory: PathBuf,
    pub ctx: SessionContext
}

impl RepositoryQuerying {
    pub async fn new(data_directory: &Path, config: RepositoryQueryingConfig) -> QueryingResult<RepositoryQuerying> {
        let ctx = SessionContext::new();

        ctx.register_parquet(
            "raw_git_log",
            data_directory.join(GIT_LOG_PATH).to_str().unwrap(),
            ParquetReadOptions::default()
        ).await?;

        ctx.register_parquet(
            "all_git_file_entries",
            data_directory.join(GIT_FILE_ENTRIES_PATH).to_str().unwrap(),
            ParquetReadOptions::default()
        ).await?;

        custom_functions::add(data_directory, &ctx)?;

        ctx.sql(
            r#"
            CREATE VIEW git_log AS
            SELECT
                revision,
                date,
                normalize_author(author) AS author,
                commit_message
            FROM raw_git_log
            "#
        ).await?;

        ctx.sql(
            &format!(
                r#"
                CREATE VIEW git_file_entries AS
                SELECT
                    *
                FROM all_git_file_entries
                WHERE
                    exists_at_head AND NOT is_ignored(file_name) AND date >= {} AND date <= {}
                "#,
                config.min_date.unwrap_or(0),
                config.max_date.unwrap_or(i64::MAX)
            )
        ).await?;

        ctx.sql(
            r#"
            CREATE VIEW git_module_entries AS
            SELECT
                revision,
                module_name,
                date,
                COUNT(*) AS num_changed_files
            FROM (
                SELECT
                    revision,
                    extract_module_name(file_name) AS module_name,
                    date
                FROM git_file_entries
            )
            GROUP BY revision, module_name, date
            ORDER BY date
        "#
        ).await?;

        ctx.sql(
            r#"
            CREATE VIEW num_module_revisions AS
            SELECT
                extract_module_name(file_name) AS module_name,
                COUNT(DISTINCT git_file_entries.revision) AS num_revisions,
                COUNT(DISTINCT git_log.author) AS num_authors
            FROM git_file_entries
            INNER JOIN git_log ON git_log.revision = git_file_entries.revision
            GROUP BY extract_module_name(file_name)
            "#
        ).await?;

        ctx.sql(
            r#"
            CREATE VIEW latest_revision_file_entries AS
            SELECT
                file_name,

                LAST_VALUE(num_code_lines ORDER BY date) AS num_code_lines,
                LAST_VALUE(num_comment_lines ORDER BY date) AS num_comment_lines,
                LAST_VALUE(num_blank_lines ORDER BY date) AS num_blank_lines,

                LAST_VALUE(total_indent_levels ORDER BY date) AS total_indent_levels,
                LAST_VALUE(avg_indent_levels ORDER BY date) AS avg_indent_levels,
                LAST_VALUE(std_indent_levels ORDER BY date) AS std_indent_levels
            FROM git_file_entries
            GROUP BY file_name
            "#
        ).await?;

        ctx.sql(
            r#"
            CREATE VIEW latest_revision_module_entries AS
            SELECT
                extract_module_name(file_name) AS module_name,

                SUM(num_code_lines) AS num_code_lines,
                SUM(num_comment_lines) AS num_comment_lines,
                SUM(num_blank_lines) AS num_blank_lines,

                SUM(total_indent_levels) AS total_indent_levels,
                SUM(total_indent_levels)::double / SUM(num_code_lines)::double AS avg_indent_levels
            FROM latest_revision_file_entries
            GROUP BY extract_module_name(file_name)
        "#
        ).await?;

        ctx.sql(
            r#"
            CREATE VIEW file_hotspots AS
            SELECT
                file_name,

                COUNT(git_file_entries.revision) AS num_revisions,
                COUNT(DISTINCT author) AS num_authors,

                LAST_VALUE(num_code_lines ORDER BY git_file_entries.date) AS num_code_lines,
                LAST_VALUE(num_comment_lines ORDER BY git_file_entries.date) AS num_comment_lines,
                LAST_VALUE(num_blank_lines ORDER BY git_file_entries.date) AS num_blank_lines,

                LAST_VALUE(total_indent_levels ORDER BY git_file_entries.date) AS total_indent_levels,
                LAST_VALUE(avg_indent_levels ORDER BY git_file_entries.date) AS avg_indent_levels,
                LAST_VALUE(std_indent_levels ORDER BY git_file_entries.date) AS std_indent_levels
            FROM git_file_entries
            INNER JOIN git_log ON git_log.revision = git_file_entries.revision
            GROUP BY file_name
            "#
        ).await?;

        ctx.sql(
            r#"
            CREATE VIEW module_hotspots AS
            SELECT
                latest_revision_module_entries.module_name,

                num_module_revisions.num_revisions,
                num_module_revisions.num_authors,

                num_code_lines,
                num_comment_lines,
                num_blank_lines,

                total_indent_levels,
                avg_indent_levels
            FROM latest_revision_module_entries
            INNER JOIN num_module_revisions
                ON num_module_revisions.module_name = latest_revision_module_entries.module_name
            "#
        ).await?;

        ctx.sql(
            r#"
            CREATE VIEW file_coupled_revisions AS
            SELECT
                 left_entries.revision AS revision,
                 left_entries.file_name AS left_file_name,
                 right_entries.file_name AS right_file_name
            FROM git_file_entries left_entries, git_file_entries right_entries
            WHERE
                left_entries.revision = right_entries.revision
                AND left_entries.file_name != right_entries.file_name
            "#
        ).await?;

        ctx.sql(
            r#"
            CREATE VIEW module_coupled_revisions AS
            SELECT
                 left_entries.revision AS revision,
                 left_entries.module_name AS left_module_name,
                 right_entries.module_name AS right_module_name
            FROM git_module_entries left_entries, git_module_entries right_entries
            WHERE
                left_entries.revision = right_entries.revision
                AND left_entries.module_name != right_entries.module_name
            "#
        ).await?;

        ctx.sql(
            r#"
            CREATE VIEW file_sum_of_couplings AS
            SELECT
                left_file_name AS file_name,
                COUNT(revision, right_file_name) AS sum_of_couplings
            FROM file_coupled_revisions
            GROUP BY left_file_name
            "#
        ).await?;

        ctx.sql(
            r#"
            CREATE VIEW module_sum_of_couplings AS
            SELECT
                left_module_name AS file_name,
                COUNT(revision, right_module_name) AS sum_of_couplings
            FROM module_coupled_revisions
            GROUP BY left_module_name
            "#
        ).await?;

        ctx.sql(
            r#"
            CREATE VIEW file_developers AS
            SELECT
                file_name,
                author,
                SUM(GREATEST(added_lines - removed_lines, 0)) AS net_added_lines
            FROM git_file_entries
            INNER JOIN
                git_log ON git_log.revision = git_file_entries.revision
            GROUP BY file_name, author
            "#
        ).await?;

        ctx.sql(
            r#"
            CREATE VIEW module_developers AS
            SELECT
                extract_module_name(file_name) AS module_name,
                author,
                SUM(net_added_lines) AS net_added_lines
            FROM file_developers
            GROUP BY extract_module_name(file_name), author
            "#
        ).await?;

        Ok(RepositoryQuerying { data_directory: data_directory.to_owned(), ctx })
    }

    pub async fn summary(&self) -> QueryingResult<RepositorySummary> {
        let mut result = RepositorySummary {
            data_directory: self.data_directory
                .components()
                .last()
                .map(|x| x.as_os_str().to_str()).flatten()
                .unwrap_or("N/A").to_owned(),

            num_revisions: 0,
            first_commit: None,
            last_commit: None,

            num_code_lines: 0,
            num_comment_lines: 0,
            num_files: 0,
            num_modules: 0,

            top_authors: Vec::new(),

            top_code_files: Vec::new(),
            last_changed_files: Vec::new()
        };

        let result_df = self.ctx.sql("SELECT COUNT(*) FROM git_log").await?;
        yield_rows(
            result_df.collect().await?,
            1,
            |columns, row_index| {
                result.num_revisions = columns[0].as_primitive::<Int64Type>().value(row_index) as u64;
            }
        );

        let result_df = self.ctx.sql(
            r#"
            SELECT
                FIRST_VALUE(revision ORDER BY date) AS first_revision,
                FIRST_VALUE(date ORDER BY date) AS first_date,
                FIRST_VALUE(author ORDER BY date) AS first_author,
                FIRST_VALUE(commit_message ORDER BY date) AS first_commit_message,

                LAST_VALUE(revision ORDER BY date) AS last_revision,
                LAST_VALUE(date ORDER BY date) AS last_date,
                LAST_VALUE(author ORDER BY date) AS last_author,
                LAST_VALUE(commit_message ORDER BY date) AS lastcommit_message
            FROM git_log
            "#
        ).await?;

        yield_rows(
            result_df.collect().await?,
            8,
            |columns, row_index| {
                result.first_commit = Some(GitLogEntry::from_row(columns, row_index, 0));
                result.last_commit = Some(GitLogEntry::from_row(columns, row_index, 4));
            }
        );

        let result_df = self.ctx.sql(
            r#"
            SELECT
                COUNT(file_name) AS num_files,
                COUNT(DISTINCT extract_module_name(file_name)) AS num_modules,
                SUM(num_code_lines) AS num_code_lines,
                SUM(num_comment_lines) AS num_comment_lines
            FROM latest_revision_file_entries
            "#
        ).await?;

        yield_rows(
            result_df.collect().await?,
            4,
            |columns, row_index| {
                result.num_files = columns[0].as_primitive::<Int64Type>().value(row_index) as u64;
                result.num_modules = columns[1].as_primitive::<Int64Type>().value(row_index) as u64;
                result.num_code_lines = columns[2].as_primitive::<UInt64Type>().value(row_index);
                result.num_comment_lines = columns[3].as_primitive::<UInt64Type>().value(row_index);
            }
        );

        let result_df = self.ctx.sql(
            r#"
            SELECT
                author AS name,
                COUNT(*) AS num_revisions
            FROM git_log
            GROUP BY author
            ORDER BY num_revisions DESC LIMIT 10
            "#
        ).await?;
        collect_rows_into(result_df, &mut result.top_authors).await?;

        let result_df = self.ctx
            .sql(
                r#"
                SELECT
                    file_name,
                    revision,
                    date,

                    num_code_lines,
                    num_comment_lines,
                    num_blank_lines,

                    total_indent_levels,
                    avg_indent_levels,
                    std_indent_levels
                FROM all_git_file_entries
                ORDER BY date DESC LIMIT 10;
                "#
            )
            .await?;
        collect_rows_into::<FileHistoryEntry>(result_df, &mut result.last_changed_files).await?;

        let result_df = self.ctx
            .sql(
                r#"
                SELECT
                    file_name,

                    num_code_lines,
                    num_comment_lines,
                    num_blank_lines,

                    total_indent_levels,
                    avg_indent_levels,
                    std_indent_levels
                FROM latest_revision_file_entries
                ORDER BY num_code_lines DESC LIMIT 10;
                "#
            )
            .await?;
        collect_rows_into::<FileEntry>(result_df, &mut result.top_code_files).await?;

        Ok(result)
    }

    pub async fn log(&self) -> QueryingResult<Vec<GitLogEntry>> {
        let result_df = self.ctx.sql(
            r#"
            SELECT
                revision, date, author, commit_message
            FROM git_log
            ORDER BY date;
            "#
        ).await?;

        collect_rows::<GitLogEntry>(result_df).await
    }

    pub async fn files(&self) -> QueryingResult<Vec<FileEntry>> {
        let result_df = self.ctx.sql(
            r#"
            SELECT
                file_name,

                num_code_lines,
                num_comment_lines,
                num_blank_lines,

                total_indent_levels,
                avg_indent_levels,
                std_indent_levels
            FROM latest_revision_file_entries
            ORDER BY num_code_lines DESC
            "#
        ).await?;

        collect_rows::<FileEntry>(result_df).await
    }

    pub async fn modules(&self) -> QueryingResult<Vec<Module>> {
        let result_df = self.ctx.sql(
            r#"
            SELECT
                extract_module_name(file_name) as module_name,

                file_name,

                num_code_lines,
                num_comment_lines,
                num_blank_lines,

                total_indent_levels,
                avg_indent_levels,
                std_indent_levels
            FROM latest_revision_file_entries
            ORDER BY num_code_lines DESC
            "#
        ).await?;

        let mut modules = BTreeMap::new();
        yield_rows(
            result_df.collect().await?,
            8,
            |columns, row_index| {
                let module_name = columns[0].as_string_view().value(row_index).to_owned();
                modules.entry(module_name.clone())
                    .or_insert_with(|| Module { name: module_name, files: Vec::new() })
                    .files
                    .push(FileEntry::from_row(columns, row_index, 1))
            }
        );

        Ok(modules.into_values().collect())
    }

    pub async fn module_files(&self, name: &str) -> QueryingResult<Vec<FileEntry>> {
        let result_df = self.ctx
            .sql(
                r#"
                SELECT
                    *
                FROM latest_revision_file_entries
                WHERE extract_module_name(file_name) = $1
                ORDER BY num_code_lines DESC
                "#
            )
            .await?
            .with_param_values(vec![ScalarValue::Utf8(Some(name.to_owned()))])?;

        collect_rows::<FileEntry>(result_df).await
    }

    pub async fn file_hotspots(&self, count: Option<usize>) -> QueryingResult<Vec<HotspotEntry>> {
        let result_df = self.ctx.sql(
            r#"
            SELECT
                *
            FROM file_hotspots
            ORDER BY num_revisions DESC;
            "#
        ).await?;

        let result_df = add_optional_limit(result_df, count)?;

        collect_rows::<HotspotEntry>(result_df).await
    }

    pub async fn module_hotspots(&self, count: Option<usize>) -> QueryingResult<Vec<HotspotEntry>> {
        let result_df = self.ctx.sql(
            r#"
            SELECT
                *
            FROM module_hotspots
            ORDER BY num_revisions DESC;
            "#
        ).await?;

        let result_df = add_optional_limit(result_df, count)?;

        collect_rows::<HotspotEntry>(result_df).await
    }

    pub async fn file_change_couplings(&self, count: Option<usize>) -> QueryingResult<Vec<ChangeCouplingEntry>> {
        let result_df = self.ctx.sql(
            r#"
            SELECT
                left_file_name,
                right_file_name,
                COUNT(revision) AS coupled_revisions
            FROM (
                SELECT
                    *
                FROM file_coupled_revisions
                WHERE left_file_name < right_file_name
            )
            GROUP BY left_file_name, right_file_name
            ORDER BY coupled_revisions DESC
            "#
        ).await?;

        let result_df = add_optional_limit(result_df, count)?;

        self.create_change_coupling_results(
            result_df,
            &self.get_num_file_revisions().await?
        ).await
    }

    pub async fn change_couplings_for_file(&self, file_name: &str, count: Option<usize>) -> QueryingResult<Vec<ChangeCouplingEntry>> {
        let result_df = self.ctx
            .sql(
                r#"
                SELECT
                    left_file_name,
                    right_file_name,
                    COUNT(revision) AS coupled_revisions
                FROM (
                    SELECT
                        *
                    FROM file_coupled_revisions
                    WHERE left_file_name = $1
                )
                GROUP BY left_file_name, right_file_name
                ORDER BY coupled_revisions DESC, right_file_name DESC
                "#
            )
            .await?
            .with_param_values(vec![ScalarValue::Utf8(Some(file_name.to_owned()))])?;

        let result_df = add_optional_limit(result_df, count)?;

        self.create_change_coupling_results(
            result_df,
            &self.get_num_file_revisions().await?
        ).await
    }

    pub async fn module_change_couplings(&self, count: Option<usize>) -> QueryingResult<Vec<ChangeCouplingEntry>> {
        let result_df = self.ctx.sql(
            r#"
            SELECT
                left_module_name,
                right_module_name,
                COUNT(revision) AS coupled_revisions
            FROM (
                SELECT
                     *
                FROM module_coupled_revisions
                WHERE left_module_name < right_module_name
            )
            GROUP BY left_module_name, right_module_name
            ORDER BY coupled_revisions DESC
            "#
        ).await?;

        let result_df = add_optional_limit(result_df, count)?;

        self.create_change_coupling_results(
            result_df,
            &self.get_num_module_revisions().await?
        ).await
    }

    pub async fn change_couplings_for_module(&self, module_name: &str, count: Option<usize>) -> QueryingResult<Vec<ChangeCouplingEntry>> {
        let result_df = self.ctx
            .sql(
                r#"
                SELECT
                    left_module_name,
                    right_module_name,
                    COUNT(revision) AS coupled_revisions
                FROM (
                    SELECT
                         *
                    FROM module_coupled_revisions
                    WHERE left_module_name = $1
                )
                GROUP BY left_module_name, right_module_name
                ORDER BY coupled_revisions DESC
                "#
            )
            .await?
            .with_param_values(vec![ScalarValue::Utf8(Some(module_name.to_owned()))])?;

        let result_df = add_optional_limit(result_df, count)?;

        self.create_change_coupling_results(
            result_df,
            &self.get_num_module_revisions().await?
        ).await
    }
    
    async fn create_change_coupling_results(
        &self,
        result_df: DataFrame,
        num_revisions: &HashMap<String, u64>
    ) -> QueryingResult<Vec<ChangeCouplingEntry>> {
        let mut change_couplings = Vec::new();
        yield_rows(
            result_df.collect().await?,
            3,
            |columns, row_index| {
                let left_name = columns[0].as_string_view().value(row_index).to_owned();
                let right_name = columns[1].as_string_view().value(row_index).to_owned();

                change_couplings.push(
                    ChangeCouplingEntry {
                        left_name: left_name.clone(),
                        right_name: right_name.clone(),
                        coupled_revisions: columns[2].as_primitive::<Int64Type>().value(row_index) as u64,
                        num_left_revisions: num_revisions.get(&left_name).unwrap().clone(),
                        num_right_revisions: num_revisions.get(&right_name).unwrap().clone()
                    }
                );
            }
        );

        Ok(change_couplings)
    }

    pub async fn file_sum_of_couplings(&self, count: Option<usize>) -> QueryingResult<Vec<SumOfCouplingEntry>> {
        let result_df = self.ctx.sql(
            r#"
            SELECT
                *
            FROM file_sum_of_couplings
            ORDER BY sum_of_couplings DESC
            "#
        ).await?;

        let result_df = add_optional_limit(result_df, count)?;

        collect_rows::<SumOfCouplingEntry>(result_df).await
    }

    pub async fn module_sum_of_couplings(&self, count: Option<usize>) -> QueryingResult<Vec<SumOfCouplingEntry>> {
        let result_df = self.ctx.sql(
            r#"
            SELECT
                *
            FROM module_sum_of_couplings
            ORDER BY sum_of_couplings DESC
            "#
        ).await?;

        let result_df = add_optional_limit(result_df, count)?;

        collect_rows::<SumOfCouplingEntry>(result_df).await
    }

    pub async fn file_history(&self, file_name: &str) -> QueryingResult<Vec<FileHistoryEntry>> {
        let result_df = self.ctx
            .sql(
                r#"
                SELECT
                    file_name,
                    revision,
                    date,

                    num_code_lines,
                    num_comment_lines,
                    num_blank_lines,

                    total_indent_levels,
                    avg_indent_levels,
                    std_indent_levels
                FROM git_file_entries
                WHERE file_name = $1
                ORDER BY date ASC;
                "#
            )
            .await?
            .with_param_values(vec![ScalarValue::Utf8(Some(file_name.to_owned()))])?;

        collect_rows::<FileHistoryEntry>(result_df).await
    }

    pub async fn files_main_developer(&self) -> QueryingResult<Vec<MainDeveloperEntry>> {
        let result_df = self.ctx
            .sql(
                r#"
                SELECT
                    file_name,
                    SUM(net_added_lines) AS total_net_added_lines,
                    LAST_VALUE(author ORDER BY net_added_lines, author) AS main_developer,
                    LAST_VALUE(net_added_lines ORDER BY net_added_lines, author) AS main_developer_net_added_lines
                FROM file_developers
                GROUP BY file_name
                ORDER BY ratio(main_developer_net_added_lines, total_net_added_lines) DESC, total_net_added_lines DESC
                "#
            )
            .await?;

        collect_rows::<MainDeveloperEntry>(result_df).await
    }

    pub async fn modules_main_developer(&self) -> QueryingResult<Vec<MainDeveloperEntry>> {
        let result_df = self.ctx
            .sql(
                r#"
                SELECT
                    module_name,
                    SUM(net_added_lines) AS total_net_added_lines,
                    LAST_VALUE(author ORDER BY net_added_lines, author) AS main_developer,
                    LAST_VALUE(net_added_lines ORDER BY net_added_lines, author) AS main_developer_net_added_lines
                FROM module_developers
                GROUP BY module_name
                ORDER BY ratio(main_developer_net_added_lines, total_net_added_lines) DESC, total_net_added_lines DESC
                "#
            )
            .await?;

        collect_rows::<MainDeveloperEntry>(result_df).await
    }

    pub async fn commit_spread(&self) -> QueryingResult<Vec<CommitSpreadEntry>> {
        let result_df = self.ctx
            .sql(
                r#"
                SELECT
                    module_name,
                    author,
                    COUNT(git_module_entries.revision) AS num_revisions
                FROM git_module_entries
                INNER JOIN git_log ON git_log.revision = git_module_entries.revision
                GROUP BY module_name, author
                ORDER BY module_name, num_revisions DESC
                "#
            )
            .await?;

        collect_rows::<CommitSpreadEntry>(result_df).await
    }

    pub async fn custom_analysis(&self, sql: &str) -> QueryingResult<CustomAnalysis> {
        let result_df = self.ctx.sql(sql).await?;

        let mut columns = Vec::new();
        let mut rows = Vec::new();
        let mut has_definition = false;

        for batch in result_df.collect().await? {
            for record_index in 0..batch.column(0).len() {
                let mut row = Vec::new();

                for (column_index, column_def) in batch.schema().fields().iter().enumerate() {
                    let column = batch.column(column_index);

                    if let Some(value) = CustomValue::from_column(column_def, column, record_index) {
                        row.push(value);

                        if !has_definition {
                            columns.push(column_def.name().to_owned());
                        }
                    } else {
                        warn!("Unsupported type '{}'", column.data_type())
                    }
                }

                has_definition = true;
                rows.push(row);
            }
        }

        Ok(
            CustomAnalysis {
                columns,
                rows
            }
        )
    }

    async fn get_num_file_revisions(&self) -> QueryingResult<HashMap<String, u64>> {
        let result_df = self.ctx.sql(
            r#"
            SELECT
                file_name,
                COUNT(revision) AS num_revisions
            FROM git_file_entries
            GROUP BY file_name
            "#
        ).await?;

        self.create_num_revisions_results(result_df).await
    }

    async fn get_num_module_revisions(&self) -> QueryingResult<HashMap<String, u64>> {
        let result_df = self.ctx.sql(r#"SELECT * FROM num_module_revisions"#).await?;
        self.create_num_revisions_results(result_df).await
    }

    async fn create_num_revisions_results(&self, result_df: DataFrame) -> QueryingResult<HashMap<String, u64>> {
        let mut num_revisions_results = HashMap::new();
        yield_rows(
            result_df.collect().await?,
            2,
            |columns, row_index| {
                let file_name = columns[0].as_string_view().value(row_index).to_owned();
                let num_revisions = columns[1].as_primitive::<Int64Type>().value(row_index) as u64;
                num_revisions_results.insert(file_name, num_revisions);
            }
        );

        Ok(num_revisions_results)
    }
}