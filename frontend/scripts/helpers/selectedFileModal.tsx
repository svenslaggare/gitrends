import React from "react";
import axios from "axios";

import {ChangeCoupling, changeCouplingTableRow, FileHistory} from "../model";
import {CodeComplexityTimeChart} from "./charts";
import {OnError} from "./misc";
import {EntryType, Table} from "./view";

interface ShowSelectedFileModalProps {
    onError: OnError;
}

interface ShowSelectedFileModalState {
    fileHistory: FileHistory;
    changeCoupling: ChangeCoupling[];
}

export class ShowSelectedFileModal extends React.Component<ShowSelectedFileModalProps, ShowSelectedFileModalState> {
    private modal: any = null;

    constructor(props) {
        super(props);

        this.state = {
            fileHistory: null,
            changeCoupling: null
        };
    }

    render() {
        return (
            <SelectedFileModal
                name="selectedFileModal"
                selectedFile={this.state.fileHistory}
                changeCoupling={this.state.changeCoupling}
            />
        );
    }

    show(fileName: string) {
        this.fetchFileHistory(fileName);
        this.fetchChangeCoupling(fileName);
    }

    fetchFileHistory(fileName: string) {
        axios.get(`/api/file/history/${fileName}`)
            .then(response => {
                this.setState({
                    fileHistory: {
                        name: fileName,
                        history: response.data
                    }
                }, () => {
                    this.tryShow();
                });
            })
            .catch(error => {
                this.props.onError(error);
            });
    }

    fetchChangeCoupling(fileName: string) {
        axios.get(`/api/file/change-coupling?name=${fileName}&count=10`)
            .then(response => {
                this.setState({
                    changeCoupling: response.data
                }, () => {
                    this.tryShow();
                });
            })
            .catch(error => {
                this.props.onError(error);
            });
    }

    tryShow() {
        if (this.state.fileHistory != null && this.state.changeCoupling != null) {
            // @ts-ignore
            this.modal = new bootstrap.Modal(document.getElementById("showFileModal"));
            this.modal.show();
        }
    }

    clear() {
        this.setState({
            fileHistory: null,
            changeCoupling: null
        });
    }
}

export function SelectedFileModal({ name, selectedFile, changeCoupling }: { name: string; selectedFile: FileHistory; changeCoupling: ChangeCoupling[] }) {
    let renderContent = () => {
        if (selectedFile == null || changeCoupling == null) {
            return null;
        }

        return (
            <div className="modal-dialog">
                <div className="modal-content">
                    <div className="modal-header">
                        <h1 className="modal-title fs-5" id={`${name}Label`}>
                            {selectedFile.name} (revisions: {selectedFile.history.length})
                        </h1>
                        <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div className="modal-body">
                        <CodeComplexityTimeChart data={selectedFile.history} />

                        <h3 style={{ marginTop: "0.5em" }}>Top change coupling</h3>
                        <Table
                            columns={[
                                {name: "right_name", display: "Coupled file name name", clickable: false},
                                {name: "coupled_revisions", display: "Number of coupled revisions", clickable: false},
                                {name: "average_revisions", display: "Average number of revisions", clickable: false},
                                {name: "coupling_ratio", display: "Amount of coupling (%)", clickable: false}
                            ]}
                            rows={changeCoupling}
                            extractColumn={(row: ChangeCoupling, name) => changeCouplingTableRow(row, name)}
                            initialSortOrder={{
                                columnIndex: 1,
                                order: -1
                            }}
                        />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="modal" id="showFileModal" tabIndex={-1} aria-labelledby={`${name}Label`} aria-hidden="true">
            {renderContent()}
        </div>
    );
}