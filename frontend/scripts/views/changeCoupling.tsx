import React from "react";
import axios from "axios";

import {ChangeCoupling} from "../model";
import {EntryType, EntryTypeSwitcher, Table} from "../helpers/view";
import {OnError} from "../helpers/misc";
import {ShowSelectedFileModal} from "../helpers/selectedFileModal";
import {AutoCompleteInput} from "../helpers/autoCompleteInput";

interface ChangeCouplingViewProps {
    initialEntryType: EntryType
    onError: OnError;
    autoCompletionFiles: string[];
    autoCompletionModules: string[];
}

interface ChangeCouplingViewState {
    entryType: EntryType;

    allChangeCoupling: ChangeCoupling[];
    specificChangeCoupling: ChangeCoupling[];

    selectedName: string;
}

export class ChangeCouplingView extends React.Component<ChangeCouplingViewProps, ChangeCouplingViewState> {
    showSelectedFileModal = React.createRef<ShowSelectedFileModal>();

    constructor(props) {
        super(props);

        this.state = {
            entryType: this.props.initialEntryType ?? EntryType.File,
            allChangeCoupling: [],
            specificChangeCoupling: [],
            selectedName: null
        };

        this.fetchAll();
    }

    render() {
        let changeCoupling = this.getChangeCoupling();
        let entryType = this.entryTypeName();

        return (
            <div>
                <ShowSelectedFileModal ref={this.showSelectedFileModal} onError={this.props.onError}/>

                <div className="pt-3 pb-2 mb-3 border-bottom">
                    {
                        this.state.specificChangeCoupling.length > 0 ?
                            <button
                                type="button" className="btn-close" aria-label="Close"
                                style={{float: "right", padding: "10px"}}
                                onClick={() => {
                                    this.showSelectedFileModal.current.clear();

                                    this.setState({
                                        specificChangeCoupling: [],
                                        selectedName: null
                                    });
                                }}
                            />
                            : null
                    }

                    <EntryTypeSwitcher
                        current={this.state.entryType}
                        onChange={entryType => {
                            this.showSelectedFileModal.current.clear();

                            this.setState(
                                {
                                    entryType: entryType,
                                    allChangeCoupling: [],
                                    specificChangeCoupling: [],
                                    selectedName: null,
                                },
                                () => {
                                    this.fetchAll();
                                }
                            );
                        }}
                    />

                    <h1 className="h2">Change coupling</h1>
                </div>

                <AutoCompleteInput
                    placeholder={"Enter entry to show results for."}
                    completions={
                        this.state.entryType == EntryType.Module ? this.props.autoCompletionModules: this.props.autoCompletionFiles
                    }
                    onShow={fileName => {
                        this.fetchForEntry(fileName);
                    }}
                />
                <br />

                <Table
                    columns={[
                        {name: "left_name", display: `Left ${entryType} name`, clickable: true},
                        {name: "right_name", display: `Right ${entryType} name`, clickable: true},
                        {name: "coupled_revisions", display: "Number of coupled revisions", clickable: false},
                        {name: "average_revisions", display: "Average number of revisions", clickable: false},
                        {name: "coupling_ratio", display: "Amount of coupling (%)", clickable: false}
                    ]}
                    rows={changeCoupling}
                    extractColumn={(row: ChangeCoupling, name) => {
                        let averageRevisions = Math.ceil((row.num_left_revisions + row.num_right_revisions) / 2.0);
                        switch (name) {
                            case "average_revisions":
                                return averageRevisions;
                            case "coupling_ratio":
                                return Math.round((100.0 * (row.coupled_revisions / averageRevisions)) * 10.0) / 10.0;
                            default:
                                return row[name];
                        }
                    }}
                    onValueClick={(rowIndex, column) => {
                        switch (column) {
                            case "left_name":
                                let newName = changeCoupling[rowIndex][column];
                                if (this.state.selectedName == newName && this.state.entryType == EntryType.File) {
                                    this.showSelectedFileModal.current.show(newName);
                                } else {
                                    this.fetchForEntry(newName);
                                }

                                break;
                            case "right_name":
                                this.fetchForEntry(changeCoupling[rowIndex][column]);
                                break;
                        }
                    }}
                    initialSortOrder={{
                        columnIndex: 2,
                        order: -1
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

    fetchForEntry(name: string) {
        axios.get(`/api/${this.entryTypeName()}/change-coupling?name=${name}`)
            .then(response => {
                this.setState({
                    selectedName: name,
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