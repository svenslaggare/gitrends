import React from "react";
import axios from "axios";

import {EntryType, EntryTypeSwitcher, Table} from "../helpers/view";
import {capitalize, OnError} from "../helpers/misc";
import {ShowSelectedFileModal} from "../helpers/selectedFileModal";
import {AppConfig} from "../config";
import {SumOfCouplingEntry} from "../model";

interface SumOfCouplingViewProps {
    config: AppConfig;

    initialEntryType: EntryType
    onError: OnError;
}

interface SumOfCouplingViewState {
    entryType: EntryType;

    sumOfCouplings: SumOfCouplingEntry[];

    selectedName: string;
}

export class SumOfCouplingView extends React.Component<SumOfCouplingViewProps, SumOfCouplingViewState> {
    showSelectedFileModal = React.createRef<ShowSelectedFileModal>();

    constructor(props) {
        super(props);

        this.state = {
            entryType: this.props.initialEntryType ?? EntryType.File,
            sumOfCouplings: [],
            selectedName: null
        };

        this.fetchAll();
    }

    render() {
        let entryType = this.entryTypeName();

        return (
            <div>
                <ShowSelectedFileModal ref={this.showSelectedFileModal} onError={this.props.onError}/>

                <div className="pt-3 pb-2 mb-3 border-bottom">
                    <EntryTypeSwitcher
                        current={this.state.entryType}
                        onChange={entryType => {
                            this.showSelectedFileModal.current.clear();

                            this.setState(
                                {
                                    entryType: entryType,
                                    sumOfCouplings: []
                                },
                                () => {
                                    this.fetchAll();
                                }
                            );
                        }}
                    />

                    <h1 className="h2">Sum of couplings</h1>
                </div>

                <Table
                    columns={[
                        {
                            name: "name",
                            display: capitalize(`${entryType} name`),
                            clickable: this.state.entryType == EntryType.File
                        },
                        {name: "sum_of_couplings", display: "Sum of couplings", clickable: false},
                    ]}
                    rows={this.state.sumOfCouplings}
                    extractColumn={(row, name) => row[name]}
                    onValueClick={(row, column) => {
                        if (column == "name") {
                            this.showSelectedFileModal.current.show(row[column]);
                        }
                    }}
                    initialSortOrder={{
                        columnIndex: 1,
                        order: -1
                    }}
                />
            </div>
        );
    }


    fetchAll() {
        axios.get(`/api/${this.entryTypeName()}/sum-of-couplings?count=${this.props.config.changeCouplingMaxEntries}`)
            .then(response => {
                this.setState({
                    sumOfCouplings: response.data
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