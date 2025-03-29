use std::collections::HashMap;
use std::net::{SocketAddr};
use std::str::FromStr;
use std::sync::Arc;

use chrono::Local;

use serde::Deserialize;

use axum::response::{Html, IntoResponse, Response};
use axum::{Json, Router};
use axum::routing::get;
use axum::extract::{Path, Query, State};

use askama::Template;
use tokio::net::TcpListener;
use tower_http::services::ServeDir;

use crate::indexing::indexer;
use crate::querying::engine::{RepositoryQuerying};
use crate::web::WebAppResult;

#[derive(Deserialize)]
pub struct WebAppConfig {
    pub source_dir: std::path::PathBuf,
    pub data_dir: std::path::PathBuf,
    pub listen: Option<SocketAddr>
}

pub async fn main(config: WebAppConfig) {
    indexer::try_index_repository(&config.source_dir, &config.data_dir).unwrap();

    let state = Arc::new(
        WebAppState {
            repository_querying: RepositoryQuerying::new(&config.data_dir).await.unwrap(),
        }
    );

    let app = Router::new()
        .nest_service("/content", ServeDir::new("frontend/static"))
        .route("/", get(index))
        .route("/{*path}", get(index))

        .route("/api/file/hotspots", get(get_file_hotspots))
        .route("/api/file/change-coupling", get(get_file_change_coupling))
        .route("/api/file/history/{*file_name}", get(get_file_history))

        .route("/api/module/hotspots", get(get_module_hotspots))
        .route("/api/module/change-coupling", get(get_module_change_coupling))

        .with_state(state.clone())
        ;

    let address = config.listen.unwrap_or_else(|| SocketAddr::from_str("127.0.0.1:9000").unwrap());
    let listener = TcpListener::bind(&address).await.unwrap();
    println!("Listening on http://{}", address);

    axum::serve(listener, app).await.unwrap();
}

struct WebAppState {
    repository_querying: RepositoryQuerying
}

async fn index() -> Response {
    let template = AppTemplate {
        time: Local::now().timestamp()
    };

    Html(template.render().unwrap()).into_response()
}

async fn get_file_hotspots(
    State(state): State<Arc<WebAppState>>,
    Query(query): Query<HashMap<String, String>>
) -> WebAppResult<impl IntoResponse> {
    let count = query.get("count").map(|x| usize::from_str(x).ok()).flatten();
    Ok(Json(state.repository_querying.hotspots(count.or(Some(100))).await?))
}

async fn get_file_change_coupling(
    State(state): State<Arc<WebAppState>>,
    Query(query): Query<HashMap<String, String>>
) -> WebAppResult<impl IntoResponse> {
    let file_name = query.get("name");
    let count = query.get("count").map(|x| usize::from_str(x).ok()).flatten();

    match file_name {
        Some(file_name) => {
            Ok(Json(state.repository_querying.change_couplings_for_file(file_name, count).await?))
        }
        None => {
            Ok(Json(state.repository_querying.change_couplings(count.or(Some(100))).await?))
        }
    }
}

async fn get_file_history(
    State(state): State<Arc<WebAppState>>,
    Path(file_name): Path<String>
) -> WebAppResult<impl IntoResponse> {
    Ok(Json(state.repository_querying.file_history(&file_name).await?))
}

async fn get_module_hotspots(
    State(state): State<Arc<WebAppState>>,
    Query(query): Query<HashMap<String, String>>
) -> WebAppResult<impl IntoResponse> {
    let count = query.get("count").map(|x| usize::from_str(x).ok()).flatten();
    Ok(Json(state.repository_querying.module_hotspots(count.or(Some(100))).await?))
}

async fn get_module_change_coupling(
    State(state): State<Arc<WebAppState>>,
    Query(query): Query<HashMap<String, String>>
) -> WebAppResult<impl IntoResponse> {
    let module_name = query.get("name");
    let count = query.get("count").map(|x| usize::from_str(x).ok()).flatten();

    match module_name {
        Some(module_name) => {
            Ok(Json(state.repository_querying.change_couplings_for_module(module_name, count).await?))
        }
        None => {
            Ok(Json(state.repository_querying.module_change_couplings(count.or(Some(100))).await?))
        }
    }
}

#[derive(Template)]
#[template(path="gitrends.html")]
struct AppTemplate {
    time: i64
}