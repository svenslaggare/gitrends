import React from "react";
import axios from "axios";

import {ChangeCoupling} from "../model";
import {EntryType, EntryTypeSwitcher, Table} from "../viewHelpers";

interface ChangeCouplingViewProps {
    initialEntryType: EntryType
    onError: (response: any) => void;
}

interface ChangeCouplingViewState {
    entryType: EntryType;

    allChangeCoupling: ChangeCoupling[];
    specificChangeCoupling: ChangeCoupling[];
}

export class ChangeCouplingView extends React.Component<ChangeCouplingViewProps, ChangeCouplingViewState> {
    constructor(props) {
        super(props);

        this.state = {
            entryType: this.props.initialEntryType ?? EntryType.File,
            allChangeCoupling: [],
            specificChangeCoupling: []
        };

        this.fetchAll();
    }

    render() {
        let changeCoupling = this.getChangeCoupling();
        let entryType = this.entryTypeName();

        return (
            <div>
                <div className="pt-3 pb-2 mb-3 border-bottom">
                    {
                        this.state.specificChangeCoupling.length > 0 ?
                            <button
                                type="button" className="btn-close" aria-label="Close" style={{ float: "right", padding: "10px" }}
                                onClick={() => {
                                    this.setState({specificChangeCoupling: []});
                                }}
                            />
                            : null
                    }

                    <EntryTypeSwitcher
                        current={this.state.entryType}
                        onChange={entryType => {
                            this.setState(
                                {
                                    entryType: entryType,
                                    allChangeCoupling: [],
                                    specificChangeCoupling: [],
                                },
                                () => {
                                    this.fetchAll();
                                }
                            );
                        }}
                    />

                    <h1 className="h2">Change coupling</h1>
                </div>

                <Table
                    columns={{
                        "left_name": {display: `Left ${entryType} name`, clickable: true},
                        "right_name": {display: `Right ${entryType} name`, clickable: true},
                        "coupled_revisions": {display: "Number of coupled revisions", clickable: false},
                        "average_revisions": {display: "Average number of revisions", clickable: false },
                        "coupling_ratio": { display: "Amount of coupling (%)", clickable: false }
                    }}
                    rows={changeCoupling}
                    extractColumn={(row: ChangeCoupling, name) => {
                        let averageRevisions = Math.ceil((row.num_left_revisions + row.num_right_revisions) / 2.0);
                        switch (name) {
                            case "average_revisions":
                                return averageRevisions;
                            case "coupling_ratio":
                                return (100.0 * (row.coupled_revisions / averageRevisions)).toFixed(1);
                            default:
                                return row[name];
                        }
                    }}
                    onValueClick={(rowIndex, column) => {
                        switch (column) {
                            case "left_name":
                            case "right_name":
                                this.fetchForFile(changeCoupling[rowIndex][column]);
                                break;
                        }
                    }}
                />
            </div>
        );
    }

    getChangeCoupling() {
        if (this.state.specificChangeCoupling.length > 0) {
            return this.state.specificChangeCoupling;
        } else {
            return this.state.allChangeCoupling;
        }
    }

    fetchAll() {
        axios.get(`/api/${this.entryTypeName()}/change-coupling`)
            .then(response => {
                this.setState({
                    allChangeCoupling: response.data
                });
            })
            .catch(error => {
                this.props.onError(error);
            });
    }

    fetchForFile(fileName: string) {
        axios.get(`/api/${this.entryTypeName()}/change-coupling?name=${fileName}`)
            .then(response => {
                this.setState({
                    specificChangeCoupling: response.data
                });
            })
            .catch(error => {
                this.props.onError(error);
            });
    }

    entryTypeName() {
        switch (this.state.entryType) {
            case EntryType.File:
                return "file";
            case EntryType.Module:
                return "module";
        }
    }
}