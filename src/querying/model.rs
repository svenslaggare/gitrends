use std::collections::HashMap;
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

#[derive(Debug, Serialize)]
#[serde(tag="type")]
pub enum HotspotTree {
    Tree {
        name: String,
        children: Vec<HotspotTree>
    },
    Leaf {
        name: String,
        size: u64,
        weight: f64
    }
}

impl HotspotTree {
    pub fn from_vec(hotspots: &Vec<Hotspot>) -> HotspotTree {
        HotspotTree::from_raw(RawHotspotTree::from_vec(hotspots))
    }
}

impl HotspotTree {
    pub fn from_raw(root: RawHotspotTree) -> HotspotTree {
        match root {
            RawHotspotTree::Tree { name, children } => {
                let mut children = children
                    .into_values()
                    .map(|value| HotspotTree::from_raw(value))
                    .collect::<Vec<_>>();

                children.sort_by_key(|child| child.name().to_owned());

                HotspotTree::Tree {
                    name,
                    children,
                }
            }
            RawHotspotTree::Leaf { name, size, weight } => {
                HotspotTree::Leaf { name, size, weight }
            }
        }
    }
}

impl HotspotTree {
    pub fn name(&self) -> &str {
        match self {
            HotspotTree::Tree { name, .. } => &name,
            HotspotTree::Leaf { name, .. } => &name
        }
    }
}

enum RawHotspotTree {
    Tree {
        name: String,
        children: HashMap<String, RawHotspotTree>
    },
    Leaf {
        name: String,
        size: u64,
        weight: f64
    }
}

impl RawHotspotTree {
    pub fn from_vec(hotspots: &Vec<Hotspot>) -> RawHotspotTree {
        let max_num_revisions = hotspots.iter().map(|hotspot| hotspot.num_revisions).max().unwrap_or(0);

        let mut root = RawHotspotTree::Tree { name: "root".to_string(), children: HashMap::new() };

        for hotspot in hotspots {
            let mut current = &mut root;

            let path = std::path::Path::new(&hotspot.name);
            let path_parts = path.iter().collect::<Vec<_>>();

            for (part_index, part) in path_parts.iter().enumerate() {
                let part_str = part.to_str().unwrap().to_owned();
                let is_last = part_index == path_parts.len() - 1;

                match current {
                    RawHotspotTree::Tree { children, .. } => {
                        let entry = children.entry(part_str.clone()).or_insert_with(|| {
                            if is_last {
                                RawHotspotTree::Leaf {
                                    name: part_str,
                                    size: hotspot.num_code_lines,
                                    weight: hotspot.num_revisions as f64 / max_num_revisions as f64,
                                }
                            } else {
                                RawHotspotTree::Tree { name: part_str, children: HashMap::new() }
                            }
                        });

                        current = entry;
                    }
                    RawHotspotTree::Leaf { .. } => {}
                }
            }
        }

        root
    }
}
