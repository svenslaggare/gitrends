import React from "react";
import axios from "axios";
import Moment from "react-moment";

import {GitLogEntry} from "../model";
import {AlertBox, Conditional} from "../helpers/view";
import {OnError} from "../helpers/misc";
import humanizeDuration from "humanize-duration";
import {AppConfig} from "../config";

interface TimelineViewProps {
    config: AppConfig;

    onError: OnError;
}

interface TimelineViewState {
    gitLog: GitLogEntry[];
    seekMinDate: number;
    seekMaxDate: number;

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
            seekMinDate: null,
            seekMaxDate: null,

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

        let minDate = this.state.gitLog[0].date;
        let maxDate = this.state.gitLog[this.state.gitLog.length - 1].date;

        return (
            <div>
                <div className="d-flex justify-content-center">
                    <b>Time period: {humanizeDuration((this.state.maxCommit?.date - this.state.minCommit?.date) * 1000.0)}</b>
                </div>

                <input
                    type="range" className="form-range" id="minDate" title="The minimum date"
                    min={minDate}
                    max={maxDate}
                    value={this.state.seekMinDate}
                    onChange={event => {
                        let date = parseInt(event.target.value);
                        if (this.state.maxCommit != null) {
                            date = Math.min(date, this.state.maxCommit.date);
                        }

                        this.setState({
                            seekMinDate: date,
                            minCommit: this.findClosestCommit(date)
                        });
                    }}
                />

                <input
                    type="range" className="form-range" id="maxDate" title="The maximum date"
                    min={minDate}
                    max={maxDate}
                    value={this.state.seekMaxDate}
                    onChange={event => {
                        let date = parseInt(event.target.value);
                        if (this.state.minCommit != null) {
                            date = Math.max(date, this.state.minCommit.date);
                        }

                        this.setState({
                            seekMaxDate: date,
                            maxCommit: this.findClosestCommit(date)
                        });
                    }}
                />

                <div className="row">
                    <div className="col col-6">
                        <h3>Minimum date</h3>
                        <Commit commit={this.state.minCommit} />
                    </div>
                    <div className="col col-6">
                        <h3>Maximum date</h3>
                        <Commit commit={this.state.maxCommit} />
                    </div>
                </div>

                <br/>

                <div className="d-flex justify-content-center">
                    <button
                        className="btn btn-primary btn-lg"
                        style={{margin: "5px"}}
                        onClick={() => {
                            this.reset();
                        }}
                    >
                        Reset
                    </button>
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
                        savedMaxDate: response.data.max_date
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
        let savedMinDate = this.state.savedMinDate;
        if (savedMinDate == null && this.state.gitLog.length > 0) {
            savedMinDate = this.state.gitLog[0].date;
        }

        if (savedMinDate == null) {
            savedMinDate = 0;
        }

        let savedMaxDate = this.state.savedMaxDate;
        if (savedMaxDate == null && this.state.gitLog.length > 0) {
            savedMaxDate = this.state.gitLog[this.state.gitLog.length - 1].date;
        }

        if (savedMaxDate == null) {
            savedMinDate = new Date().getTime() / 1000.0;
        }

        this.setState({
            seekMinDate: savedMinDate,
            minCommit: this.findClosestCommit(savedMinDate),

            seekMaxDate: savedMaxDate,
            maxCommit: this.findClosestCommit(savedMaxDate),
        });
    }

    reset() {
        this.setState({
            seekMinDate: this.state.savedMinDate,
            minCommit: this.findClosestCommit(this.state.savedMinDate)
        });

        this.setState({
            seekMaxDate: this.state.savedMaxDate,
            minCommit: this.findClosestCommit(this.state.savedMaxDate)
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
        <Conditional
            condition={commit != null}
            trueBranch={() =>
                <div>
                    <b>
                        {commit.revision} by {commit.author} at <Moment format="YYYY-MM-DD HH:mm:ss">{commit.date * 1000.0}</Moment>
                    </b>
                    <div style={{whiteSpace: "pre-wrap"}}>{commit.commit_message}</div>
                </div>
            }
            falseBranch={() => null}
        />
    );
}