use datafusion::common::DataFusionError;
use thiserror::Error;

pub mod engine;
pub mod model;
pub mod extras;
pub mod printing;
pub mod custom_functions;

use crate::querying::extras::ModuleDefinitionError;

type QueryingResult<T> = Result<T, QueryingError>;

#[derive(Debug, Error)]
pub enum QueryingError {
    #[error("DataFusion: {0}")]
    DataFusion(DataFusionError),
    #[error("Module definition: {0}")]
    ModuleDefinition(ModuleDefinitionError)
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