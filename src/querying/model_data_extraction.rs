use datafusion::arrow::array::{ArrayRef, ArrowPrimitiveType, AsArray, RecordBatch};
use datafusion::arrow::datatypes::*;
use datafusion::dataframe::DataFrame;

use crate::indexing::indexer::GitLogEntry;
use crate::querying::model::*;
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

impl FromRow for HotspotEntry {
    const NUM_COLUMNS: usize = 8;

    fn from_row(columns: &[&ArrayRef], row_index: usize, base_column_index: usize) -> HotspotEntry {
        HotspotEntry {
            name: columns[base_column_index].as_string_view().value(row_index).to_owned(),
            num_revisions: columns[base_column_index + 1].as_primitive::<Int64Type>().value(row_index) as u64,
            num_authors: columns[base_column_index + 2].as_primitive::<Int64Type>().value(row_index) as u64,

            num_code_lines: columns[base_column_index + 3].as_primitive::<UInt64Type>().value(row_index),
            num_comment_lines: columns[base_column_index + 4].as_primitive::<UInt64Type>().value(row_index),
            num_blank_lines: columns[base_column_index + 5].as_primitive::<UInt64Type>().value(row_index),

            total_indent_levels: columns[base_column_index + 6].as_primitive::<UInt64Type>().value(row_index),
            avg_indent_levels: columns[base_column_index + 7].as_primitive::<Float64Type>().value(row_index)
        }
    }
}

impl FromRow for SumOfCouplingEntry {
    const NUM_COLUMNS: usize = 2;

    fn from_row(columns: &[&ArrayRef], row_index: usize, base_column_index: usize) -> SumOfCouplingEntry {
        SumOfCouplingEntry {
            name: columns[base_column_index].as_string_view().value(row_index).to_owned(),
            sum_of_couplings: columns[base_column_index + 1].as_primitive::<Int64Type>().value(row_index) as u64
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

impl FromRow for CommitSpreadEntry {
    const NUM_COLUMNS: usize = 3;

    fn from_row(columns: &[&ArrayRef], row_index: usize, base_column_index: usize) -> CommitSpreadEntry {
        let module_name = columns[base_column_index].as_string_view().value(row_index).to_owned();
        let author = columns[base_column_index + 1].as_string_view().value(row_index).to_owned();
        let num_revisions = columns[base_column_index + 2].as_primitive::<Int64Type>().value(row_index) as u64;

        CommitSpreadEntry {
            module_name,
            author,
            num_revisions
        }
    }
}

impl CustomValue {
    pub fn from_column(column_def: &FieldRef, column: &ArrayRef, record_index: usize) -> Option<CustomValue> {
        fn extract_primitive<T: ArrowPrimitiveType<Native = U>, U>(column: &ArrayRef, record_index: usize) -> Option<U> {
            if column.is_valid(record_index) {
                Some(column.as_primitive::<T>().value(record_index))
            } else {
                None
            }
        }

        match column_def.data_type() {
            DataType::Utf8 => {
                if column.is_valid(record_index) {
                    Some(CustomValue::String(Some(column.as_string_view().value(record_index).to_owned())))
                } else {
                    Some(CustomValue::String(None))
                }
            }
            DataType::Utf8View => {
                if column.is_valid(record_index) {
                    Some(CustomValue::String(Some(column.as_string_view().value(record_index).to_owned())))
                } else {
                    Some(CustomValue::String(None))
                }
            }
            DataType::Int8 => {
                Some(CustomValue::Int8(extract_primitive::<Int8Type, _>(column, record_index)))
            }
            DataType::Int32 => {
                Some(CustomValue::Int32(extract_primitive::<Int32Type, _>(column, record_index)))
            }
            DataType::Int64 => {
                Some(CustomValue::Int64(extract_primitive::<Int64Type, _>(column, record_index)))
            }
            DataType::UInt8 => {
                Some(CustomValue::UInt8(extract_primitive::<UInt8Type, _>(column, record_index)))
            }
            DataType::UInt32 => {
                Some(CustomValue::UInt32(extract_primitive::<UInt32Type, _>(column, record_index)))
            }
            DataType::UInt64 => {
                Some(CustomValue::UInt64(extract_primitive::<UInt64Type, _>(column, record_index)))
            }
            DataType::Boolean => {
                if column.is_valid(record_index) {
                    Some(CustomValue::Bool(Some(column.as_boolean().value(record_index))))
                } else {
                    Some(CustomValue::Bool(None))
                }
            }
            DataType::Float32 => {
                Some(CustomValue::Float32(extract_primitive::<Float32Type, f32>(column, record_index)))
            }
            DataType::Float64 => {
                Some(CustomValue::Float64(extract_primitive::<Float64Type, f64>(column, record_index)))
            }
            _ => {
                None
            }
        }
    }
}
