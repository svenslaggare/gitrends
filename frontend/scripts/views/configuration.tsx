import React from "react";

import {AppConfig, DEFAULT_CONFIG, loadPersistedConfig, persistConfig} from "../config";

interface ConfigurationViewProps {
    config: AppConfig;
    changeConfig: (newConfig: AppConfig) => void;
}

interface ConfigurationViewState {

}

export class ConfigurationView extends React.Component<ConfigurationViewProps, ConfigurationViewState> {
    constructor(props) {
        super(props);

        this.state = {

        };
    }

    render() {
        return (
            <div>
                <div className="pt-3 pb-2 mb-3 border-bottom">
                    <h1 className="h2">Configuration</h1>
                </div>

                <ConfigSection label="Hotspots">
                    <RangeSlider
                        id="hotspotsMaxEntries" label="Max entries"
                        value={this.props.config.hotspotsMaxEntries} min={1} max={1000}
                        onChange={value => { this.changeConfig({ hotspotsMaxEntries: value }); }}
                    />
                </ConfigSection>

                <ConfigSection label="Change coupling">
                    <RangeSlider
                        id="changeCouplingMaxEntries" label="Max entries"
                        value={this.props.config.changeCouplingMaxEntries} min={1} max={1000}
                        onChange={value => { this.changeConfig({ changeCouplingMaxEntries: value }); }}
                    />
                </ConfigSection>

                <ConfigSection label="Sum of couplings">
                    <RangeSlider
                        id="sumOfCouplingsMaxEntries" label="Max entries"
                        value={this.props.config.sumOfCouplingsMaxEntries} min={1} max={1000}
                        onChange={value => { this.changeConfig({ sumOfCouplingsMaxEntries: value }); }}
                    />
                </ConfigSection>

                <ConfigSection label="Main developer">
                    <RangeSlider
                        id="mainDeveloperMaxEntries" label="Max entries"
                        value={this.props.config.mainDeveloperMaxEntries} min={1} max={1000}
                        onChange={value => { this.changeConfig({ mainDeveloperMaxEntries: value }); }}
                    />

                    <RangeSlider
                        id="mainDeveloperHistogramMaxDevelopers" label="Histogram max developers"
                        value={this.props.config.mainDeveloperHistogramMaxDevelopers} min={1} max={1000}
                        onChange={value => { this.changeConfig({ mainDeveloperHistogramMaxDevelopers: value }); }}
                    />

                    <CheckBox
                        id={"mainDeveloperHistogramNormalized"} label={"Histogram normalized"}
                        value={this.props.config.mainDeveloperHistogramNormalized}
                        onChange={value => { this.changeConfig({ mainDeveloperHistogramNormalized: value }); }}
                    />

                    <RangeSlider
                        id="mainDeveloperStructureMaxDevelopers" label="Structure max developers"
                        value={this.props.config.mainDeveloperStructureMaxDevelopers} min={1} max={1000}
                        onChange={value => { this.changeConfig({ mainDeveloperStructureMaxDevelopers: value }); }}
                    />
                </ConfigSection>

                <ConfigSection label="Commit spread">
                    <RangeSlider
                        id="commitSpreadMaxAuthors" label="Max authors"
                        value={this.props.config.commitSpreadMaxAuthors} min={1} max={1000}
                        onChange={value => { this.changeConfig({ commitSpreadMaxAuthors: value }); }}
                    />

                    <RangeSlider
                        id="commitSpreadMinNumModuleCommits" label="Min number of comits per module for include"
                        value={this.props.config.commitSpreadMinNumModuleCommits} min={1} max={1000}
                        onChange={value => { this.changeConfig({ commitSpreadMinNumModuleCommits: value }); }}
                    />
                </ConfigSection>

                <div className="d-flex justify-content-center" style={{ marginBottom: "3em" }}>
                    <button className="btn btn-success btn-lg button-spacing" onClick={() => { this.saveConfig() }}>
                        Save
                    </button>

                    <button className="btn btn-primary btn-lg button-spacing" onClick={() => { this.loadSaved(); }}>
                        Load saved
                    </button>

                    <button className="btn btn-primary btn-lg button-spacing" onClick={() => { this.loadDefault(); }}>
                        Load default
                    </button>
                </div>
            </div>
        );
    }

    changeConfig(changed: Partial<AppConfig>) {
        let newConfig = { ...this.props.config };
        for (let [key, value] of Object.entries(changed)) {
            newConfig[key] = value;
        }

        this.props.changeConfig(newConfig)
    }

    saveConfig() {
        persistConfig(this.props.config);
    }

    loadSaved() {
        this.props.changeConfig(loadPersistedConfig());
    }

    loadDefault() {
        this.props.changeConfig(DEFAULT_CONFIG);
    }
}

function ConfigSection({ label, children }: { label: string, children: JSX.Element[] | JSX.Element }) {
    return (
        <div>
            <h4>{label}</h4>
            {children}
            <br />
            <br />
        </div>
    );
}

interface RangeSliderProps {
    id: string;
    label: string;

    value: number;
    min: number; max: number;

    onChange: (value: number) => void
}

function RangeSlider({ id, label, value, min, max, onChange }: RangeSliderProps) {
    return (
        <div className="form-spacing">
            <label htmlFor={id} className="form-label">{label}: {value}</label>
            <input
                type="range" className="form-range"
                id={id}
                min={min} max={max} value={value}
                onChange={event => {
                    onChange(parseInt(event.target.value));
                }}
            />
        </div>
    );
}

interface CheckBoxProps {
    id: string;
    label: string;

    value: boolean;

    onChange: (value: boolean) => void
}

function CheckBox({ id, label, value, onChange }: CheckBoxProps) {
    return (
        <div className="form-check form-spacing">
            <input
                className="form-check-input" type="checkbox" id={id} checked={value}
                onChange={event => {
                    onChange(event.target.checked);
                }}
            />
            <label className="form-check-label" htmlFor={id}>
                {label}
            </label>
        </div>
    );
}