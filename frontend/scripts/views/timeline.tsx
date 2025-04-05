import React from "react";
import axios from "axios";
import Moment from "react-moment";

import {GitLogEntry} from "../model";
import {AlertBox, Conditional} from "../helpers/view";
import {OnError} from "../helpers/misc";

interface TimelineViewProps {
    onError: OnError;
}

interface TimelineViewState {
    gitLog: GitLogEntry[];
    seekDate: number;

    savedMinDate: number;
    savedMaxDate: number;

    minCommit: GitLogEntry;
    maxCommit: GitLogEntry;

    status: string;
}

export class TimelineView extends React.Component<TimelineViewProps, TimelineViewState> {
    constructor(props) {
        super(props);

        this.state = {
            gitLog: [],
            seekDate: null,

            savedMinDate: null,
            savedMaxDate: null,

            minCommit: null,
            maxCommit: null,

            status: null
        };

        this.fetchGitLog()
        this.fetchValidDate();
    }

    render() {
        return (
            <div>
                <AlertBox
                    className="alert-success"
                    message={this.state.status}
                    onClose={() => { this.setState({ status: null }); }}
                />

                <div className="pt-3 pb-2 mb-3 border-bottom">
                    <h1 className="h2">
                        Timeline
                        <i className="fa-solid fa-floppy-disk action-icon"
                           style={{ marginLeft: "5px", fontSize: "20px", verticalAlign: "middle" }}
                           onClick={() => { this.save(); }}
                        />
                    </h1>
                </div>

                {this.renderTimeline()}
            </div>
        );
    }

    renderTimeline() {
        if (this.state.gitLog.length == 0) {
            return null;
        }

        let bestCommit = this.findClosestCommit(this.state.seekDate);

        return (
            <div>
                <Conditional
                    condition={this.state.minCommit != null}
                    trueBranch={() =>
                        <b><Commit commit={this.state.minCommit} /></b>
                    }
                    falseBranch={() => null}
                />

                <Conditional
                    condition={this.state.maxCommit != null}
                    trueBranch={() =>
                        <span> - <b><Commit commit={this.state.maxCommit} /></b></span>
                    }
                    falseBranch={() => null}
                />

                <br />
                <br />

                <input
                    type="range" className="form-range" id="minDate"
                    min={this.state.gitLog[0].date}
                    max={this.state.gitLog[this.state.gitLog.length - 1].date}
                    defaultValue={this.state.seekDate}
                    onChange={event => { this.setState({ seekDate: parseInt(event.target.value) }); }}
                />

                <b><Commit commit={bestCommit}/></b> <br />
                <div style={{whiteSpace: "pre-wrap"}}>{bestCommit.commit_message}</div>

                <br />

                <div className="d-flex justify-content-center">
                    <button
                        className="btn btn-primary btn-lg"
                        style={{ margin: "5px" }}
                        onClick={() => {
                            this.setState({ minCommit: this.findClosestCommit(this.state.seekDate) });
                        }}
                    >
                        Set as minimum
                    </button>

                    <button
                        className="btn btn-primary btn-lg"
                        style={{ margin: "5px" }}
                        onClick={() => {
                            this.setState({ maxCommit: this.findClosestCommit(this.state.seekDate) });
                        }}
                    >
                        Set as maximum
                    </button>

                    <button
                        className="btn btn-primary btn-lg"
                        style={{ margin: "5px" }}
                        onClick={() => {
                            this.setState({ minCommit: null, maxCommit: null });
                        }}
                    >
                        Clear
                    </button>

                    <br />
                </div>
            </div>
        );
    }

    findClosestCommit(date: number): GitLogEntry {
        if (date == null) {
            return null;
        }

        let bestCommit = null;
        let bestTimeDiff = 10000000000000;
        for (let commit of this.state.gitLog) {
            let diff = Math.abs(commit.date - date);
            if (diff < bestTimeDiff) {
                bestTimeDiff = diff;
                bestCommit = commit;
            }
        }

        return bestCommit;
    }

    fetchValidDate() {
        axios.get(`/api/state/valid-date`)
            .then(response => {
                this.setState(
                    {
                        savedMinDate: response.data.min_date,
                        savedMaxDate: response.data.max_date,
                        seekDate: response.data.min_date ?? 0
                    },
                    () => {
                        this.updateValidCommits();
                    }
                );
            })
            .catch(error => {
                this.props.onError(error);
            });
    }

    fetchGitLog() {
        axios.get(`/api/git/log`)
            .then(response => {
                let gitLog: GitLogEntry[] = response.data;
                this.setState(
                    {
                        gitLog: gitLog,
                        seekDate: this.state.seekDate ?? gitLog[0].date
                    },
                    () => {
                        this.updateValidCommits();
                    }
                );
            })
            .catch(error => {
                this.props.onError(error);
            });
    }

    updateValidCommits() {
        this.setState({
            minCommit: this.findClosestCommit(this.state.savedMinDate),
            maxCommit: this.findClosestCommit(this.state.savedMaxDate)
        });
    }

    save() {
        let data = {
            "min_date": this.state.minCommit?.date ?? null,
            "max_date": this.state.maxCommit?.date ?? null
        };

        axios.put(`/api/state/valid-date`, data)
            .then(response => {
                this.setState({
                    status: "Updated."
                });
            })
            .catch(error => {
                this.props.onError(error);
            });
    }
}

function Commit({ commit }: { commit: GitLogEntry }) {
    return (
        <span>
            {commit.revision} by {commit.author} at <Moment format="YYYY-MM-DD HH:mm:ss">{commit.date * 1000.0}</Moment>
        </span>
    );
}