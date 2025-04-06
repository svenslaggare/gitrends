use std::collections::HashMap;
use std::fmt::{Display, Formatter};

use serde::Serialize;

use crate::indexing::indexer::GitLogEntry;
use crate::querying::printing::{TablePrinter, TablePrinting};

#[derive(Debug, Serialize)]
pub struct RepositorySummary {
    pub num_revisions: u64,
    pub first_commit: Option<GitLogEntry>,
    pub last_commit: Option<GitLogEntry>,

    pub num_code_lines: u64,
    pub num_files: u64,
    pub num_modules: u64,

    pub top_authors: Vec<Author>,

    pub top_code_files: Vec<FileEntry>,
    pub last_changed_files: Vec<FileHistoryEntry>
}

#[derive(Debug, Serialize)]
pub struct Author {
    pub name: String,
    pub num_revisions: u64
}

#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub name: String,

    pub num_code_lines: u64,
    pub num_comment_lines: u64,
    pub num_blank_lines: u64,

    pub total_indent_levels: u64,
    pub avg_indent_levels: f64,
    pub std_indent_levels: f64
}

#[derive(Debug, Serialize)]
pub struct Module {
    pub name: String,
    pub files: Vec<ModuleFile>
}

#[derive(Debug, Serialize)]
pub struct ModuleFile {
    pub file_name: String,
    pub num_code_lines: u64,
    pub total_indent_levels: u64
}

#[derive(Debug, Serialize)]
pub struct FileHistoryEntry {
    pub name: String,
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

    fn from_raw(root: RawHotspotTree) -> HotspotTree {
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

        let mut root = RawHotspotTree::Tree {
            name: "root".to_string(),
            children: HashMap::new()
        };

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

#[derive(Debug, Serialize)]
#[serde(tag="type")]
pub enum ChangeCouplingTree {
    Tree {
        name: String,
        children: Vec<ChangeCouplingTree>
    },
    Leaf {
        name: String,
        couplings: Vec<Coupling>
    }
}

impl ChangeCouplingTree {
    pub fn from_vec(
        change_couplings: &Vec<ChangeCoupling>,
        split_at_path_separator: bool,
        min_coupled_revisions: u64,
        min_coupling_ratio: f64,
    ) -> ChangeCouplingTree {
        ChangeCouplingTree::from_raw(
            RawChangeCouplingTree::from_vec(change_couplings, split_at_path_separator),
            min_coupled_revisions,
            min_coupling_ratio
        )
    }

    fn from_raw(
        root: RawChangeCouplingTree,
        min_coupled_revisions: u64,
        min_coupling_ratio: f64
    ) -> ChangeCouplingTree {
        match root {
            RawChangeCouplingTree::Tree { name, children } => {
                let mut children = children
                    .into_values()
                    .map(|tree| ChangeCouplingTree::from_raw(tree, min_coupled_revisions, min_coupling_ratio))
                    .filter(|tree| !tree.is_empty_leaf())
                    .collect::<Vec<_>>();

                children.sort_by_key(|child| child.name().to_owned());

                ChangeCouplingTree::Tree {
                    name,
                    children
                }
            }
            RawChangeCouplingTree::Leaf { name, couplings } => {
                ChangeCouplingTree::Leaf {
                    name,
                    couplings: couplings
                        .into_iter()
                        .filter(|coupling| coupling.coupled_revisions >= min_coupled_revisions && coupling.coupling_ratio >= min_coupling_ratio)
                        .collect()
                }
            }
        }
    }
}

impl ChangeCouplingTree {
    pub fn name(&self) -> &str {
        match self {
            ChangeCouplingTree::Tree { name, .. } => &name,
            ChangeCouplingTree::Leaf { name, .. } => &name
        }
    }

    pub fn is_empty_leaf(&self) -> bool {
        match self {
            ChangeCouplingTree::Tree { .. } => false,
            ChangeCouplingTree::Leaf { couplings, .. } => couplings.is_empty(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct Coupling {
    pub coupled: String,
    pub coupled_revisions: u64,
    pub coupling_ratio: f64
}

enum RawChangeCouplingTree {
    Tree {
        name: String,
        children: HashMap<String, RawChangeCouplingTree>
    },
    Leaf {
        name: String,
        couplings: Vec<Coupling>
    }
}

impl RawChangeCouplingTree {
    pub fn from_vec(change_coupling: &Vec<ChangeCoupling>, split_at_path_separator: bool) -> RawChangeCouplingTree {
        let mut root = RawChangeCouplingTree::Tree {
            name: String::new(),
            children: HashMap::new()
        };

        fn update_coupling(
            root: &mut RawChangeCouplingTree,
            name1: &str,
            name2: &str,
            change_coupling: &ChangeCoupling
        ) {
            let mut current = root;

            let path = std::path::Path::new(&name1);
            let path_parts = path.iter().collect::<Vec<_>>();

            for (part_index, part) in path_parts.iter().enumerate() {
                let part_str = part.to_str().unwrap().to_owned();
                let is_last = part_index == path_parts.len() - 1;

                match current {
                    RawChangeCouplingTree::Tree { children, .. } => {
                        let entry = children.entry(part_str.clone()).or_insert_with(|| {
                            if is_last {
                                RawChangeCouplingTree::Leaf {
                                    name: part_str,
                                    couplings: Vec::new()
                                }
                            } else {
                                RawChangeCouplingTree::Tree { name: part_str, children: HashMap::new() }
                            }
                        });

                        if let RawChangeCouplingTree::Leaf { couplings: coupling, .. } = entry {
                            coupling.push(
                                Coupling {
                                    coupled: name2.to_owned(),
                                    coupled_revisions: change_coupling.coupled_revisions,
                                    coupling_ratio: change_coupling.coupling_ratio()
                                }
                            );
                        }

                        current = entry;
                    }
                    RawChangeCouplingTree::Leaf { .. } => {}
                }
            }
        }

        fn update_coupling_non_split(
            root: &mut RawChangeCouplingTree,
            name1: &str,
            name2: &str,
            change_coupling: &ChangeCoupling
        ) {
            match root {
                RawChangeCouplingTree::Tree { children, .. } => {
                    let entry = children.entry(name1.to_owned()).or_insert_with(|| {
                        RawChangeCouplingTree::Leaf {
                            name: name1.to_owned(),
                            couplings: Vec::new()
                        }
                    });

                    if let RawChangeCouplingTree::Leaf { couplings: coupling, .. } = entry {
                        coupling.push(
                            Coupling {
                                coupled: name2.to_owned(),
                                coupled_revisions: change_coupling.coupled_revisions,
                                coupling_ratio: change_coupling.coupling_ratio()
                            }
                        );
                    }
                }
                RawChangeCouplingTree::Leaf { .. } => {}
            }
        }

        for change_coupling in change_coupling {
            if split_at_path_separator {
                update_coupling(&mut root, &change_coupling.left_name, &change_coupling.right_name, change_coupling);
                update_coupling(&mut root, &change_coupling.right_name, &change_coupling.left_name, change_coupling);
            } else {
                update_coupling_non_split(&mut root, &change_coupling.left_name, &change_coupling.right_name, change_coupling);
                update_coupling_non_split(&mut root, &change_coupling.right_name, &change_coupling.left_name, change_coupling);
            }
        }

        root
    }
}