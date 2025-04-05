import React from "react";

import {ChangeCoupling, fetchFileHistory, FileHistory} from "./model";
import {CodeComplexityTimeChart} from "./charts";
import {OnError} from "./helpers";

export enum EntryType {
    File,
    Module
}

export function EntryTypeSwitcher({ current, onChange }: { current: EntryType; onChange: (entry: EntryType) => void; }) {
    function iconForType(entryType: EntryType) {
        switch (entryType) {
            case EntryType.File:
                return <i className="fa-solid fa-file"></i>;
            case EntryType.Module:
                return <i className="fa-solid fa-folder"></i>;
        }
    }

    return (
        <div className="dropdown" style={{ float: "right" }}>
            <button className="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                {iconForType(current)}
            </button>
            <ul className="dropdown-menu">
                <li>
                    <a className="dropdown-item" href="#file" onClick={() => { onChange(EntryType.File) }}>{iconForType(EntryType.File)} File</a>
                </li>
                <li>
                    <a className="dropdown-item" href="#module" onClick={() => { onChange(EntryType.Module) }}>{iconForType(EntryType.Module)} Module</a>
                </li>
            </ul>
        </div>
    );
}

export interface TableColumn {
    display: string;
    clickable: boolean;
}

interface TableProps {
    columns: { [name: string]: TableColumn };
    rows: any[];
    extractColumn: (row: any, name: string) => any;
    onValueClick?: (rowIndex: number, column: string) => void;
}

interface TableState {

}

export class Table extends React.Component<TableProps, TableState> {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <table className="table table-striped table-sm">
                <thead>
                <tr>
                    <th scope="col">#</th>
                    {
                        Object.entries(this.props.columns).map(([_, column], columnIndex) =>
                            <th scope="col" key={columnIndex}>{column.display}</th>
                        )
                    }
                </tr>
                </thead>
                <tbody>
                {
                    this.props.rows.map((row, rowIndex) =>
                        <tr key={rowIndex}>
                            <td>{rowIndex + 1}</td>
                            {
                                Object.entries(this.props.columns).map(([key, _], columnIndex) => {
                                    let column = this.props.columns[key];

                                    return (
                                        <td
                                            key={columnIndex}
                                            className={`${column.clickable ? "clickable-column" : ""}`}
                                            onClick={() => {
                                                if (column.clickable) {
                                                    this.props?.onValueClick(rowIndex, key);
                                                }
                                            }}
                                        >
                                            {this.props.extractColumn(row, key)}
                                        </td>
                                    );
                                })
                            }
                        </tr>
                    )
                }
                </tbody>
            </table>
        );
    }
}

export function SelectedFileModal({ name, selectedFile }: { name: string; selectedFile: FileHistory }) {
    let renderContent = () => {
        if (selectedFile == null) {
            return null;
        }

        return (
            <div className="modal-dialog">
                <div className="modal-content">
                    <div className="modal-header">
                        <h1 className="modal-title fs-5" id={`${name}Label`}>
                            {selectedFile.name} (revisions: {selectedFile.history.length})
                        </h1>
                        <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div className="modal-body">
                        <CodeComplexityTimeChart data={selectedFile.history} />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="modal" id="showFileModal" tabIndex={-1} aria-labelledby={`${name}Label`} aria-hidden="true">
            {renderContent()}
        </div>
    );
}

interface ShowSelectedFileModalProps {
    onError: OnError;
}

interface ShowSelectedFileModalState {
    fileHistory: FileHistory
}

export class ShowSelectedFileModal extends React.Component<ShowSelectedFileModalProps, ShowSelectedFileModalState> {
    private modal: any = null;

    constructor(props) {
        super(props);

        this.state = {
            fileHistory: null
        };
    }

    render() {
        return <SelectedFileModal name="selectedFileModal" selectedFile={this.state.fileHistory} />;
    }

    show(fileName: string) {
        fetchFileHistory(
            fileName,
            fileHistory => {
                this.setState({
                    fileHistory: fileHistory
                });

                // @ts-ignore
                this.modal = new bootstrap.Modal(document.getElementById("showFileModal"));
                this.modal.show();
            },
            error => {
                this.props.onError(error);
            }
        );
    }

    clear() {
        this.setState({
            fileHistory: null
        });
    }
}

export function AlertBox({ className, message, onClose }: { className: string; message: string; onClose: () => void }) {
    if (message == null) {
        return null;
    }

    return (
        <div className={`alert ${className} alert-dismissible show`} role="alert" style={{ margin: "1em" }}>
            {message}
            <button
                type="button" className="btn-close" aria-label="Close"
                onClick={() => {
                    onClose();
                }}
            ></button>
        </div>
    );
}

export function Conditional({ condition, trueBranch, falseBranch }: { condition: boolean; trueBranch: () => JSX.Element; falseBranch: () => JSX.Element }) {
    if (condition) {
        return trueBranch();
    } else {
        return falseBranch();
    }
}