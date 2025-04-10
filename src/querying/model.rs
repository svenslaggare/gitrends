use std::collections::HashMap;
use std::fmt::{Display, Formatter};

use serde::{Serialize, Serializer};

use datafusion::arrow::array::{ArrayRef, ArrowPrimitiveType, AsArray};
use datafusion::arrow::datatypes::{DataType, FieldRef, Float32Type, Float64Type, Int32Type, Int64Type, Int8Type, UInt32Type, UInt64Type, UInt8Type};

use crate::indexing::indexer::GitLogEntry;
use crate::querying::printing::{TablePrinter, TablePrinting};

#[derive(Debug, Serialize)]
pub struct RepositorySummary {
    pub data_directory: String,

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
    pub files: Vec<FileEntry>
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
    pub num_authors: u64,
    pub num_code_lines: u64,
    pub total_indent_levels: u64
}

impl Display for Hotspot {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{} - revisions: {}, authors: {}, code lines: {}, total indent level: {}",
            self.name,
            self.num_revisions,
            self.num_authors,
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
            "num_authors".to_string(),
            "num_code_lines".to_string(),
            "total_indent_levels".to_string()
        ]
    }

    fn add_row(&self, table_printer: &mut TablePrinter) {
        table_printer.add_row(vec![
            self.name.clone(),
            self.num_revisions.to_string(),
            self.num_authors.to_string(),
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
        revision_weight: f64,
        author_weight: f64
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
            RawHotspotTree::Leaf { name, size, revision_weight, author_weight } => {
                HotspotTree::Leaf { name, size, revision_weight, author_weight }
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
        revision_weight: f64,
        author_weight: f64
    }
}

impl RawHotspotTree {
    pub fn from_vec(hotspots: &Vec<Hotspot>) -> RawHotspotTree {
        let max_num_revisions = hotspots.iter().map(|hotspot| hotspot.num_revisions).max().unwrap_or(0);
        let max_num_authors = hotspots.iter().map(|hotspot| hotspot.num_authors).max().unwrap_or(0);

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
                                    revision_weight: hotspot.num_revisions as f64 / max_num_revisions as f64,
                                    author_weight: hotspot.num_authors as f64 / max_num_authors as f64,
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

#[derive(Debug, Serialize)]
pub struct MainDeveloperEntry {
    pub name: String,
    pub main_developer: String,
    pub net_added_lines: i64,
    pub total_net_added_lines: i64
}

#[derive(Debug, Serialize)]
#[serde(tag="type")]
pub enum MainDeveloperTree {
    Tree {
        name: String,
        children: Vec<MainDeveloperTree>
    },
    Leaf {
        name: String,
        size: u64,
        main_developer: String
    }
}

impl MainDeveloperTree {
    pub fn from_vec(main_developer_entries: &Vec<MainDeveloperEntry>) -> MainDeveloperTree {
        MainDeveloperTree::from_raw(RawMainDeveloperTree::from_vec(main_developer_entries))
    }

    fn from_raw(root: RawMainDeveloperTree) -> MainDeveloperTree {
        match root {
            RawMainDeveloperTree::Tree { name, children } => {
                let mut children = children
                    .into_values()
                    .map(|value| MainDeveloperTree::from_raw(value))
                    .collect::<Vec<_>>();

                children.sort_by_key(|child| child.name().to_owned());

                MainDeveloperTree::Tree {
                    name,
                    children,
                }
            }
            RawMainDeveloperTree::Leaf { name, size, main_developer } => {
                MainDeveloperTree::Leaf { name, size, main_developer }
            }
        }
    }
}

impl MainDeveloperTree {
    pub fn name(&self) -> &str {
        match self {
            MainDeveloperTree::Tree { name, .. } => &name,
            MainDeveloperTree::Leaf { name, .. } => &name
        }
    }
}

enum RawMainDeveloperTree {
    Tree {
        name: String,
        children: HashMap<String, RawMainDeveloperTree>
    },
    Leaf {
        name: String,
        size: u64,
        main_developer: String
    }
}

impl RawMainDeveloperTree {
    pub fn from_vec(main_developer_entries: &Vec<MainDeveloperEntry>) -> RawMainDeveloperTree {
        let mut root = RawMainDeveloperTree::Tree {
            name: "root".to_string(),
            children: HashMap::new()
        };

        for main_developer_entry in main_developer_entries {
            let mut current = &mut root;

            let path = std::path::Path::new(&main_developer_entry.name);
            let path_parts = path.iter().collect::<Vec<_>>();

            for (part_index, part) in path_parts.iter().enumerate() {
                let part_str = part.to_str().unwrap().to_owned();
                let is_last = part_index == path_parts.len() - 1;

                match current {
                    RawMainDeveloperTree::Tree { children, .. } => {
                        let entry = children.entry(part_str.clone()).or_insert_with(|| {
                            if is_last {
                                RawMainDeveloperTree::Leaf {
                                    name: part_str,
                                    size: main_developer_entry.total_net_added_lines as u64, // TODO
                                    main_developer: main_developer_entry.main_developer.clone()
                                }
                            } else {
                                RawMainDeveloperTree::Tree { name: part_str, children: HashMap::new() }
                            }
                        });

                        current = entry;
                    }
                    RawMainDeveloperTree::Leaf { .. } => {}
                }
            }
        }

        root
    }
}

#[derive(Debug, Serialize)]
pub struct CustomAnalysis {
    pub columns: Vec<String>,
    pub rows: Vec<CustomValueRow>
}

pub type CustomValueRow = Vec<CustomValue>;

#[derive(Debug)]
pub enum CustomValue {
    UInt8(Option<u8>),
    UInt32(Option<u32>),
    UInt64(Option<u64>),
    Int8(Option<i8>),
    Int32(Option<i32>),
    Int64(Option<i64>),
    Bool(Option<bool>),
    Float32(Option<f32>),
    Float64(Option<f64>),
    String(Option<String>)
}

impl CustomValue {
    pub fn from_column(column_def: &FieldRef, column: &ArrayRef, record_index: usize) -> Option<CustomValue> {
        fn extract_primitive<T: ArrowPrimitiveType<Native = U>, U>(column: &ArrayRef, record_index: usize) -> Option<U> {
            if column.is_valid(record_index) {
                Some(column.as_primitive::<T>().value(record_index))
            } else {
                None
            }
        }

        match column_def.data_type() {
            DataType::Utf8 => {
                if column.is_valid(record_index) {
                    Some(CustomValue::String(Some(column.as_string_view().value(record_index).to_owned())))
                } else {
                    Some(CustomValue::String(None))
                }
            }
            DataType::Utf8View => {
                if column.is_valid(record_index) {
                    Some(CustomValue::String(Some(column.as_string_view().value(record_index).to_owned())))
                } else {
                    Some(CustomValue::String(None))
                }
            }
            DataType::Int8 => {
                Some(CustomValue::Int8(extract_primitive::<Int8Type, _>(column, record_index)))
            }
            DataType::Int32 => {
                Some(CustomValue::Int32(extract_primitive::<Int32Type, _>(column, record_index)))
            }
            DataType::Int64 => {
                Some(CustomValue::Int64(extract_primitive::<Int64Type, _>(column, record_index)))
            }
            DataType::UInt8 => {
                Some(CustomValue::UInt8(extract_primitive::<UInt8Type, _>(column, record_index)))
            }
            DataType::UInt32 => {
                Some(CustomValue::UInt32(extract_primitive::<UInt32Type, _>(column, record_index)))
            }
            DataType::UInt64 => {
                Some(CustomValue::UInt64(extract_primitive::<UInt64Type, _>(column, record_index)))
            }
            DataType::Boolean => {
                if column.is_valid(record_index) {
                    Some(CustomValue::Bool(Some(column.as_boolean().value(record_index))))
                } else {
                    Some(CustomValue::Bool(None))
                }
            }
            DataType::Float32 => {
                Some(CustomValue::Float32(extract_primitive::<Float32Type, f32>(column, record_index)))
            }
            DataType::Float64 => {
                Some(CustomValue::Float64(extract_primitive::<Float64Type, f64>(column, record_index)))
            }
            _ => {
                None
            }
        }
    }
}

impl Serialize for CustomValue {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error> where S: Serializer {
        match self {
            CustomValue::UInt8(value) => {
                match value {
                    Some(value) => serializer.serialize_u8(*value),
                    None => serializer.serialize_none()
                }
            }
            CustomValue::UInt32(value) => {
                match value {
                    Some(value) => serializer.serialize_u32(*value),
                    None => serializer.serialize_none()
                }
            }
            CustomValue::UInt64(value) => {
                match value {
                    Some(value) => serializer.serialize_u64(*value),
                    None => serializer.serialize_none()
                }
            }
            CustomValue::Int8(value) => {
                match value {
                    Some(value) => serializer.serialize_i8(*value),
                    None => serializer.serialize_none()
                }
            }
            CustomValue::Int32(value) => {
                match value {
                    Some(value) => serializer.serialize_i32(*value),
                    None => serializer.serialize_none()
                }
            }
            CustomValue::Int64(value) => {
                match value {
                    Some(value) => serializer.serialize_i64(*value),
                    None => serializer.serialize_none()
                }
            }
            CustomValue::Bool(value) => {
                match value {
                    Some(value) => serializer.serialize_bool(*value),
                    None => serializer.serialize_none()
                }
            }
            CustomValue::Float32(value) => {
                match value {
                    Some(value) => serializer.serialize_f32(*value),
                    None => serializer.serialize_none()
                }
            }
            CustomValue::Float64(value) => {
                match value {
                    Some(value) => serializer.serialize_f64(*value),
                    None => serializer.serialize_none()
                }
            }
            CustomValue::String(value) => {
                match value {
                    Some(value) => serializer.serialize_str(value),
                    None => serializer.serialize_none()
                }
            }
        }
    }
}
