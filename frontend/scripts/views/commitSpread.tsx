import React from "react";

import * as d3 from "d3";
import axios from "axios";

import {OnError} from "../helpers/misc";
import {CommitSpreadEntry} from "../model";
import {EntryLegend, TABLEAU20} from "../helpers/charts";
import {AppConfig} from "../config";

interface CommitSpreadViewProps {
    config: AppConfig;

    onError: OnError;
}

interface CommitSpreadViewState {
    commitSpreadEntries: CommitSpreadEntry[];
}

export class CommitSpreadView extends React.Component<CommitSpreadViewProps, CommitSpreadViewState> {
    constructor(props) {
        super(props);

        this.state = {
            commitSpreadEntries: null
        }

        this.fetch();
    }

    render() {
        return (
            <div>
                <div className="pt-3 pb-2 mb-3 border-bottom">
                    <h1 className="h2">Commit spread</h1>
                </div>

                {this.renderChart()}
            </div>
        );
    }

    renderChart() {
        if (this.state.commitSpreadEntries == null) {
            return null;
        }

        return (
            <div className="flex-center">
                <StructureChart
                    commitSpreadEntries={this.state.commitSpreadEntries}
                    maxAuthors={this.props.config.commitSpreadMaxAuthors}
                    minNumModuleCommits={this.props.config.commitSpreadMinNumModuleCommits}
                />
            </div>
        );
    }

    fetch() {
        axios.get(`/api/module/commit-spread`)
            .then(response => {
                this.setState({
                    commitSpreadEntries: response.data
                });
            })
            .catch(error => {
                this.props.onError(error);
            });
    }
}

interface StructureChartProps {
    commitSpreadEntries: CommitSpreadEntry[];
    maxAuthors: number;
    minNumModuleCommits: number;
}

function StructureChart({ commitSpreadEntries, maxAuthors, minNumModuleCommits }: StructureChartProps) {
    let width = 1500;
    let height = 900;
    let margin = 35;

    let authorsMap = new Map<string, number>();
    for (let entry of commitSpreadEntries) {
        authorsMap.set(entry.author, (authorsMap.get(entry.author) ?? 0 )+ 1)
    }

    let topAuthors = Array.from(authorsMap.entries());
    topAuthors.sort((a, b) => b[1] - a[1]);
    topAuthors = topAuthors.slice(0, maxAuthors);
    let validAuthors = new Set<string>(topAuthors.map(entry => entry[0]));
    validAuthors.add("Others");

    let modules = new Map<string, Map<string, number>>();
    for (let entry of commitSpreadEntries) {
        let moduleEntries = modules.get(entry.module_name);
        if (moduleEntries == undefined) {
            moduleEntries = new Map<string, number>();
            modules.set(entry.module_name, moduleEntries);
        }

        let author = entry.author;
        if (!validAuthors.has(author)) {
            author = "Others";
        }

        moduleEntries.set(author, (moduleEntries.get(author) ?? 0) + entry.num_revisions);
    }

    interface Tree {
        name: string;
        children?: Tree[];
        value?: number;
    }

    let data: Tree = {
        name: "root",
        children: []
    };

    for (let [moduleName, entries] of modules.entries()) {
        let moduleTree: Tree = {
            name: moduleName,
            children: []
        };

        let moduleNumRevisions = 0;
        for (let [author, numRevisions] of entries) {
            moduleNumRevisions += numRevisions;

            moduleTree.children.push({
                name: author,
                value: numRevisions
            });
        }

        if (moduleNumRevisions < minNumModuleCommits) {
            continue;
        }

        data.children.push(moduleTree);
    }
    let authors = Array.from(validAuthors.values());

    let color = d3.scaleOrdinal(authors, TABLEAU20);

    let root = d3.treemap<Tree>()
        .tile(d3.treemapBinary)
        .size([width, height - margin])
        .padding(10)
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
                values={authors}
                color={color}
            />

            <g transform={`translate(0, ${margin + 5})`}>
                {
                    root.children.map((node, nodeIndex) => {
                        return (
                            <g key={nodeIndex} transform={`translate(${0.5 * (node.x0 + node.x1)},${node.y0})`}>
                                <text fill="white" textAnchor="middle" fontSize="16px">{node.data.name}</text>
                            </g>
                        );
                    })
                }
            </g>

            <g transform={`translate(0, ${margin + 5})`}>
                {
                    root.leaves().map((node, nodeIndex) => {
                        let moduleNode = node;
                        while (moduleNode.depth > 1) {
                            moduleNode = moduleNode.parent;
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
                                    fill={color(node.data.name)}
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

                                <title>{node.data.name} ({moduleNode.data.name})</title>
                            </g>
                        );
                    })
                }
            </g>
        </svg>
    );
}