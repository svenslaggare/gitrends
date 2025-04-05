import React from "react";

import {ChangeCoupling, fetchFileHistory, FileHistory} from "../model";
import {CodeComplexityTimeChart} from "./charts";
import {OnError} from "./misc";

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