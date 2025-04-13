use std::path::Path;

use crate::querying::engine::{RepositoryQuerying, RepositoryQueryingConfig};

#[tokio::test]
async fn test_summary() {
    let repository_querying = create_querying().await;

    let summary = repository_querying.summary().await.unwrap();
    assert_eq!(286, summary.num_revisions);
    assert_eq!(19488, summary.num_code_lines);
    assert_eq!(13, summary.num_modules);
    assert_eq!(50, summary.num_files);
}

#[tokio::test]
async fn test_log() {
    let repository_querying = create_querying().await;

    let log = repository_querying.log().await.unwrap();
    assert_eq!(286, log.len());

    let entry = log.last().unwrap();
    assert_eq!("82169c2", entry.revision);
}

#[tokio::test]
async fn test_files() {
    let repository_querying = create_querying().await;

    let files = repository_querying.files().await.unwrap();
    assert_eq!(50, files.len());

    let entry = files.first().unwrap();
    assert_eq!("testdata/ssh_data.txt", entry.name);
    assert_eq!(2000, entry.num_code_lines);
}

#[tokio::test]
async fn test_modules() {
    let repository_querying = create_querying().await;

    let modules = repository_querying.modules().await.unwrap();
    assert_eq!(13, modules.len());

    let entry = modules.first().unwrap();
    assert_eq!("<root>", entry.name);
    assert_eq!(3, entry.files.len());
}

#[tokio::test]
async fn test_module_files() {
    let repository_querying = create_querying().await;

    let files = repository_querying.module_files("execution").await.unwrap();
    assert_eq!(10, files.len());

    let entry = files.first().unwrap();
    assert_eq!("src/execution/aggregate_execution_tests.rs", entry.name);
    assert_eq!(1575, entry.num_code_lines);
}

#[tokio::test]
async fn test_file_hotspots() {
    let repository_querying = create_querying().await;

    let hotspots = repository_querying.file_hotspots(None).await.unwrap();
    assert_eq!(50, hotspots.len());

    let entry = hotspots.first().unwrap();
    assert_eq!("src/model.rs", entry.name);
    assert_eq!(932, entry.num_code_lines);
}

#[tokio::test]
async fn test_module_hotspots() {
    let repository_querying = create_querying().await;

    let hotspots = repository_querying.module_hotspots(None).await.unwrap();
    assert_eq!(13, hotspots.len());

    let entry = hotspots.first().unwrap();
    assert_eq!("execution", entry.name);
    assert_eq!(5211, entry.num_code_lines);
}

#[tokio::test]
async fn test_file_change_couplings() {
    let repository_querying = create_querying().await;

    let change_couplings = repository_querying.file_change_couplings(None).await.unwrap();
    assert_eq!(465, change_couplings.len());

    let entry = change_couplings.first().unwrap();
    assert_eq!("Cargo.lock", entry.left_name);
    assert_eq!("Cargo.toml", entry.right_name);
    assert_eq!(25, entry.coupled_revisions);
}

#[tokio::test]
async fn test_change_couplings_for_file() {
    let repository_querying = create_querying().await;

    let change_couplings = repository_querying.change_couplings_for_file("src/execution/execution_engine.rs", None).await.unwrap();
    assert_eq!(37, change_couplings.len());

    let entry = change_couplings.first().unwrap();
    assert_eq!("src/execution/execution_engine.rs", entry.left_name);
    assert_eq!("testdata/ftpd_timestamp.txt", entry.right_name);
    assert_eq!(1, entry.coupled_revisions);
}

#[tokio::test]
async fn test_module_change_couplings() {
    let repository_querying = create_querying().await;

    let change_couplings = repository_querying.module_change_couplings(None).await.unwrap();
    assert_eq!(61, change_couplings.len());

    let entry = change_couplings.first().unwrap();
    assert_eq!("execution", entry.left_name);
    assert_eq!("parsing", entry.right_name);
    assert_eq!(40, entry.coupled_revisions);
}

#[tokio::test]
async fn test_module_change_couplings_for_file() {
    let repository_querying = create_querying().await;

    let change_couplings = repository_querying.change_couplings_for_module("execution", None).await.unwrap();
    assert_eq!(11, change_couplings.len());

    let entry = change_couplings.first().unwrap();
    assert_eq!("execution", entry.left_name);
    assert_eq!("parsing", entry.right_name);
    assert_eq!(40, entry.coupled_revisions);
}

#[tokio::test]
async fn test_file_sum_of_couplings() {
    let repository_querying = create_querying().await;

    let sum_of_couplings = repository_querying.file_sum_of_couplings(None).await.unwrap();
    assert_eq!(50, sum_of_couplings.len());

    let entry = sum_of_couplings.first().unwrap();
    assert_eq!("src/model.rs", entry.name);
    assert_eq!(227, entry.sum_of_couplings);
}

#[tokio::test]
async fn test_module_sum_of_couplings() {
    let repository_querying = create_querying().await;

    let sum_of_couplings = repository_querying.module_sum_of_couplings(None).await.unwrap();
    assert_eq!(13, sum_of_couplings.len());

    let entry = sum_of_couplings.first().unwrap();
    assert_eq!("execution", entry.name);
    assert_eq!(166, entry.sum_of_couplings);
}

#[tokio::test]
async fn test_file_history() {
    let repository_querying = create_querying().await;

    let entries = repository_querying.file_history("src/execution/execution_engine.rs").await.unwrap();
    assert_eq!(44, entries.len());

    let entry = entries.first().unwrap();
    assert_eq!("src/execution/execution_engine.rs", entry.name);
    assert_eq!(134, entry.num_code_lines);
}

#[tokio::test]
async fn test_files_main_developer() {
    let repository_querying = create_querying().await;

    let entries = repository_querying.files_main_developer().await.unwrap();
    assert_eq!(50, entries.len());

    let entry = entries.first().unwrap();
    assert_eq!("src/parsing/parser.rs", entry.name);
    assert_eq!("Anton Jansson", entry.main_developer);
    assert_eq!(4090, entry.net_added_lines);
}

#[tokio::test]
async fn test_modules_main_developer() {
    let repository_querying = create_querying().await;

    let entries = repository_querying.modules_main_developer().await.unwrap();
    assert_eq!(13, entries.len());

    let entry = entries.first().unwrap();
    assert_eq!("parsing", entry.name);
    assert_eq!("Anton Jansson", entry.main_developer);
    assert_eq!(10052, entry.net_added_lines);
}

#[tokio::test]
async fn test_commit_spread() {
    let repository_querying = create_querying().await;

    let entries = repository_querying.commit_spread().await.unwrap();
    assert_eq!(13, entries.len());

    let entry = entries.first().unwrap();
    assert_eq!("<root>", entry.module_name);
    assert_eq!("Anton Jansson", entry.author);
    assert_eq!(46, entry.num_revisions);
}

async fn create_querying() -> RepositoryQuerying {
    RepositoryQuerying::new(
        Path::new("test_data/sqlgrep"),
        RepositoryQueryingConfig::default()
    ).await.unwrap()
}