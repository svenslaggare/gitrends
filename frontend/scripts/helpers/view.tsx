import React from "react";

export enum EntryType {
    File,
    Module
}

export function EntryTypeSwitcher({ current, onChange }: { current: EntryType; onChange: (entryType: EntryType) => void; }) {
    function iconForType(entryType: EntryType) {
        switch (entryType) {
            case EntryType.File:
                return <i className="fa-solid fa-file" />;
            case EntryType.Module:
                return <i className="fa-solid fa-folder" />;
        }
    }

    return (
        <div className="dropdown switcher-dropdown">
            <DropdownButton>
                {iconForType(current)}
            </DropdownButton>
            <ul className="dropdown-menu">
                <li>
                    <a className="dropdown-item" href="#file" onClick={() => { onChange(EntryType.File) }}>
                        {iconForType(EntryType.File)} File
                    </a>
                </li>
                <li>
                    <a className="dropdown-item" href="#module" onClick={() => { onChange(EntryType.Module) }}>
                        {iconForType(EntryType.Module)} Module
                    </a>
                </li>
            </ul>
        </div>
    );
}

export enum HotspotAnalysisType {
    Revision,
    Author
}

export function HotspotAnalysisTypeSwitcher({ current, onChange }: { current: HotspotAnalysisType; onChange: (analysisType: HotspotAnalysisType) => void; }) {
    function iconForType(analysisType: HotspotAnalysisType) {
        switch (analysisType) {
            case HotspotAnalysisType.Revision:
                return <i className="fa-solid fa-code-commit" />;
            case HotspotAnalysisType.Author:
                return <i className="fa-regular fa-user" />;
        }
    }

    return (
        <div className="dropdown switcher-dropdown">
            <DropdownButton>
                {iconForType(current)}
            </DropdownButton>
            <ul className="dropdown-menu">
                <li>
                    <a className="dropdown-item" href="#revision" onClick={() => { onChange(HotspotAnalysisType.Revision) }}>
                        {iconForType(HotspotAnalysisType.Revision)} Revision
                    </a>
                </li>
                <li>
                    <a className="dropdown-item" href="#author" onClick={() => { onChange(HotspotAnalysisType.Author) }}>
                        {iconForType(HotspotAnalysisType.Author)} Author
                    </a>
                </li>
            </ul>
        </div>
    );
}

function DropdownButton({ children }: { children: JSX.Element}) {
    return (
        <button className="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
            {children}
        </button>
    );
}

export interface TableSortOrder {
    columnIndex: number;
    order: number;
}

export interface TableColumn {
    name: string;
    display: string;
    clickable: boolean;
}

interface TableProps {
    columns: TableColumn[];
    rows: any[];
    extractColumn: (row: any, name: string) => any;
    onValueClick?: (rowIndex: number, column: string) => void;
    initialSortOrder: TableSortOrder;
}

interface TableState {
    hasSetTableSortOrder: boolean;
    tableSortOrder: TableSortOrder;
}

export class Table extends React.Component<TableProps, TableState> {
    constructor(props) {
        super(props);

        this.state = {
            hasSetTableSortOrder: false,
            tableSortOrder: this.props.initialSortOrder
        }
    }

    render() {
        let rows = [...this.props.rows];

        if (this.state.hasSetTableSortOrder) {
            let tableSortOrder = this.state.tableSortOrder;
            let column = this.props.columns[tableSortOrder.columnIndex];
            rows.sort((a, b) => this.sortRow(column, a, b) * tableSortOrder.order);
        }

        return (
            <table className="table table-striped table-sm">
                <thead>
                <tr>
                    <th scope="col">#</th>
                    {
                        this.props.columns.map((column, columnIndex) =>
                            <th
                                key={columnIndex}
                                scope="col"
                                className="sortable-column-header"
                                onClick={() => {
                                    this.setState({
                                        hasSetTableSortOrder: true,
                                        tableSortOrder: {
                                            columnIndex: columnIndex,
                                            order: this.state.tableSortOrder.columnIndex == columnIndex ? -this.state.tableSortOrder.order : -1
                                        }
                                    });
                                }}
                            >
                                {column.display}
                            </th>
                        )
                    }
                </tr>
                </thead>
                <tbody>
                {
                    rows.map((row, rowIndex) =>
                        <tr key={rowIndex}>
                            <td>{rowIndex + 1}</td>
                            {
                                this.props.columns.map((column, columnIndex) => {
                                    return (
                                        <td
                                            key={columnIndex}
                                            className={`${column.clickable ? "clickable-column" : ""}`}
                                            onClick={() => {
                                                if (column.clickable) {
                                                    this.props?.onValueClick(rowIndex, column.name);
                                                }
                                            }}
                                        >
                                            {this.props.extractColumn(row, column.name)}
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

    sortRow(column: TableColumn, row1: any, row2: any) {
        let columnName = column.name;
        let value1 = this.props.extractColumn(row1, columnName);
        let value2 = this.props.extractColumn(row2, columnName);

        if (typeof value1 == "string") {
            if (value1 > value2) {
                return 1;
            } else if (value1 < value2) {
                return -1;
            } else {
                return 0;
            }
        }

        return Math.round(value1 - value2);
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