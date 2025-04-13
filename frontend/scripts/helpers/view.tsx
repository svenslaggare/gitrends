import React from "react";

export enum EntryType {
    File,
    Module
}

export function EntryTypeSwitcher({ current, onChange }: { current: EntryType; onChange: (entryType: EntryType) => void; }) {
    return (
        <TypeSwitcher
            types={new Map([
                [EntryType.File, { name: "file", display: "File", iconClassName: "fa-solid fa-file" }],
                [EntryType.Module, { name: "module", display: "Module", iconClassName: "fa-solid fa-folder" }]
            ])}
            current={current}
            onChange={onChange}
        />
    );
}

export interface TypeSwitcherEntry {
    name: string;
    display: string;
    iconClassName: string;
}

export function TypeSwitcher<T>({ types, current, onChange }: { types: Map<T, TypeSwitcherEntry>, current: T; onChange: (newType: T) => void; }) {
    function iconForType(type: T) {
        return <i className={types.get(type).iconClassName} />;
    }

    return (
        <div className="dropdown switcher-dropdown">
            <DropdownButton>
                {iconForType(current)}
            </DropdownButton>
            <ul className="dropdown-menu">
                {
                    Array.from(types.entries()).map(([type, entry]) =>
                        <li key={entry.name}>
                            <a className="dropdown-item" href={`#${entry.name}`} onClick={() => { onChange(type) }}>
                                {iconForType(type)} {entry.display}
                            </a>
                        </li>
                    )
                }
            </ul>
        </div>
    );
}

export function DropdownButton({ children }: { children: JSX.Element}) {
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
    onValueClick?: (row: any, column: string) => void;
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
        return (
            <div>
                <div style={{ float: "right" }}>
                    <button className="btn btn-outline-secondary" onClick={() => { this.exportData(); }}>
                        <i className="fa-solid fa-file-csv" />
                    </button>
                </div>

                {this.renderTable(this.getRows())}

                <br />
                <br />
            </div>
        );
    }

    renderTable(rows: any[]) {
        return (
            <table className="table table-striped table-sm table-hover">
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
                                                    this.props?.onValueClick(rows[rowIndex], column.name);
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

    exportData() {
        let lines = [];
        lines.push(this.props.columns.map(column => column.name).join(","));
        for (let row of this.getRows()) {
            let rowColumns = this.props.columns.map(column => this.props.extractColumn(row, column.name));
            lines.push(rowColumns.join(","))
        }

        const file = new File(
            [lines.join("\n")],
            "file.csv",
            {
                type: 'text/plain',
            }
        );

        const fileURL = URL.createObjectURL(file);

        const downloadLink = document.createElement('a');
        downloadLink.href = fileURL;
        downloadLink.download = `exported-${new Date().toISOString()}.csv`;
        document.body.appendChild(downloadLink);
        downloadLink.click();

        URL.revokeObjectURL(fileURL);
    }

    getRows() {
        let rows = [...this.props.rows];

        if (this.state.hasSetTableSortOrder) {
            let tableSortOrder = this.state.tableSortOrder;
            let column = this.props.columns[tableSortOrder.columnIndex];
            rows.sort((a, b) => this.sortRow(column, a, b) * tableSortOrder.order);
        }

        return rows;
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