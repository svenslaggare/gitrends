import React, {useState} from "react";

import * as d3 from "d3";
import axios from "axios";

import {OnError} from "../helpers/misc";
import {ShowSelectedFileModal} from "../helpers/selectedFileModal";
import {TypeSwitcher} from "../helpers/view";
import {CIRCLE_PACKING_COLOR} from "../helpers/charts";

export enum HotspotAnalysisType {
    Revision,
    Author
}

interface HotspotStructureViewProps {
    initialAnalysisType: HotspotAnalysisType;
    onError: OnError;
}

interface HotspotStructureViewState {
    analysisType: HotspotAnalysisType;
    hotspotTree: HotspotTree;
}

export class HotspotStructureView extends React.Component<HotspotStructureViewProps, HotspotStructureViewState> {
    showSelectedFileModal = React.createRef<ShowSelectedFileModal>();

    constructor(props) {
        super(props);

        this.state = {
            analysisType: this.props.initialAnalysisType ?? HotspotAnalysisType.Revision,
            hotspotTree: null
        }

        this.fetchStructure();
    }

    render() {
        return (
            <div>
                <ShowSelectedFileModal ref={this.showSelectedFileModal} onError={this.props.onError} />

                <div className="pt-3 pb-2 mb-3 border-bottom">
                    <TypeSwitcher
                        types={new Map([
                            [HotspotAnalysisType.Revision, { name: "revision", display: "Revision", iconClassName: "fa-solid fa-code-commit" }],
                            [HotspotAnalysisType.Author, { name: "author", display: "Author", iconClassName: "fa-regular fa-user" }]
                        ])}
                        current={this.state.analysisType}
                        onChange={analysisType => {
                            this.setState({ analysisType: analysisType });
                        }}
                    />

                    <h1 className="h2">Hotspots</h1>
                </div>

                {this.renderChart()}
            </div>
        );
    }

    renderChart() {
        if (this.state.hotspotTree == null) {
            return null;
        }

        return (
            <div className="flex-center">
                <StructureChart
                    analysisType={this.state.analysisType}
                    hotspotTree={this.state.hotspotTree}
                    onFileSelect={(fileName, leaf) => {
                        if (leaf) {
                            this.showSelectedFileModal.current.show(fileName);
                        }
                    }}
                />
            </div>
        );
    }

    fetchStructure() {
        axios.get(`/api/file/hotspots-structure`)
            .then(response => {
                this.setState({
                    hotspotTree: response.data
                });
            })
            .catch(error => {
                this.props.onError(error);
            });
    }
}

interface HotspotTree {
    type: string;
    name: string;
    size?: number;
    revision_weight?: number;
    author_weight?: number;
    children: HotspotTree[];
}

interface StructureChartProps {
    analysisType: HotspotAnalysisType;
    hotspotTree: HotspotTree;
    onFileSelect: (name: string, leaf: boolean) => void;
}

function StructureChart({ analysisType, hotspotTree, onFileSelect }: StructureChartProps) {
    let margin = 10;
    let outerDiameter = 900;
    let innerDiameter = outerDiameter - margin - margin;

    let color = CIRCLE_PACKING_COLOR;

    let root = d3.hierarchy(
        hotspotTree,
        node => {
            if (node.type == "Leaf") {
                return [];
            } else {
                return node.children;
            }
        }
    );

    root.sum((d) => d.size);
    root.sort((a, b) => b.height - a.height || b.value - a.value);

    let pack = d3.pack<HotspotTree>()
        .padding(2)
        .size([innerDiameter, innerDiameter]);

    type Node = d3.HierarchyCircularNode<HotspotTree>;

    let rootNode: Node = pack(root);
    let [focus, setFocus] = useState<Node>(rootNode);

    let focusX = focus.x;
    let focusY = focus.y;
    let focusRadius = focus.r;
    let k = innerDiameter / focusRadius / 2;

    let x = d3.scaleLinear()
        .range([0, innerDiameter])
        .domain([focusX - focusRadius, focusX + focusRadius]);

    let y = d3.scaleLinear()
        .range([0, innerDiameter])
        .domain([focusY - focusRadius, focusY + focusRadius]);

    let width = outerDiameter;
    let height = outerDiameter;

    let descendants = rootNode.descendants();

    let zoom = (node: Node) => {
        let newFocus: Node;
        if (node.height != 0) {
            newFocus = node;
        } else {
            newFocus = node.parent;
        }

        setFocus(focus.data == newFocus.data ? node.parent : newFocus);
    };

    let weight: (node: Node) => number;
    switch (analysisType) {
        case HotspotAnalysisType.Revision:
            weight = (node: Node) => {
                return node.data?.revision_weight;
            };
            break;
        case HotspotAnalysisType.Author:
            weight = (node: Node) => {
                return node.data?.author_weight;
            };
            break;

    }

    return (
        <svg width={width} height={height}>
            {
                descendants.map((node, nodeIndex) =>
                    <circle
                        key={nodeIndex}
                        className={node.parent ? node.children ? "node" : "node node-leaf" : "node node-root"}
                        cx={x(node.x)} cy={y(node.y)}
                        r={node.r * k}
                        fill={(weight(node) ?? 0.0) > 0.0 ? "darkred" : node.children ? color(node.depth) : "WhiteSmoke"}
                        fillOpacity={node.children ? null : weight(node)}
                        onClick={() => {
                            zoom(node);
                        }}
                    />
                )
            }

            {
                descendants.map((node, nodeIndex) => {
                    return (
                        <text
                            key={nodeIndex}
                            className="node-text"
                            x={x(node.x)} y={y(node.y)}
                            style={{ display: node.parent?.data == focus.data ? "inline" : "none" }}
                            onClick={() => {
                                onFileSelect(getFilePath(node), node.data.type == "Leaf");
                            }}
                        >
                            {node.data.name}
                        </text>
                    );
                })
            }
        </svg>
    );
}

function getFilePath(node: d3.HierarchyCircularNode<HotspotTree>) {
    if (node.parent == null) {
        return "";
    }

    let parentPath = getFilePath(node.parent);

    if (parentPath != "") {
        return parentPath + "/" + node.data.name;
    } else {
        return node.data.name;
    }
}