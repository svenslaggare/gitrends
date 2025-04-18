use datafusion::dataframe::DataFrame;
use datafusion::common::DataFusionError;

pub fn add_optional_limit(result_df: DataFrame, count: Option<usize>) -> Result<DataFrame, DataFusionError> {
    match count {
        Some(count) => result_df.limit(0, Some(count)),
        None => Ok(result_df)
    }
}