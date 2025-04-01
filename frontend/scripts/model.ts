import axios from "axios";

export interface Hotspot {
    name: string;
    num_revisions: number;
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

export interface FileHistoryEntry {
    revision: string;
    date: number;

    num_code_lines: number;
    num_comment_lines: number;
    num_blank_lines: number;

    total_indent_levels: number;
    avg_indent_levels: number;
    std_indent_level: number;
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