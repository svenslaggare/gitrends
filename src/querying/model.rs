use serde::Serialize;
use std::fmt::{Display, Formatter};

use crate::querying::printing::{TablePrinter, TablePrinting};

#[derive(Debug, Serialize)]
pub struct Hotspot {
    pub name: String,
    pub num_revisions: u64,
    pub num_code_lines: u64,
    pub total_indent_levels: u64
}

impl Display for Hotspot {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{} - revisions: {}, code lines: {}, total indent level: {}",
            self.name,
            self.num_revisions,
            self.num_code_lines,
            self.total_indent_levels
        )
    }
}

impl TablePrinting for Hotspot {
    fn get_column_names() -> Vec<String> {
        vec![
            "name".to_string(),
            "num_revisions".to_string(),
            "num_code_lines".to_string(),
            "total_indent_levels".to_string()
        ]
    }

    fn add_row(&self, table_printer: &mut TablePrinter) {
        table_printer.add_row(vec![
            self.name.clone(),
            self.num_revisions.to_string(),
            self.num_code_lines.to_string(),
            self.total_indent_levels.to_string()
        ]);
    }
}

#[derive(Debug, Serialize)]
pub struct ChangeCoupling {
    pub left_name: String,
    pub right_name: String,
    pub coupled_revisions: u64,
    pub num_left_revisions: u64,
    pub num_right_revisions: u64
}

impl ChangeCoupling {
    pub fn average_revisions(&self) -> u64 {
        (self.num_left_revisions + self.num_right_revisions) / 2
    }

    pub fn coupling_ratio(&self) -> f64 {
        self.coupled_revisions as f64 / self.average_revisions() as f64
    }
}

impl Display for ChangeCoupling {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}, {} - coupled revisions: {} ({:.1} %), revisions: {}, {}",
            self.left_name,
            self.right_name,
            self.coupled_revisions,
            self.coupling_ratio() * 100.0,
            self.num_left_revisions,
            self.num_right_revisions
        )
    }
}

impl TablePrinting for ChangeCoupling {
    fn get_column_names() -> Vec<String> {
        vec![
            "left_module".to_string(),
            "right_module".to_string(),
            "coupled_revisions".to_string(),
            "num_left_revisions".to_string(),
            "num_right_revisions".to_string(),
        ]
    }

    fn add_row(&self, table_printer: &mut TablePrinter) {
        table_printer.add_row(vec![
            self.left_name.clone(),
            self.right_name.clone(),
            self.coupled_revisions.to_string(),
            self.num_left_revisions.to_string(),
            self.num_right_revisions.to_string(),
        ]);
    }
}

#[derive(Debug, Serialize)]
pub struct FileHistoryEntry {
    pub revision: String,
    pub date: i64,

    pub num_code_lines: u64,
    pub num_comment_lines: u64,
    pub num_blank_lines: u64,

    pub total_indent_levels: u64,
    pub avg_indent_levels: f64,
    pub std_indent_level: f64
}

impl TablePrinting for FileHistoryEntry {
    fn get_column_names() -> Vec<String> {
        vec![
            "revision".to_string(),
            "date".to_string(),
            "num_code_lines".to_string(),
            "num_comment_lines".to_string(),
            "num_blank_lines".to_string(),
            "total_indent_levels".to_string(),
            "avg_indent_levels".to_string(),
            "std_indent_level".to_string(),
        ]
    }

    fn add_row(&self, table_printer: &mut TablePrinter) {
        table_printer.add_row(vec![
            self.revision.clone(),
            self.date.to_string(),
            self.num_code_lines.to_string(),
            self.num_comment_lines.to_string(),
            self.num_blank_lines.to_string(),
            self.total_indent_levels.to_string(),
            self.avg_indent_levels.to_string(),
            self.std_indent_level.to_string()
        ]);
    }
}