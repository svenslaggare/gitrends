use datafusion::arrow::array::{ArrayRef, AsArray, RecordBatch};
use datafusion::arrow::datatypes::{Float64Type, Int64Type, UInt64Type};
use datafusion::common::DataFusionError;
use datafusion::dataframe::DataFrame;

use crate::indexing::indexer::GitLogEntry;
use crate::querying::model::{Author, FileEntry, FileHistoryEntry, Hotspot, MainDeveloperEntry};
use crate::querying::QueryingResult;

pub fn yield_rows<F: FnMut(&[&ArrayRef], usize)>(results: Vec<RecordBatch>, num_columns: usize, mut callback: F) {
    let mut row_columns = Vec::new();

    for batch in &results {
        row_columns.clear();
        for column_index in 0..num_columns {
            row_columns.push(batch.column(column_index));
        }

        for record_index in 0..batch.column(0).len() {
            callback(&row_columns, record_index);
        }
    }
}

pub fn add_optional_limit(result_df: DataFrame, count: Option<usize>) -> Result<DataFrame, DataFusionError> {
    match count {
        Some(count) => result_df.limit(0, Some(count)),
        None => Ok(result_df)
    }
}

pub trait FromRow {
    const NUM_COLUMNS: usize;
    fn from_row(result_columns: &[&ArrayRef], row_index: usize, base_column_index: usize) -> Self;
}

pub async fn collect_rows<T: FromRow>(result_df: DataFrame) -> QueryingResult<Vec<T>> {
    let mut entries = Vec::new();
    collect_rows_into(result_df, &mut entries).await?;
    Ok(entries)
}

pub async fn collect_rows_into<T: FromRow>(result_df: DataFrame, entries: &mut Vec<T>) -> QueryingResult<()> {
    yield_rows(
        result_df.collect().await?,
        T::NUM_COLUMNS,
        |columns, row_index| {
            entries.push(T::from_row(columns, row_index, 0));
        }
    );

    Ok(())
}

impl FromRow for Author {
    const NUM_COLUMNS: usize = 2;

    fn from_row(columns: &[&ArrayRef], row_index: usize, base_column_index: usize) -> Author {
        Author {
            name: columns[base_column_index].as_string_view().value(row_index).to_owned(),
            num_revisions: columns[base_column_index + 1].as_primitive::<Int64Type>().value(row_index) as u64
        }
    }
}

impl FromRow for GitLogEntry {
    const NUM_COLUMNS: usize = 4;

    fn from_row(columns: &[&ArrayRef], row_index: usize, base_column_index: usize) -> GitLogEntry {
        GitLogEntry {
            revision: columns[base_column_index].as_string_view().value(row_index).to_owned(),
            date: columns[base_column_index + 1].as_primitive::<Int64Type>().value(row_index),
            author: columns[base_column_index + 2].as_string_view().value(row_index).to_owned(),
            commit_message: columns[base_column_index + 3].as_string_view().value(row_index).to_owned()
        }
    }
}

impl FromRow for FileEntry {
    const NUM_COLUMNS: usize = 7;

    fn from_row(columns: &[&ArrayRef], row_index: usize, base_column_index: usize) -> FileEntry {
        FileEntry {
            name: columns[base_column_index].as_string_view().value(row_index).to_owned(),

            num_code_lines: columns[base_column_index + 1].as_primitive::<UInt64Type>().value(row_index),
            num_comment_lines: columns[base_column_index + 2].as_primitive::<UInt64Type>().value(row_index),
            num_blank_lines: columns[base_column_index + 3].as_primitive::<UInt64Type>().value(row_index),

            total_indent_levels: columns[base_column_index + 4].as_primitive::<UInt64Type>().value(row_index),
            avg_indent_levels: columns[base_column_index + 5].as_primitive::<Float64Type>().value(row_index),
            std_indent_levels: columns[base_column_index + 6].as_primitive::<Float64Type>().value(row_index)
        }
    }
}

impl FromRow for FileHistoryEntry {
    const NUM_COLUMNS: usize = 9;

    fn from_row(columns: &[&ArrayRef], row_index: usize, base_column_index: usize) -> FileHistoryEntry {
        FileHistoryEntry {
            name: columns[base_column_index].as_string_view().value(row_index).to_owned(),
            revision: columns[base_column_index + 1].as_string_view().value(row_index).to_owned(),
            date: columns[base_column_index + 2].as_primitive::<Int64Type>().value(row_index),

            num_code_lines: columns[base_column_index + 3].as_primitive::<UInt64Type>().value(row_index),
            num_comment_lines: columns[base_column_index + 4].as_primitive::<UInt64Type>().value(row_index),
            num_blank_lines: columns[base_column_index + 5].as_primitive::<UInt64Type>().value(row_index),

            total_indent_levels: columns[base_column_index + 6].as_primitive::<UInt64Type>().value(row_index),
            avg_indent_levels: columns[base_column_index + 7].as_primitive::<Float64Type>().value(row_index),
            std_indent_level: columns[base_column_index + 8].as_primitive::<Float64Type>().value(row_index)
        }
    }
}

impl FromRow for Hotspot {
    const NUM_COLUMNS: usize = 5;

    fn from_row(columns: &[&ArrayRef], row_index: usize, base_column_index: usize) -> Hotspot {
        Hotspot {
            name: columns[base_column_index].as_string_view().value(row_index).to_owned(),
            num_revisions: columns[base_column_index + 1].as_primitive::<Int64Type>().value(row_index) as u64,
            num_authors: columns[base_column_index + 2].as_primitive::<Int64Type>().value(row_index) as u64,
            num_code_lines: columns[base_column_index + 3].as_primitive::<UInt64Type>().value(row_index),
            total_indent_levels: columns[base_column_index + 4].as_primitive::<UInt64Type>().value(row_index)
        }
    }
}

impl FromRow for MainDeveloperEntry {
    const NUM_COLUMNS: usize = 4;

    fn from_row(columns: &[&ArrayRef], row_index: usize, base_column_index: usize) -> MainDeveloperEntry {
        let name = columns[base_column_index].as_string_view().value(row_index).to_owned();
        let total_net_added_lines = columns[base_column_index + 1].as_primitive::<Int64Type>().value(row_index);
        let main_developer = columns[base_column_index + 2].as_string_view().value(row_index).to_owned();
        let net_added_lines = columns[base_column_index + 3].as_primitive::<Int64Type>().value(row_index);

        MainDeveloperEntry {
            name,
            main_developer,
            net_added_lines,
            total_net_added_lines
        }
    }
}