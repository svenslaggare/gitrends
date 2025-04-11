import React from "react";

import * as d3 from "d3";
import axios from "axios";

import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-sql";
import "ace-builds/src-noconflict/theme-dracula";

import {OnError} from "../helpers/misc";
import {Module} from "../model";
import {AlertBox, TypeSwitcher} from "../helpers/view";
import {EntryLegend, TABLEAU20} from "../helpers/charts";

export enum ModulesBreakdownType {
    CodeLines,
    Complexity
}

interface ModulesViewProps {
    initialBreakdownType: ModulesBreakdownType;
    onError: OnError;
}

interface ModulesViewState {
    breakdownType: ModulesBreakdownType;
    modules: Module[];
    showEditor: boolean;
    moduleDefinitionContent: string;
    status: string;
}

export class ModulesView extends React.Component<ModulesViewProps, ModulesViewState> {
    editArea: React.RefObject<AceEditor>;

    constructor(props) {
        super(props);

        this.state = {
            breakdownType: this.props.initialBreakdownType ?? ModulesBreakdownType.CodeLines,
            modules: null,
            moduleDefinitionContent: "",
            showEditor: false,
            status: null
        }

        this.fetchModules();
        this.fetchModuleDefinition();
    }

    render() {
        return (
            <div>
                <AlertBox
                    className="alert-success"
                    message={this.state.status}
                    onClose={() => { this.setState({ status: null }); }}
                />

                <div className="pt-3 pb-2 mb-3 border-bottom">
                    <TypeSwitcher
                        types={new Map([
                            [ModulesBreakdownType.CodeLines, { name: "code", display: "Code lines", iconClassName: "fa-solid fa-code" }],
                            [ModulesBreakdownType.Complexity, { name: "complexity", display: "Complexity", iconClassName: "fa-solid fa-chart-simple" }]
                        ])}
                        current={this.state.breakdownType}
                        onChange={breakdownType => {
                            this.setState({ breakdownType: breakdownType });
                        }}
                    />

                    <h1 className="h2">
                        Modules

                        <i
                            className="fa-solid fa-pencil link-button"
                            style={{ fontSize: "large", marginLeft: "0.5em", verticalAlign: "middle" }}
                            onClick={() => { this.setState({ showEditor: !this.state.showEditor }); }}
                        />
                    </h1>
                </div>

                {this.renderEditor()}
                {this.renderChart()}
            </div>
        );
    }

    renderEditor() {
        if (!this.state.showEditor) {
            return null;
        }

        return (
            <div>
                <AceEditor
                    ref={this.editArea}
                    mode="sql"
                    theme="dracula"
                    name="editor"
                    editorProps={{ $blockScrolling: true }}
                    value={this.state.moduleDefinitionContent}
                    onChange={newModuleDefinitionContent => {
                        this.setState({
                            moduleDefinitionContent: newModuleDefinitionContent
                        });
                    }}
                    width="100%"
                    height="100%"
                    className="module-definition-editor"
                />

                <br />
                <button className="btn btn-primary" onClick={() => { this.updateModuleDefinition(); }}>
                    Update
                </button>

                <button className="btn btn-primary" style={{ marginLeft: "0.5em" }} onClick={() => { this.setState({ showEditor: false }); }}>
                    Close
                </button>
                <br />
                <br />
            </div>
        );
    }

    renderChart() {
        if (this.state.modules == null) {
            return null;
        }

        return (
            <div className="flex-center">
                <StructureChart
                    breakdownType={this.state.breakdownType}
                    modules={this.state.modules}
                />
            </div>
        );
    }

    fetchModules() {
        axios.get(`/api/module`)
            .then(response => {
                this.setState({
                    modules: response.data
                });
            })
            .catch(error => {
                this.props.onError(error);
            });
    }

    fetchModuleDefinition() {
        axios.get(`/api/state/module-definition`)
            .then(response => {
                this.setState({
                    moduleDefinitionContent: response.data.content
                });
            })
            .catch(error => {
                this.props.onError(error);
            });
    }

    updateModuleDefinition() {
        axios.put(`/api/state/module-definition`, { content: this.state.moduleDefinitionContent })
            .then(_response => {
                this.setState({
                    status: "Module definition updated."
                });

                this.fetchModules();
            })
            .catch(error => {
                this.props.onError(error);
            });
    }
}

function StructureChart({ breakdownType, modules }: { breakdownType: ModulesBreakdownType; modules: Module[] }) {
    let width = 1500;
    let height = 900;
    let margin = 35;

    interface Tree {
        name: string;
        children?: Tree[];
        value?: number;
    }

    let data: Tree = {
        name: "root",
        children: []
    };

    for (let module of modules) {
        data.children.push({
            name: module.name,
            children: module.files.map(file => {
                let value = 0;
                switch (breakdownType) {
                    case ModulesBreakdownType.CodeLines:
                        value = file.num_code_lines;
                        break;
                    case ModulesBreakdownType.Complexity:
                        value = file.total_indent_levels;
                        break;

                }

                return {
                    name: file.name,
                    value: value
                };
            })
        })
    }

    let color = d3.scaleOrdinal(data.children.map(d => d.name), TABLEAU20);

    let root = d3.treemap<Tree>()
        .tile(d3.treemapBinary)
        .size([width, height - margin])
        .padding(1)
        .round(true)
        (
            d3.hierarchy(data)
                .sum(node => node.value)
                .sort((a, b) => b.value - a.value)
        );

    return (
        <svg
            width={width}
            height={height}
            viewBox={[0, 0, width, height].join(", ")}
            style={{ maxWidth: "100%", height: "auto", font: "10px sans-serif" }}
        >
            <EntryLegend
                x={0}
                y={20}
                values={root.children.map(child => child.data.name)}
                color={color}
            />

            <g transform={`translate(0, ${margin})`}>
                {
                    root.leaves().map((node, nodeIndex) => {
                        let colorNode = node;
                        while (colorNode.depth > 1) {
                            colorNode = colorNode.parent;
                        }

                        let nameParts = node.data.name.split("/");
                        let name: string = nameParts[nameParts.length - 1];

                        let lines = name.split(/(?=[A-Z][a-z])|\s+/g).concat([node.data.value.toString()]);

                        let leafId = `leaf_${nodeIndex}`;
                        let clipId = `clip_${nodeIndex}`;

                        return (
                            <g key={nodeIndex} transform={`translate(${node.x0},${node.y0})`}>
                                <rect
                                    id={leafId}
                                    fill={color(colorNode.data.name)}
                                    fillOpacity={0.8}
                                    width={node.x1 - node.x0}
                                    height={node.y1 - node.y0}
                                />

                                <clipPath id={clipId}>
                                    <use href={`#${leafId}`} />
                                </clipPath>

                                <text clipPath={`url(#${clipId})`}>
                                    {
                                        lines.map((line, lineIndex) =>
                                            <tspan
                                                key={lineIndex}
                                                x={3}
                                                y={`${((lineIndex === lines.length - 1) ? 1 : 0) * 0.3 + 1.1 + lineIndex * 0.9}em`}
                                            >
                                                {line}
                                            </tspan>
                                        )
                                    }
                                </text>

                                <title>{node.data.name} ({colorNode.data.name})</title>
                            </g>
                        );
                    })
                }
            </g>
        </svg>
    );
}