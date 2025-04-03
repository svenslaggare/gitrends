use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;

use thiserror::Error;
use serde::{Deserialize, Serialize};

use datafusion::arrow::array::{Array, ArrayRef, AsArray, BooleanArray, RecordBatch, StringViewArray};
use datafusion::arrow::datatypes::{DataType, Float64Type, Int64Type, UInt64Type};
use datafusion::common::cast::as_string_array;
use datafusion::common::ScalarValue;
use datafusion::error::DataFusionError;
use datafusion::logical_expr::{ColumnarValue, Volatility};
use datafusion::prelude::*;

use crate::indexing::indexer::GitLogEntry;
use crate::querying::extras::{IgnoreFile, ModuleDefinitionError, ModuleDefinitions};
use crate::querying::model::{ChangeCoupling, FileHistoryEntry, Hotspot};

#[derive(Debug, Error)]
pub enum QueryingError {
    #[error("DataFusion: {0}")]
    DataFusion(DataFusionError),
    #[error("Module definition: {0}")]
    ModuleDefinition(ModuleDefinitionError),
}

impl From<DataFusionError> for QueryingError {
    fn from(err: DataFusionError) -> Self {
        QueryingError::DataFusion(err)
    }
}

impl From<ModuleDefinitionError> for QueryingError {
    fn from(err: ModuleDefinitionError) -> Self {
        QueryingError::ModuleDefinition(err)
    }
}

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
    pub ctx: SessionContext
}

impl RepositoryQuerying {
    pub async fn new(data_directory: &Path, config: RepositoryQueryingConfig) -> Result<RepositoryQuerying, QueryingError> {
        let ctx = SessionContext::new();

        ctx.register_parquet(
            "git_log",
            data_directory.join("git_log.parquet").to_str().unwrap(),
            ParquetReadOptions::default()
        ).await?;

        ctx.register_parquet(
            "all_git_entries",
            data_directory.join("git_file_entries.parquet").to_str().unwrap(),
            ParquetReadOptions::default()
        ).await?;

        let ignore_file = match std::fs::read_to_string(data_directory.join("ignore.txt")) {
            Ok(definition) => IgnoreFile::new(&definition),
            _ => IgnoreFile::empty()
        };

        let is_ignored = create_udf(
            "is_ignored",
            vec![DataType::Utf8],
            DataType::Boolean,
            Volatility::Immutable,
            Arc::new(move |args: &[ColumnarValue]| {
                let args = ColumnarValue::values_to_arrays(args)?;
                let file_name = as_string_array(&args[0]).expect("cast failed");

                let array = file_name
                    .iter()
                    .map(|file_name| {
                        file_name.map(|file_name| {
                            ignore_file.is_ignored(file_name)
                        })
                    })
                    .collect::<BooleanArray>();

                Ok(ColumnarValue::from(Arc::new(array) as ArrayRef))
            })
        );
        ctx.register_udf(is_ignored.clone());

        let module_definitions = match std::fs::read_to_string(data_directory.join("modules.txt")) {
            Ok(definition) => ModuleDefinitions::new(&definition)?,
            _ => ModuleDefinitions::empty()
        };

        let extract_module_name = create_udf(
            "extract_module_name",
            vec![DataType::Utf8],
            DataType::Utf8View,
            Volatility::Immutable,
            Arc::new(move |args: &[ColumnarValue]| {
                let args = ColumnarValue::values_to_arrays(args)?;
                let file_name = as_string_array(&args[0]).expect("cast failed");

                let array = file_name
                    .iter()
                    .map(|file_name| {
                        file_name.map(|file_name| {
                            if let Some(module_name) = module_definitions.get_module(file_name) {
                                return module_name.to_owned();
                            }

                            if let Some(parent) = Path::new(file_name).parent() {
                                let parent = parent.to_str().unwrap().to_owned();
                                if !parent.is_empty() {
                                    parent
                                } else {
                                    "<root>".to_owned()
                                }
                            } else {
                                file_name.to_owned()
                            }
                        })
                    })
                    .collect::<StringViewArray>();

                Ok(ColumnarValue::from(Arc::new(array) as ArrayRef))
            })
        );
        ctx.register_udf(extract_module_name.clone());

        ctx.sql(
            &format!(
                r#"
                CREATE VIEW git_file_entries AS
                SELECT
                    *
                FROM all_git_entries
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
                COUNT(DISTINCT revision) AS num_revisions
            FROM git_file_entries
            GROUP BY extract_module_name(file_name)
            "#
        ).await?;

        ctx.sql(
            r#"
            CREATE VIEW latest_revision_file_entries AS
            SELECT
                file_name,
                last_value(num_code_lines ORDER BY date) AS num_code_lines,
                last_value(total_indent_levels ORDER BY date) AS total_indent_levels
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
                SUM(total_indent_levels) AS total_indent_levels
            FROM latest_revision_file_entries
            GROUP BY extract_module_name(file_name)
        "#
        ).await?;

        ctx.sql(
            r#"
            CREATE VIEW hotspots AS
            SELECT
                file_name,
                COUNT(revision) AS num_revisions,
                last_value(num_code_lines ORDER BY date) AS num_code_lines,
                last_value(total_indent_levels ORDER BY date) AS total_indent_levels
            FROM git_file_entries
            GROUP BY file_name
            "#
        ).await?;

        ctx.sql(
            r#"
            CREATE VIEW module_hotspots AS
            SELECT
                latest_revision_module_entries.module_name,
                num_module_revisions.num_revisions,
                num_code_lines,
                total_indent_levels
            FROM latest_revision_module_entries
            INNER JOIN
                num_module_revisions
                ON num_module_revisions.module_name = latest_revision_module_entries.module_name
            ORDER BY num_code_lines DESC
            "#
        ).await?;

        Ok(RepositoryQuerying { ctx })
    }

    pub async fn log(&self) -> Result<Vec<GitLogEntry>, QueryingError> {
        let result_df = self.ctx.sql(
            r#"
            SELECT
                revision, date, author, commit_message
            FROM git_log
            ORDER BY date;
            "#
        ).await?;

        let mut entries = Vec::new();
        yield_rows(
            result_df.collect().await?,
            4,
            |columns, row_index| {
                entries.push(
                    GitLogEntry {
                        revision: columns[0].as_string_view().value(row_index).to_owned(),
                        date: columns[1].as_primitive::<Int64Type>().value(row_index),
                        author: columns[2].as_string_view().value(row_index).to_owned(),
                        commit_message: columns[3].as_string_view().value(row_index).to_owned(),
                    }
                );
            }
        );

        Ok(entries)
    }

    pub async fn hotspots(&self, count: Option<usize>) -> Result<Vec<Hotspot>, QueryingError> {
        let result_df = self.ctx.sql(
            r#"
            SELECT
                *
            FROM hotspots
            ORDER BY num_revisions DESC;
            "#
        ).await?;

        let result_df = add_optional_limit(result_df, count)?;

        self.create_hotspots_results(result_df).await
    }

    pub async fn module_hotspots(&self, count: Option<usize>) -> Result<Vec<Hotspot>, QueryingError> {
        let result_df = self.ctx.sql(
            r#"
            SELECT
                *
            FROM module_hotspots
            ORDER BY num_revisions DESC;
            "#
        ).await?;

        let result_df = add_optional_limit(result_df, count)?;

        self.create_hotspots_results(result_df).await
    }

    async fn create_hotspots_results(&self, result_df: DataFrame) -> Result<Vec<Hotspot>, QueryingError> {
        let mut hotspots = Vec::new();
        yield_rows(
            result_df.collect().await?,
            4,
            |columns, row_index| {
                hotspots.push(
                    Hotspot {
                        name: columns[0].as_string_view().value(row_index).to_owned(),
                        num_revisions: columns[1].as_primitive::<Int64Type>().value(row_index) as u64,
                        num_code_lines: columns[2].as_primitive::<UInt64Type>().value(row_index),
                        total_indent_levels: columns[3].as_primitive::<UInt64Type>().value(row_index)
                    }
                );
            }
        );

        Ok(hotspots)
    }

    pub async fn change_couplings(&self, count: Option<usize>) -> Result<Vec<ChangeCoupling>, QueryingError> {
        let result_df = self.ctx.sql(
            r#"
            SELECT
                left_file_name,
                right_file_name,
                COUNT(revision) AS coupled_revisions
            FROM (
                SELECT
                     left_entries.revision AS revision,
                     left_entries.file_name AS left_file_name,
                     right_entries.file_name AS right_file_name
                FROM git_file_entries left_entries, git_file_entries right_entries
                WHERE
                    left_entries.revision = right_entries.revision
                    AND left_entries.file_name != right_entries.file_name
                    AND left_entries.file_name < right_entries.file_name
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

    pub async fn change_couplings_for_file(&self, file_name: &str, count: Option<usize>) -> Result<Vec<ChangeCoupling>, QueryingError> {
        let result_df = self.ctx
            .sql(
                r#"
                SELECT
                    left_file_name,
                    right_file_name,
                    COUNT(revision) AS coupled_revisions
                FROM (
                    SELECT
                         left_entries.revision AS revision,
                         left_entries.file_name AS left_file_name,
                         right_entries.file_name AS right_file_name
                    FROM git_file_entries left_entries, git_file_entries right_entries
                    WHERE
                        left_entries.revision = right_entries.revision
                        AND left_entries.file_name != right_entries.file_name
                        AND left_entries.file_name = $1
                )
                GROUP BY left_file_name, right_file_name
                ORDER BY coupled_revisions DESC
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

    pub async fn module_change_couplings(&self, count: Option<usize>) -> Result<Vec<ChangeCoupling>, QueryingError> {
        let result_df = self.ctx.sql(
            r#"
            SELECT
                left_module_name,
                right_module_name,
                COUNT(revision) AS coupled_revisions
            FROM (
                SELECT
                     left_entries.revision AS revision,
                     left_entries.module_name AS left_module_name,
                     right_entries.module_name AS right_module_name
                FROM git_module_entries left_entries, git_module_entries right_entries
                WHERE
                    left_entries.revision = right_entries.revision
                    AND left_entries.module_name != right_entries.module_name
                    AND left_entries.module_name < right_entries.module_name
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

    pub async fn change_couplings_for_module(&self, module_name: &str, count: Option<usize>) -> Result<Vec<ChangeCoupling>, QueryingError> {
        let result_df = self.ctx
            .sql(
                r#"
                SELECT
                    left_module_name,
                    right_module_name,
                    COUNT(revision) AS coupled_revisions
                FROM (
                    SELECT
                         left_entries.revision AS revision,
                         left_entries.module_name AS left_module_name,
                         right_entries.module_name AS right_module_name
                    FROM git_module_entries left_entries, git_module_entries right_entries
                    WHERE
                        left_entries.revision = right_entries.revision
                        AND left_entries.module_name != right_entries.module_name
                        AND left_entries.module_name = $1
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
    ) -> Result<Vec<ChangeCoupling>, QueryingError> {
        let mut change_couplings = Vec::new();
        yield_rows(
            result_df.collect().await?,
            3,
            |columns, row_index| {
                let left_name = columns[0].as_string_view().value(row_index).to_owned();
                let right_name = columns[1].as_string_view().value(row_index).to_owned();

                change_couplings.push(
                    ChangeCoupling {
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

    pub async fn file_history(&self, file_name: &str) -> Result<Vec<FileHistoryEntry>, QueryingError> {
        let result_df = self.ctx
            .sql(
                r#"
                SELECT
                    revision,
                    date,

                    num_code_lines,
                    num_comment_lines,
                    num_blank_lines,

                    total_indent_levels,
                    avg_indent_levels,
                    std_indent_level
                FROM git_file_entries
                WHERE file_name = $1
                ORDER BY date ASC;
                "#
            )
            .await?
            .with_param_values(vec![ScalarValue::Utf8(Some(file_name.to_owned()))])?;

        let mut entries = Vec::new();
        yield_rows(
            result_df.collect().await?,
            8,
            |columns, row_index| {
                entries.push(
                    FileHistoryEntry {
                        revision: columns[0].as_string_view().value(row_index).to_owned(),
                        date: columns[1].as_primitive::<Int64Type>().value(row_index),

                        num_code_lines: columns[2].as_primitive::<UInt64Type>().value(row_index),
                        num_comment_lines: columns[3].as_primitive::<UInt64Type>().value(row_index),
                        num_blank_lines: columns[4].as_primitive::<UInt64Type>().value(row_index),

                        total_indent_levels: columns[5].as_primitive::<UInt64Type>().value(row_index),
                        avg_indent_levels: columns[6].as_primitive::<Float64Type>().value(row_index),
                        std_indent_level: columns[7].as_primitive::<Float64Type>().value(row_index)
                    }
                );
            }
        );

        Ok(entries)
    }

    async fn get_num_file_revisions(&self) -> Result<HashMap<String, u64>, QueryingError> {
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

    async fn get_num_module_revisions(&self) -> Result<HashMap<String, u64>, QueryingError> {
        let result_df = self.ctx.sql(r#"SELECT * FROM num_module_revisions"#).await?;
        self.create_num_revisions_results(result_df).await
    }

    async fn create_num_revisions_results(&self, result_df: DataFrame) -> Result<HashMap<String, u64>, QueryingError> {
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

fn yield_rows<F: FnMut(&[&ArrayRef], usize)>(results: Vec<RecordBatch>, num_columns: usize, mut callback: F) {
    let mut row_columns = Vec::new();

    for row in &results {
        row_columns.clear();
        for column_index in 0..num_columns {
            row_columns.push(row.column(column_index));
        }

        for record_index in 0..row.column(0).len() {
            callback(&row_columns, record_index);
        }
    }
}

fn add_optional_limit(result_df: DataFrame, count: Option<usize>) -> Result<DataFrame, DataFusionError> {
    match count {
        Some(count) => result_df.limit(0, Some(count)),
        None => Ok(result_df)
    }
}