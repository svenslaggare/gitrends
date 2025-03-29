import React from "react";

import axios from "axios";

import {FileHistoryEntry, Hotspot} from "../model";
import {CodeComplexityTimeChart, EntryType, EntryTypeSwitcher, Table} from "../viewHelpers";
import {capitalize} from "../helpers";

interface HotspotViewProps {

}

interface HotspotViewState {
    entryType: EntryType;

    hotspots: Hotspot[];
    selectedFile: SelectedFile;
}

export class HotspotView extends React.Component<HotspotViewProps, HotspotViewState> {
    showFileModal: any;

    constructor(props) {
        super(props);

        this.state = {
            entryType: EntryType.File,
            hotspots: [],
            selectedFile: null
        };

        this.fetchAll();
    }

    render() {
        return (
            <div>
                {this.renderSelectedFile()}
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
        this.fetchFileHistory(fileName);
    }

    renderSelectedFile() {
        let renderContent = () => {
            if (this.state.selectedFile == null) {
                return null;
            }

            return (
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h1 className="modal-title fs-5" id="showFileModalLabel">{this.state.selectedFile.name}</h1>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <CodeComplexityTimeChart data={this.state.selectedFile.history} />
                        </div>
                    </div>
                </div>
            );
        };

        return (
            <div className="modal" id="showFileModal" tabIndex={-1} aria-labelledby="showFileModalLabel" aria-hidden="true">
                {renderContent()}
            </div>
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
                console.log(error);
            });
    }

    fetchFileHistory(fileName: string) {
        axios.get(`/api/file/history/${fileName}`)
            .then(response => {
                this.setState({
                    selectedFile: {
                        name: fileName,
                        history: response.data
                    }
                });

                // @ts-ignore
                this.showFileModal = new bootstrap.Modal(document.getElementById("showFileModal"));
                this.showFileModal.show();
            })
            .catch(error => {
                console.log(error);
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

interface SelectedFile {
    name: string;
    history: FileHistoryEntry[];
}