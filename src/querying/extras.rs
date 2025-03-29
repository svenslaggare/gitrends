use glob::{Pattern, PatternError};
use regex::Regex;
use thiserror::Error;

pub struct ModuleDefinitions {
    modules: Vec<(Pattern, String)>
}

impl ModuleDefinitions {
    pub fn new(definition: &str) -> Result<ModuleDefinitions, ModuleDefinitionError> {
        let mut modules = Vec::new();

        let rename_pattern = Regex::new("(.*)=>(.*)").unwrap();
        for line in definition.lines() {
            if let Some(line_capture) = rename_pattern.captures(&line) {
                modules.push((
                    Pattern::new(&line_capture[1].trim()).map_err(|err| ModuleDefinitionError::Pattern(err))?,
                    line_capture[2].trim().to_owned()
                ));
            }
        }

        Ok(ModuleDefinitions { modules })
    }

    pub fn empty() -> ModuleDefinitions {
        ModuleDefinitions { modules: Vec::new() }
    }

    pub fn get_module(&self, file_name: &str) -> Option<&str> {
        for (pattern, module_name) in &self.modules {
            if pattern.matches(file_name) {
                return Some(module_name);
            }
        }

        None
    }
}

pub struct IgnoreFile {
    patterns: Vec<Pattern>
}

impl IgnoreFile {
    pub fn new(definition: &str) -> IgnoreFile {
        let mut patterns = Vec::new();

        for line in definition.lines() {
            if let Ok(pattern) = Pattern::new(line) {
                patterns.push(pattern);
            }
        }

        IgnoreFile { patterns }
    }

    pub fn empty() -> IgnoreFile {
        IgnoreFile { patterns: Vec::new() }
    }

    pub fn is_ignored(&self, file_name: &str) -> bool {
        for pattern in &self.patterns {
            if pattern.matches(file_name) {
                return true;
            }
        }

        false
    }
}

#[derive(Debug, Error)]
pub enum ModuleDefinitionError {
    #[error("Pattern: {0}")]
    Pattern(PatternError),
}