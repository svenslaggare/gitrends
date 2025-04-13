import React from "react";

import axios from "axios";

import {HotspotEntry} from "../model";
import {EntryType, EntryTypeSwitcher, Table} from "../helpers/view";
import {capitalize, OnError} from "../helpers/misc";
import {ShowSelectedFileModal} from "../helpers/selectedFileModal";
import {AppConfig} from "../config";
import {ShowSelectedModuleModal} from "../helpers/selectedModuleModal";

interface HotspotsViewProps {
    config: AppConfig;

    initialEntryType: EntryType;
    onError: OnError;
}

interface HotspotsViewState {
    entryType: EntryType;
    hotspots: HotspotEntry[];
}

export class HotspotsView extends React.Component<HotspotsViewProps, HotspotsViewState> {
    showSelectedFileModal = React.createRef<ShowSelectedFileModal>();
    showSelectedModuleModal = React.createRef<ShowSelectedModuleModal>();

    constructor(props) {
        super(props);

        this.state = {
            entryType: this.props.initialEntryType ?? EntryType.File,
            hotspots: []
        };

        this.fetchAll();
    }

    render() {
        return (
            <div>
                <ShowSelectedFileModal ref={this.showSelectedFileModal} onError={this.props.onError} />
                <ShowSelectedModuleModal ref={this.showSelectedModuleModal} onError={this.props.onError} />

                <div className="pt-3 pb-2 mb-3 border-bottom">
                    <EntryTypeSwitcher
                        current={this.state.entryType}
                        onChange={entryType => {
                            this.setState(
                                {
                                    entryType: entryType,
                                    hotspots: []
                                },
                                () => {
                                    this.fetchAll();
                                }
                            );
                        }}
                    />

                    <h1 className="h2">Hotspots</h1>
                </div>

                <Table
                    columns={[
                        {
                            name: "name",
                            display: `${capitalize(this.entryTypeName())} name`,
                            clickable: true
                        },
                        { name: "num_revisions", display: "Number of revisions", clickable: false },
                        { name: "num_authors", display: "Number of authors", clickable: false },
                        { name: "num_code_lines", display: "Number of code lines", clickable: false },
                        { name: "total_indent_levels", display: "Complexity", clickable: false }
                    ]}
                    rows={this.state.hotspots}
                    extractColumn={(row, name) => row[name]}
                    onValueClick={(row, column) => {
                        if (column == "name") {
                            switch (this.state.entryType) {
                                case EntryType.File:
                                    this.showSelectedFileModal.current.show(row[column]);
                                    break;
                                case EntryType.Module:
                                    this.showSelectedModuleModal.current.show(row[column]);
                                    break;
                            }
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
        axios.get(`/api/${this.entryTypeName()}/hotspots?count=${this.props.config.hotspotsMaxEntries}`)
            .then(response => {
                this.setState({
                    hotspots: response.data
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