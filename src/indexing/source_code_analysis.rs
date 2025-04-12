use regex::Regex;

#[derive(Debug)]
pub struct SourceCodeStats {
    pub num_code_lines: u64,
    pub num_comment_lines: u64,
    pub num_blank_lines: u64,

    pub total_indent_levels: u64,
    pub avg_indent_levels: f64,
    pub std_indent_levels: f64,
}

pub fn calculate_source_code_stats(file_extension: &str, content: &str) -> SourceCodeStats {
    let blank_line = Regex::new("^\\s*$").unwrap();
    let single_comment_line = match file_extension {
        "py" => Regex::new("^\\s*(#.+)").unwrap(),
        _ => Regex::new("^\\s*(//.+)").unwrap()
    };

    let block_comment_start = Regex::new("^\\s*/\\*").unwrap();
    let block_comment_end = Regex::new("\\*/$").unwrap();
    let space_indent = Regex::new("^ +").unwrap();
    let tab_indent = Regex::new("^\t+").unwrap();

    let mut block_comment = false;
    let mut num_code_lines = 0;
    let mut num_comment_lines = 0;
    let mut num_blank_lines = 0;

    let mut total_indent_levels = 0;
    let mut square_total_indent_levels = 0;

    for line in content.lines() {
        if !block_comment && block_comment_start.is_match(line) {
            block_comment = true;
        }

        let is_comment = block_comment || single_comment_line.is_match(line);
        let is_blank = blank_line.is_match(line);
        let is_code = !(is_comment || is_blank);
        let num_space_indent = space_indent.find(line).map(|m| m.len()).unwrap_or(0);
        let num_tab_indent = tab_indent.find(line).map(|m| m.len()).unwrap_or(0);
        let total_indent = num_space_indent + num_tab_indent * 4;
        let indent_level = total_indent as u64 / 4;

        if block_comment && block_comment_end.is_match(line) {
            block_comment = false;
        }

        if is_code {
            num_code_lines += 1;
        }

        if is_comment {
            num_comment_lines += 1;
        }

        if is_blank {
            num_blank_lines += 1;
        }

        if is_code {
            total_indent_levels += indent_level;
            square_total_indent_levels += indent_level * indent_level;
        }
    }

    let total_indent_levels_f64 = total_indent_levels as f64;
    let num_code_lines_f64 = num_code_lines as f64;

    SourceCodeStats {
        num_code_lines,
        num_comment_lines,
        num_blank_lines,

        total_indent_levels,
        avg_indent_levels: total_indent_levels_f64 / num_code_lines_f64,
        std_indent_levels: (square_total_indent_levels as f64 - (total_indent_levels_f64 * total_indent_levels_f64) / num_code_lines_f64) / num_code_lines_f64
    }
}

#[test]
fn test_source_stats_rust() {
    let content = std::fs::read_to_string("test_data/example_rust.rs").unwrap();
    let stats = calculate_source_code_stats("rs", &content);

    assert_eq!(stats.num_code_lines + stats.num_comment_lines + stats.num_blank_lines, 16);
    assert_eq!(stats.num_code_lines, 8);
    assert_eq!(stats.num_comment_lines, 4);
    assert_eq!(stats.num_blank_lines, 4);
    assert_eq!(stats.total_indent_levels, 7);
}

#[test]
fn test_source_stats_python() {
    let content = std::fs::read_to_string("test_data/example_py.py").unwrap();
    let stats = calculate_source_code_stats("py", &content);

    assert_eq!(stats.num_code_lines + stats.num_comment_lines + stats.num_blank_lines, 11);
    assert_eq!(stats.num_code_lines, 6);
    assert_eq!(stats.num_comment_lines, 1);
    assert_eq!(stats.num_blank_lines, 4);
    assert_eq!(stats.total_indent_levels, 6);
}