import axios from "axios";

export interface Summary {
    data_directory: string;

    num_revisions: number;
    first_commit: Commit;
    last_commit: Commit;

    num_code_lines: number;
    num_files: number;
    num_modules: number;

    top_authors: Author[];

    top_code_files: FileEntry[];
    last_changed_files: FileHistoryEntry[];
}

export interface Commit {
    revision: string;
    date: number;
    author: string;
    commit_message: string;
}

export interface Author {
    name: string;
    num_revisions: number;
}

export interface FileEntry {
    name: string;

    num_code_lines: number;
    num_comment_lines: number;
    num_blank_lines: number;

    total_indent_levels: number;
    avg_indent_levels: number;
    std_indent_levels: number;
}

export interface FileHistoryEntry {
    name: string;
    revision: string;
    date: number;

    num_code_lines: number;
    num_comment_lines: number;
    num_blank_lines: number;

    total_indent_levels: number;
    avg_indent_levels: number;
    std_indent_levels: number;
}

export interface Module {
    name: string;
    files: FileEntry[];
}

export interface Hotspot {
    name: string;
    num_revisions: number;
    num_authors: number;
    num_code_lines: number;
    total_indent_levels: number;
}

export interface ChangeCoupling {
    left_name: string;
    right_name: string;
    coupled_revisions: number;
    num_left_revisions: number;
    num_right_revisions: number;
}

export interface FileHistory {
    name: string;
    history: FileHistoryEntry[];
}

export function fetchFileHistory(fileName: string,
                                 success: (fileHistory: FileHistory) => void,
                                 failure: (data: any) => void) {
    axios.get(`/api/file/history/${fileName}`)
        .then(response => {
            success({
                name: fileName,
                history: response.data
            });
        })
        .catch(error => {
            failure(error);
        });
}

export interface GitLogEntry {
    revision: string;
    date: number;
    author: string;
    commit_message: string;
}