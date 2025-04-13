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

export interface HotspotEntry {
    name: string;
    num_revisions: number;
    num_authors: number;
    num_code_lines: number;
    total_indent_levels: number;
}

export interface ChangeCouplingEntry {
    left_name: string;
    right_name: string;
    coupled_revisions: number;
    num_left_revisions: number;
    num_right_revisions: number;
}

export function changeCouplingTableRow(changeCoupling: ChangeCouplingEntry, name: string) {
    let averageRevisions = Math.ceil((changeCoupling.num_left_revisions + changeCoupling.num_right_revisions) / 2.0);
    switch (name) {
        case "average_revisions":
            return averageRevisions;
        case "coupling_ratio":
            return Math.round((100.0 * (changeCoupling.coupled_revisions / averageRevisions)) * 10.0) / 10.0;
        default:
            return changeCoupling[name];
    }
}

export interface SumOfCouplingEntry {
    name: string;
    sum_of_couplings: number;
}

export interface FileHistory {
    name: string;
    history: FileHistoryEntry[];
}

export interface GitLogEntry {
    revision: string;
    date: number;
    author: string;
    commit_message: string;
}

export interface MainDeveloperEntry {
    name: string;
    main_developer: string;
    net_added_lines: number;
    total_net_added_lines: number;
}

export interface CommitSpreadEntry {
    module_name: string;
    author: string;
    num_revisions: number;
}

export interface CustomAnalysis {
    columns: string[];
    rows: any[][];
}