import React from "react";

import axios from "axios";
import humanizeDuration from "humanize-duration";

import {OnError} from "../helpers/misc";
import {Summary} from "../model";
import Moment from "react-moment";
import {Conditional} from "../helpers/view";
import {ShowSelectedFileModal} from "../helpers/selectedFileModal";

interface HomeViewProps {
    onError: OnError;
}

interface HomeViewState {
    summary: Summary;
    indexing: boolean;
}

export class HomeView extends React.Component<HomeViewProps, HomeViewState> {
    showSelectedFileModal = React.createRef<ShowSelectedFileModal>();

    constructor(props) {
        super(props);

        this.state = {
            summary: null,
            indexing: false
        };

        this.fetchSummary();
    }

    render() {
        return (
            <div>
                <div className="pt-3 pb-2 mb-3 border-bottom">
                    <h1 className="h2">Home</h1>
                </div>

                {this.renderSummary()}
            </div>
        );
    }

    renderSummary() {
        let summary = this.state.summary;
        if (summary == null) {
            return null;
        }

        return (
            <div>
                <ShowSelectedFileModal ref={this.showSelectedFileModal} onError={this.props.onError} />

                <div className="row row-spacing">
                    <div className="col col-6">
                        <h3>Code summary</h3>
                        <ul>
                            <li>Number of revisions: {summary.num_revisions}</li>
                            <li>Age: {humanizeDuration((summary.last_commit?.date - summary.first_commit?.date) * 1000)}</li>
                            <li>Total number of code lines: {summary.num_code_lines}</li>
                            <li>Total number of files: {summary.num_files}</li>
                            <li>Total number of modules: {summary.num_modules}</li>
                        </ul>
                    </div>

                    <div className="col col-6">
                        <h3>Top authors</h3>
                        <ol>
                            {
                                summary.top_authors.map((author, index) =>
                                    <li key={index}>{author.name}: {author.num_revisions}</li>
                                )
                            }
                        </ol>
                    </div>
                </div>

                <div className="row row-spacing">
                    <div className="col col-6">
                        <h3>Last changed files</h3>
                        <ol>
                            {
                                summary.last_changed_files.map((file, index) =>
                                    <li key={index}>
                                        <Moment format="YYYY-MM-DD HH:mm:ss">{file.date * 1000.0}</Moment> - <span
                                            className="text-button"
                                            onClick={() => { this.showSelectedFileModal.current.show(file.name); }}
                                        >
                                            {file.name}
                                        </span>
                                    </li>
                                )
                            }
                        </ol>
                    </div>

                    <div className="col col-6">
                        <h3>Top code files</h3>
                        <ol>
                            {
                                summary.top_code_files.map((file, index) =>
                                    <li key={index}>
                                        <span
                                            className="text-button"
                                            onClick={() => { this.showSelectedFileModal.current.show(file.name); }}
                                        >
                                            {file.name}
                                        </span>: {file.num_code_lines}
                                    </li>
                                )
                            }
                        </ol>
                    </div>
                </div>

                <div className="row row-spacing">
                    <div className="col col-4"></div>
                    <div className="col col-4">
                        <button
                            className="btn btn-primary btn-lg"
                            style={{ marginRight: "1em" }}
                            onClick={() => { this.reloadData(); }}
                        >
                            Reload data
                        </button>

                        <button
                            className="btn btn-primary btn-lg"
                            onClick={() => { this.reindexData(); }}
                            disabled={this.state.indexing}
                        >
                            <Conditional
                                condition={!this.state.indexing}
                                trueBranch={() =>
                                    <span>Reindex data</span>
                                }
                                falseBranch={() =>
                                    <span>
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                                        Reindexing...
                                    </span>
                                }
                            />
                        </button>
                    </div>
                    <div className="col col-4"></div>
                </div>
            </div>
        );
    }

    fetchSummary() {
        axios.get(`/api/summary`)
            .then(response => {
                this.setState({
                    summary: response.data
                });
            })
            .catch(error => {
                this.props.onError(error);
            });
    }

    reloadData() {
        axios.put(`/api/state/reload`)
            .then(response => {
                this.fetchSummary();
            })
            .catch(error => {
                this.props.onError(error);
            });
    }

    reindexData() {
        this.setState({
            indexing: true
        });

        axios.put(`/api/state/reindex`)
            .then(response => {
                this.setState({
                    indexing: false
                });

                this.fetchSummary();
            })
            .catch(error => {
                this.setState({
                    indexing: false
                });

                this.props.onError(error);
            });
    }
}