import React from "react";

import axios from "axios";

import Moment from "react-moment";

import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-sql";
import "ace-builds/src-noconflict/theme-dracula";

import { OnError} from "../helpers/misc";
import { CustomAnalysis } from "../model";
import {Conditional, Table} from "../helpers/view";

interface CustomAnalysisViewProps {
    onError: OnError;
}

interface CustomAnalysisViewState {
    query: string;
    result: CustomAnalysis;

    savedQueries: SavedQuery[];
    currentQueryIndex: number;
    queryName: string;

    showHelp: boolean;
}

export class CustomAnalysisView extends React.Component<CustomAnalysisViewProps, CustomAnalysisViewState> {
    editArea: React.RefObject<AceEditor>;

    constructor(props) {
        super(props);

        this.state = {
            query: "SELECT * FROM file_hotspots;",
            result: {
                columns: [],
                rows: []
            },
            savedQueries: this.loadSavedQueries() ?? [],
            currentQueryIndex: null,
            queryName: null,
            showHelp: false
        };
    }

    render() {
        let columnNameToIndex = new Map<string, number>();
        this.state.result.columns.forEach((column, columnIndex) => {
            columnNameToIndex.set(column, columnIndex);
        });

        return (
            <div>
                <div className="pt-3 pb-2 mb-3 border-bottom">
                    <i
                        className="fa-solid fa-info link-button"
                        style={{ float: "right", fontSize: "x-large" }}
                        onClick={() => { this.setState({ showHelp: !this.state.showHelp }) }}
                    />

                    <h1 className="h2">Custom analysis</h1>
                </div>

                {this.renderHelp()}

                <div className="row">
                    <div className="col-9">
                        <AceEditor
                            ref={this.editArea}
                            mode="sql"
                            theme="dracula"
                            name="editor"
                            editorProps={{ $blockScrolling: true }}
                            value={this.state.query}
                            onChange={newQuery => {
                                this.setState({
                                    query: newQuery
                                });
                            }}
                            width="100%"
                            height="100%"
                            className="sql-editor"
                        />
                    </div>
                    <div className="col-3">
                        <h4>Saved queries</h4>
                        <ul>
                            {
                                this.state.savedQueries.map((query, queryIndex) =>
                                    <li key={queryIndex}>
                                        <span className="link-button" onClick={() => {
                                            this.switchToQuery(query);
                                        }}>
                                            {query.name} at <Moment
                                            format="YYYY-MM-DD HH:mm:ss">{query.saveDate * 1000.0}</Moment>
                                        </span>

                                        <i
                                            className="fa-solid fa-pencil link-button"
                                            style={{marginLeft: "7px"}}
                                            onClick={() => {
                                                this.editSavedQuery(queryIndex);
                                            }}
                                        />

                                        <i
                                            className="fa-solid fa-trash link-button"
                                            style={{marginLeft: "7px"}}
                                            onClick={() => {
                                                this.removeSavedQuery(queryIndex);
                                            }}
                                        />
                                    </li>
                                )
                            }
                        </ul>

                        <Conditional
                            condition={this.state.currentQueryIndex != null}
                            trueBranch={() =>
                                <div className="input-group mb-3">
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Name of the query"
                                        aria-describedby="query-name"
                                        value={this.state.queryName}
                                        onChange={event => {
                                            this.setState({
                                                queryName: event.target.value
                                            });
                                        }}
                                    />

                                    <button
                                        className="btn btn-outline-secondary"
                                        type="button"
                                        id="query-name"
                                        onClick={() => { this.saveQueryName(); }}
                                    >
                                        Update
                                    </button>
                                </div>
                            }
                            falseBranch={() => null}
                        />

                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                this.saveQuery();
                            }}
                        >
                            Save
                        </button>
                    </div>
                </div>

                <br/>
                <button
                    className="btn btn-primary btn-lg"
                    onClick={() => {
                        this.performQuery();
                    }}
                >
                    Execute
                </button>

                <br />
                <br />

                <Table
                    columns={this.state.result.columns.map(column => {
                        return {
                            name: column,
                            display: column,
                            clickable: false
                        };
                    })}
                    rows={this.state.result.rows}
                    extractColumn={(row, name) => row[columnNameToIndex.get(name)]}
                    initialSortOrder={{
                        columnIndex: 0,
                        order: 1
                    }}
                />
            </div>
        );
    }

    renderHelp() {
        if (!this.state.showHelp) {
            return null;
        }

        return (
            <div>
                <h5>Tables</h5>
                <ul>
                    <li><code>git_log</code>: Git log</li>
                    <li><code>all_git_file_entries</code>: All git file entries.</li>
                    <li><code>git_file_entries</code>: Git file entries that matches filtering.</li>
                    <li><code>git_module_entries</code>: All module entries.</li>
                    <li><code>latest_revision_file_entries</code>: Latest revision of each file.</li>
                    <li><code>latest_revision_module_entries</code>: Latest revision of each module.</li>
                    <li><code>file_hotspots</code>: The file hotspots.</li>
                    <li><code>module_hotspots</code>: The module hotspots.</li>
                    <li><code>file_coupled_revisions</code>: The coupled file revisions.</li>
                    <li><code>module_coupled_revisions</code>: The coupled module revisions.</li>
                    <li><code>file_developers</code>: The developer statistics of a specific file.</li>
                    <li><code>module_developers</code>: The developer statistics of a specific module.</li>
                    <li><code>file_sum_of_couplings</code>: The sum of couplings per file.</li>
                    <li><code>module_sum_of_couplings</code>: The sum of couplings per module.</li>
                </ul>
            </div>
        );
    }

    performQuery() {
        axios.post(`/api/custom-analysis`, { "query": this.state.query })
            .then(response => {
                this.setState({
                    result: response.data
                });
            })
            .catch(error => {
                this.props.onError(error);
            });
    }

    saveQuery() {
        let savedQuery: SavedQuery = {
            name: `Query #${this.state.savedQueries.length + 1}`,
            query: this.state.query,
            saveDate: new Date().getTime() / 1000.0
        };

        let newSavedQueries = [savedQuery, ...this.state.savedQueries];
        this.updateSavedQueries(newSavedQueries);
    }

    editSavedQuery(index: number) {
        this.setState({
            currentQueryIndex: index,
            queryName: this.state.savedQueries[index].name
        })
    }

    saveQueryName() {
        let newSavedQueries = [...this.state.savedQueries];
        newSavedQueries[this.state.currentQueryIndex].name = this.state.queryName;
        this.updateSavedQueries(newSavedQueries);

        this.setState({
            queryName: null,
            currentQueryIndex: null
        });
    }

    removeSavedQuery(index: number) {
        let newSavedQueries = [...this.state.savedQueries];
        newSavedQueries.splice(index, 1);
        this.updateSavedQueries(newSavedQueries);
    }

    switchToQuery(savedQuery: SavedQuery) {
        this.setState({
           query: savedQuery.query
        });
    }

    updateSavedQueries(savedQueries: SavedQuery[]) {
        this.setState({
            savedQueries: savedQueries
        });

        try {
            localStorage.setItem("saved_queries", JSON.stringify(savedQueries));
        } catch (e) {
            this.props.onError(e);
        }
    }

    loadSavedQueries(): SavedQuery[] {
        try {
            return JSON.parse(localStorage.getItem("saved_queries"));
        } catch (e) {
            this.props.onError(e);
        }
    }
}

interface SavedQuery {
    name: string;
    saveDate: number;
    query: string;
}