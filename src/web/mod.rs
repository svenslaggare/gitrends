use serde_json::json;
use thiserror::Error;

use axum::http::StatusCode;
use axum::Json;
use axum::response::{IntoResponse, Response};

use crate::indexing::indexer::IndexError;
use crate::querying::QueryingError;

pub mod app;

type WebAppResult<T> = Result<T, WebAppError>;

#[derive(Debug, Error)]
enum WebAppError {
    #[error("Failed to persist state due to: {0}")]
    PersistState(std::io::Error),
    #[error("Indexing: {0}")]
    Indexing(IndexError),
    #[error("Querying: {0}")]
    Querying(QueryingError)
}

impl IntoResponse for WebAppError {
    fn into_response(self) -> Response {
        match self {
            WebAppError::PersistState(err) => {
                with_response_code(
                    Json(
                        json!({
                            "success": false,
                            "message": err.to_string()
                        })
                    ).into_response(),
                    StatusCode::INTERNAL_SERVER_ERROR
                )
            }
            WebAppError::Indexing(err) => {
                with_response_code(
                    Json(
                        json!({
                            "success": false,
                            "message": err.to_string()
                        })
                    ).into_response(),
                    StatusCode::INTERNAL_SERVER_ERROR
                )
            }
            WebAppError::Querying(err) => {
                with_response_code(
                    Json(
                        json!({
                            "success": false,
                            "message": err.to_string()
                        })
                    ).into_response(),
                    StatusCode::BAD_REQUEST
                )
            }
        }
    }
}

impl From<IndexError> for WebAppError {
    fn from(err: IndexError) -> Self {
        WebAppError::Indexing(err)
    }
}

impl From<QueryingError> for WebAppError {
    fn from(err: QueryingError) -> Self {
        WebAppError::Querying(err)
    }
}

fn with_response_code(mut response: Response, code: StatusCode) -> Response {
    *response.status_mut() = code;
    response
}
