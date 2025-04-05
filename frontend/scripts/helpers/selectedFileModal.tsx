import React from "react";

import {fetchFileHistory, FileHistory} from "../model";
import {CodeComplexityTimeChart} from "./charts";
import {OnError} from "./misc";

interface ShowSelectedFileModalProps {
    onError: OnError;
}

interface ShowSelectedFileModalState {
    fileHistory: FileHistory
}

export class ShowSelectedFileModal extends React.Component<ShowSelectedFileModalProps, ShowSelectedFileModalState> {
    private modal: any = null;

    constructor(props) {
        super(props);

        this.state = {
            fileHistory: null
        };
    }

    render() {
        return <SelectedFileModal name="selectedFileModal" selectedFile={this.state.fileHistory} />;
    }

    show(fileName: string) {
        fetchFileHistory(
            fileName,
            fileHistory => {
                this.setState({
                    fileHistory: fileHistory
                });

                // @ts-ignore
                this.modal = new bootstrap.Modal(document.getElementById("showFileModal"));
                this.modal.show();
            },
            error => {
                this.props.onError(error);
            }
        );
    }

    clear() {
        this.setState({
            fileHistory: null
        });
    }
}

export function SelectedFileModal({ name, selectedFile }: { name: string; selectedFile: FileHistory }) {
    let renderContent = () => {
        if (selectedFile == null) {
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