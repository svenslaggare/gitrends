use std::collections::HashMap;
use std::net::{SocketAddr};
use std::str::FromStr;
use std::sync::Arc;

use arc_swap::ArcSwap;
use chrono::Local;

use serde::{Deserialize, Serialize};

use axum::response::{Html, IntoResponse, Response};
use axum::{Json, Router};
use axum::routing::{get, put};
use axum::extract::{Path, Query, State};

use askama::Template;
use serde_json::json;
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tokio::task::spawn_blocking;
use tower_http::services::ServeDir;

use crate::indexing::indexer;
use crate::querying::engine::{RepositoryQuerying, RepositoryQueryingConfig};
use crate::querying::model::{ChangeCouplingTree, HotspotTree, MainDeveloperTree};
use crate::web::{WebAppError, WebAppResult};

#[derive(Clone, Deserialize)]
pub struct WebAppConfig {
    pub source_dir: std::path::PathBuf,
    pub data_dir: std::path::PathBuf,
    pub listen: Option<SocketAddr>
}

pub async fn main(config: WebAppConfig) {
    indexer::try_index_repository(&config.source_dir, &config.data_dir).unwrap();
    let persistent_state = PersistentWebAppState::load_from_file(&config.data_dir.join("state.json"))
        .unwrap_or_default();

    let repository_querying = RepositoryQuerying::new(
        &config.data_dir,
        persistent_state.querying_config.clone()
    ).await.unwrap();

    let state = Arc::new(
        WebAppState {
            config: config.clone(),
            persistent_state: Mutex::new(persistent_state),
            repository_querying: ArcSwap::from(Arc::new(repository_querying))
        }
    );

    let app = Router::new()
        .nest_service("/content", ServeDir::new("frontend/static"))
        .route("/", get(index))
        .route("/{*path}", get(index))

        .route("/api/state/reload", put(reload_data))
        .route("/api/state/reindex", put(reindex_data))

        .route("/api/state/valid-date", get(get_valid_date))
        .route("/api/state/valid-date", put(set_valid_date))

        .route("/api/summary", get(get_summary))

        .route("/api/git/log", get(get_git_log))

        .route("/api/file", get(get_files))
        .route("/api/file/hotspots", get(get_file_hotspots))
        .route("/api/file/hotspots-structure", get(get_file_hotspots_structure))
        .route("/api/file/change-coupling", get(get_file_change_coupling))
        .route("/api/file/change-coupling-structure", get(get_file_change_coupling_structure))
        .route("/api/file/history/{*file_name}", get(get_file_history))
        .route("/api/file/main-developer", get(get_files_main_developer))
        .route("/api/file/main-developer-structure", get(get_files_main_developer_structure))

        .route("/api/module", get(get_modules))
        .route("/api/module/hotspots", get(get_module_hotspots))
        .route("/api/module/change-coupling", get(get_module_change_coupling))
        .route("/api/module/change-coupling-structure", get(get_module_change_coupling_structure))
        .route("/api/module/main-developer", get(get_modules_main_developer))

        .with_state(state.clone())
        ;

    let address = config.listen.unwrap_or_else(|| SocketAddr::from_str("127.0.0.1:9000").unwrap());
    let listener = TcpListener::bind(&address).await.unwrap();
    println!("Listening on http://{}", address);

    axum::serve(listener, app).await.unwrap();
}

struct WebAppState {
    config: WebAppConfig,
    persistent_state: Mutex<PersistentWebAppState>,
    repository_querying: ArcSwap<RepositoryQuerying>
}

impl WebAppState {
    pub async fn recreate_repository_querying(&self, persistent_state: &PersistentWebAppState) -> WebAppResult<()> {
        self.repository_querying.store(Arc::new(
            RepositoryQuerying::new(
                &self.config.data_dir,
                persistent_state.querying_config.clone()
            ).await?
        ));

        Ok(())
    }
}

#[derive(Clone, Deserialize, Serialize)]
pub struct PersistentWebAppState {
    querying_config: RepositoryQueryingConfig
}

impl Default for PersistentWebAppState {
    fn default() -> Self {
        PersistentWebAppState {
            querying_config: RepositoryQueryingConfig::default()
        }
    }
}

impl PersistentWebAppState {
    pub fn load_from_file(path: &std::path::Path) -> Option<PersistentWebAppState> {
        std::fs::read_to_string(path).ok()
            .map(|state| serde_json::from_str::<PersistentWebAppState>(&state).ok())
            .flatten()
    }

    pub fn save_to_file(&self, path: &std::path::Path) -> std::io::Result<()> {
        let json = serde_json::to_string(&self)?;
        std::fs::write(path, json)?;
        Ok(())
    }
}

async fn index() -> Response {
    let template = AppTemplate {
        time: Local::now().timestamp()
    };

    Html(template.render().unwrap()).into_response()
}

async fn reload_data(
    State(state): State<Arc<WebAppState>>
)  -> WebAppResult<impl IntoResponse> {
    let persistent_state = state.persistent_state.lock().await;
    state.recreate_repository_querying(&persistent_state).await?;

    Ok(Json(json!({ "success": true })))
}

async fn reindex_data(
    State(state): State<Arc<WebAppState>>
)  -> WebAppResult<impl IntoResponse> {
    let state_clone = state.clone();
    spawn_blocking(move || {
        indexer::index_repository(&state_clone.config.source_dir, &state_clone.config.data_dir)
    }).await.unwrap()?;

    let persistent_state = state.persistent_state.lock().await;
    state.recreate_repository_querying(&persistent_state).await?;

    Ok(Json(json!({ "success": true })))
}

#[derive(Serialize, Deserialize)]
struct ValidDate {
    min_date: Option<i64>,
    max_date: Option<i64>
}

async fn get_valid_date(
    State(state): State<Arc<WebAppState>>
)  -> WebAppResult<impl IntoResponse> {
    let persistent_state = state.persistent_state.lock().await;

    Ok(
        Json(
            ValidDate {
                min_date: persistent_state.querying_config.min_date,
                max_date: persistent_state.querying_config.max_date
            }
        )
    )
}

async fn set_valid_date(
    State(state): State<Arc<WebAppState>>,
    Json(input): Json<ValidDate>
)  -> WebAppResult<impl IntoResponse> {
    let mut persistent_state = state.persistent_state.lock().await;

    persistent_state.querying_config.min_date = input.min_date;
    persistent_state.querying_config.max_date = input.max_date;
    persistent_state.save_to_file(&state.config.data_dir.join("state.json"))
        .map_err(|err| WebAppError::PersistState(err))?;

    state.recreate_repository_querying(&persistent_state).await?;

    Ok(Json(json!({ "success": true })))
}

async fn get_summary(
    State(state): State<Arc<WebAppState>>
) -> WebAppResult<impl IntoResponse> {
    let repository_querying = state.repository_querying.load();

    Ok(Json(repository_querying.summary().await?))
}

async fn get_git_log(
    State(state): State<Arc<WebAppState>>
) -> WebAppResult<impl IntoResponse> {
    let repository_querying = state.repository_querying.load();

    Ok(Json(repository_querying.log().await?))
}

async fn get_files(
    State(state): State<Arc<WebAppState>>
) -> WebAppResult<impl IntoResponse> {
    let repository_querying = state.repository_querying.load();

    Ok(Json(repository_querying.files().await?))
}

async fn get_file_hotspots(
    State(state): State<Arc<WebAppState>>,
    Query(query): Query<HashMap<String, String>>
) -> WebAppResult<impl IntoResponse> {
    let repository_querying = state.repository_querying.load();

    let count = query.get("count").map(|x| usize::from_str(x).ok()).flatten();
    Ok(Json(repository_querying.file_hotspots(count.or(Some(100))).await?))
}

async fn get_file_hotspots_structure(
    State(state): State<Arc<WebAppState>>
) -> WebAppResult<impl IntoResponse> {
    let repository_querying = state.repository_querying.load();

    let hotspots = repository_querying.file_hotspots(None).await?;
    let hotspot_tree = HotspotTree::from_vec(&hotspots);
    Ok(Json(hotspot_tree))
}

async fn get_file_change_coupling(
    State(state): State<Arc<WebAppState>>,
    Query(query): Query<HashMap<String, String>>
) -> WebAppResult<impl IntoResponse> {
    let repository_querying = state.repository_querying.load();

    let file_name = query.get("name");
    let count = query.get("count").map(|x| usize::from_str(x).ok()).flatten();

    match file_name {
        Some(file_name) => {
            Ok(Json(repository_querying.change_couplings_for_file(file_name, count).await?))
        }
        None => {
            Ok(Json(repository_querying.file_change_couplings(count.or(Some(100))).await?))
        }
    }
}

async fn get_file_change_coupling_structure(
    State(state): State<Arc<WebAppState>>
) -> WebAppResult<impl IntoResponse> {
    let repository_querying = state.repository_querying.load();

    let change_couplings = repository_querying.file_change_couplings(None).await?;
    let change_coupling_tree = ChangeCouplingTree::from_vec(&change_couplings, true, 15, 0.2);
    Ok(Json(change_coupling_tree))
}

async fn get_file_history(
    State(state): State<Arc<WebAppState>>,
    Path(file_name): Path<String>
) -> WebAppResult<impl IntoResponse> {
    let repository_querying = state.repository_querying.load();

    Ok(Json(repository_querying.file_history(&file_name).await?))
}

async fn get_files_main_developer(
    State(state): State<Arc<WebAppState>>
) -> WebAppResult<impl IntoResponse> {
    let repository_querying = state.repository_querying.load();

    Ok(Json(repository_querying.files_main_developer().await?))
}

async fn get_files_main_developer_structure(
    State(state): State<Arc<WebAppState>>
) -> WebAppResult<impl IntoResponse> {
    let repository_querying = state.repository_querying.load();

    let main_developer_entries = repository_querying.files_main_developer().await?;
    let main_developer_tree = MainDeveloperTree::from_vec(&main_developer_entries);
    Ok(Json(main_developer_tree))
}

async fn get_modules(
    State(state): State<Arc<WebAppState>>
) -> WebAppResult<impl IntoResponse> {
    let repository_querying = state.repository_querying.load();

    Ok(Json(repository_querying.modules().await?))
}

async fn get_module_hotspots(
    State(state): State<Arc<WebAppState>>,
    Query(query): Query<HashMap<String, String>>
) -> WebAppResult<impl IntoResponse> {
    let repository_querying = state.repository_querying.load();

    let count = query.get("count").map(|x| usize::from_str(x).ok()).flatten();
    Ok(Json(repository_querying.module_hotspots(count.or(Some(100))).await?))
}

async fn get_module_change_coupling(
    State(state): State<Arc<WebAppState>>,
    Query(query): Query<HashMap<String, String>>
) -> WebAppResult<impl IntoResponse> {
    let repository_querying = state.repository_querying.load();

    let module_name = query.get("name");
    let count = query.get("count").map(|x| usize::from_str(x).ok()).flatten();

    match module_name {
        Some(module_name) => {
            Ok(Json(repository_querying.change_couplings_for_module(module_name, count).await?))
        }
        None => {
            Ok(Json(repository_querying.module_change_couplings(count.or(Some(100))).await?))
        }
    }
}

async fn get_module_change_coupling_structure(
    State(state): State<Arc<WebAppState>>
) -> WebAppResult<impl IntoResponse> {
    let repository_querying = state.repository_querying.load();

    let change_couplings = repository_querying.module_change_couplings(None).await?;
    let change_coupling_tree = ChangeCouplingTree::from_vec(&change_couplings, false, 15, 0.2);
    Ok(Json(change_coupling_tree))
}

async fn get_modules_main_developer(
    State(state): State<Arc<WebAppState>>
) -> WebAppResult<impl IntoResponse> {
    let repository_querying = state.repository_querying.load();

    Ok(Json(repository_querying.modules_main_developer().await?))
}

#[derive(Template)]
#[template(path="gitrends.html")]
struct AppTemplate {
    time: i64
}