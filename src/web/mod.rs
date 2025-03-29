use serde_json::json;
use thiserror::Error;

use axum::http::StatusCode;
use axum::Json;
use axum::response::{IntoResponse, Response};

use crate::querying::engine::QueryingError;

pub mod app;

type WebAppResult<T> = Result<T, WebAppError>;

#[derive(Debug, Error)]
enum WebAppError {
    #[error("Querying: {0}")]
    Querying(QueryingError)
}

impl IntoResponse for WebAppError {
    fn into_response(self) -> Response {
        match self {
            WebAppError::Querying(err) => {
                with_response_code(
                    Json(
                        json!({
                            "message": err.to_string()
                        })
                    ).into_response(),
                    StatusCode::BAD_REQUEST
                )
            }
        }
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
