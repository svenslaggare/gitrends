import React from "react";

import axios from "axios";

import {fetchFileHistory, FileHistory, Hotspot} from "../model";
import {EntryType, EntryTypeSwitcher, SelectedFileModal, Table} from "../viewHelpers";
import {capitalize, OnError} from "../helpers";

interface HotspotViewProps {
    initialEntryType: EntryType;
    onError: OnError;
}

interface HotspotViewState {
    entryType: EntryType;

    hotspots: Hotspot[];
    selectedFile: FileHistory;
}

export class HotspotView extends React.Component<HotspotViewProps, HotspotViewState> {
    showFileModal: any;

    constructor(props) {
        super(props);

        this.state = {
            entryType: this.props.initialEntryType ?? EntryType.File,
            hotspots: [],
            selectedFile: null
        };

        this.fetchAll();
    }

    render() {
        return (
            <div>
                <SelectedFileModal name="selectedFileModal" selectedFile={this.state.selectedFile} />

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
                    columns={{
                        "name": {
                            display: `${capitalize(this.entryTypeName())} name`,
                            clickable: this.state.entryType == EntryType.File
                        },
                        "num_revisions": { display: "Number of revisions", clickable: false },
                        "num_code_lines": { display: "Number of code lines", clickable: false },
                        "total_indent_levels": { display: "Complexity", clickable: false }
                    }}
                    rows={this.state.hotspots}
                    extractColumn={(row, name) => row[name]}
                    onValueClick={(rowIndex, column) => {
                        if (column == "name") {
                            this.showSelectedFileModal(this.state.hotspots[rowIndex][column]);
                        }
                    }}
                />
            </div>
        );
    }

    showSelectedFileModal(fileName: string) {
        fetchFileHistory(
            fileName,
            fileHistory => {
                this.setState({
                    selectedFile: fileHistory
                });

                // @ts-ignore
                this.showFileModal = new bootstrap.Modal(document.getElementById("showFileModal"));
                this.showFileModal.show();
            },
            error => {
                this.props.onError(error);
            }
        );
    }

    fetchAll() {
        axios.get(`/api/${this.entryTypeName()}/hotspots`)
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