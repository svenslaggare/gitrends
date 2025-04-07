import React from "react";

import axios from "axios";

import {EntryType, EntryTypeSwitcher, Table} from "../helpers/view";
import {OnError, shortenName} from "../helpers/misc";
import {MainDeveloperEntry} from "../model";
import {HistogramChart} from "../helpers/charts";

interface MainDeveloperViewProps {
    onError: OnError;
}

interface MainDeveloperViewState {
    mainDeveloperFiles: MainDeveloperEntry[];
}

export class MainDeveloperView extends React.Component<MainDeveloperViewProps, MainDeveloperViewState> {
    constructor(props) {
        super(props);

        this.state = {
            mainDeveloperFiles: []
        };

        this.fetch();
    }

    render() {
        let mainDeveloperHistogram = new Map<string, number>();
        for (let entry of this.state.mainDeveloperFiles) {
            let name = shortenName(entry.main_developer);
            let count = mainDeveloperHistogram.get(name) ?? 0;
            mainDeveloperHistogram.set(name, count + 1);
        }

        let mainDeveloperFiles = [...this.state.mainDeveloperFiles]
            .filter(entry => entry.net_added_lines > 100);

        return (
            <div>
                <div className="pt-3 pb-2 mb-3 border-bottom">
                    <h1 className="h2">Main developer</h1>
                </div>

                <h3>Histogram</h3>
                <HistogramChart
                    data={mainDeveloperHistogram}
                    label={"files"}
                    max={13}
                    normalized={true}
                />

                <h3 style={{ marginTop: "3em" }}>Files with highest ownership</h3>

                <Table
                    columns={[
                        { name: "name", display: "File name", clickable: false },
                        { name: "main_developer", display: "Main developer", clickable: false },
                        { name: "ownership", display: "Ownership (%)", clickable: false },
                        { name: "net_added_lines", display: "Net added lines", clickable: false },
                        { name: "total_net_added_lines", display: "Total net added lines", clickable: false },
                    ]}
                    rows={mainDeveloperFiles}
                    extractColumn={(row, name) => {
                        if (name == "ownership") {
                            return Math.round(100.0 * (row["net_added_lines"] / row["total_net_added_lines"]) * 10.0) / 10.0;
                        } else {
                            return row[name];
                        }
                    }}
                    initialSortOrder={{ columnIndex: 2, order: -1 }}
                />
            </div>
        );
    }

    fetch() {
        axios.get(`/api/file/main-developer`)
            .then(response => {
                this.setState({
                    mainDeveloperFiles: response.data
                });
            })
            .catch(error => {
                this.props.onError(error);
            });
    }
}