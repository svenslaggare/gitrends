import React from "react";

import axios from "axios";

import {EntryType, EntryTypeSwitcher, Table} from "../helpers/view";
import {capitalize, OnError, shortenName} from "../helpers/misc";
import {MainDeveloperEntry} from "../model";
import {HistogramChart} from "../helpers/charts";

interface MainDeveloperViewProps {
    initialEntryType: EntryType
    onError: OnError;
}

interface MainDeveloperViewState {
    entryType: EntryType;
    mainDeveloperEntries: MainDeveloperEntry[];
}

export class MainDeveloperView extends React.Component<MainDeveloperViewProps, MainDeveloperViewState> {
    constructor(props) {
        super(props);

        this.state = {
            entryType: this.props.initialEntryType ?? EntryType.File,
            mainDeveloperEntries: []
        };

        this.fetch();
    }

    render() {
        let mainDeveloperHistogram = new Map<string, number>();
        for (let entry of this.state.mainDeveloperEntries) {
            let name = shortenName(entry.main_developer);
            let count = mainDeveloperHistogram.get(name) ?? 0;
            mainDeveloperHistogram.set(name, count + 1);
        }

        let mainDeveloperEntries = [...this.state.mainDeveloperEntries]
            .filter(entry => entry.net_added_lines > 100)
            .slice(0, 100);

        return (
            <div>
                <div className="pt-3 pb-2 mb-3 border-bottom">
                    <EntryTypeSwitcher
                        current={this.state.entryType}
                        onChange={entryType => {
                            this.setState(
                                {
                                    entryType: entryType,
                                    mainDeveloperEntries: []
                                },
                                () => {
                                    this.fetch();
                                }
                            );
                        }}
                    />

                    <h1 className="h2">Main developer</h1>
                </div>

                <h3>Histogram</h3>
                <HistogramChart
                    data={mainDeveloperHistogram}
                    max={13}
                    normalized={true}
                />

                <h3 style={{ marginTop: "1em" }}>{capitalize(this.entryTypeName())}s with highest singular ownership</h3>

                <Table
                    columns={[
                        { name: "name", display: `${capitalize(this.entryTypeName())} name`, clickable: false },
                        { name: "main_developer", display: "Main developer", clickable: false },
                        { name: "ownership", display: "Ownership (%)", clickable: false },
                        { name: "net_added_lines", display: "Net added lines", clickable: false },
                        { name: "total_net_added_lines", display: "Total net added lines", clickable: false },
                    ]}
                    rows={mainDeveloperEntries}
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
        axios.get(`/api/${this.entryTypeName()}/main-developer`)
            .then(response => {
                this.setState({
                    mainDeveloperEntries: response.data
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