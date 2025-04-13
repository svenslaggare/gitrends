import React from "react";
import axios from "axios";

import {FileEntry} from "../model";
import {OnError} from "./misc";
import {Table} from "./view";

interface ShowSelectedModuleModalProps {
    onError: OnError;
}

interface ShowSelectedModuleModalState {
    moduleName: string;
    files: FileEntry[];
}

export class ShowSelectedModuleModal extends React.Component<ShowSelectedModuleModalProps, ShowSelectedModuleModalState> {
    private modal: any = null;

    constructor(props) {
        super(props);

        this.state = {
            moduleName: null,
            files: null
        };
    }

    render() {
        return (
            <SelectedModuleModal
                name={"selectedModuleModal"}
                moduleName={this.state.moduleName}
                files={this.state.files}
                onClose={() => {
                    this.modal.hide();
                }}
            />
        );
    }

    show(fileName: string) {
        this.fetchModuleFiles(fileName);
    }

    fetchModuleFiles(moduleName: string) {
        axios.get(`/api/module/files/${moduleName}`)
            .then(response => {
                this.setState({
                    moduleName: moduleName,
                    files: response.data
                }, () => {
                    this.tryShow();
                });
            })
            .catch(error => {
                this.props.onError(error);
            });
    }

    tryShow() {
        if (this.state.files != null) {
            if (this.modal == null) {
                // @ts-ignore
                this.modal = new bootstrap.Modal(document.getElementById("selectedModuleModal"));
            }

            this.modal.show();
        }
    }

    clear() {
        this.setState({
            files: null,
        });
    }
}

export interface SelectedModuleModalProps {
    name: string;
    moduleName: string;
    files: FileEntry[];
    onClose: () => void;
}

export function SelectedModuleModal({ name, moduleName, files, onClose }: SelectedModuleModalProps) {
    let renderContent = () => {
        if (files == null) {
            return null;
        }

        return (
            <div className="modal-dialog">
                <div className="modal-content">
                    <div className="modal-header">
                        <h1 className="modal-title fs-5" id={`${name}Label`}>
                            {moduleName}
                        </h1>
                        <button type="button" className="btn-close" onClick={() => { onClose(); }} />
                    </div>
                    <div className="modal-body">
                        <h3>Module files</h3>
                        <Table
                            columns={[
                                { name: "name", display: "File name", clickable: false },
                                { name: "num_code_lines", display: "Number of code lines", clickable: false },
                                { name: "total_indent_levels", display: "Complexity", clickable: false }
                            ]}
                            rows={files}
                            extractColumn={(row: FileEntry, name) => row[name]}
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
        <div className="modal" id={name} tabIndex={-1} aria-labelledby={`${name}Label`} aria-hidden="true">
            {renderContent()}
        </div>
    );
}