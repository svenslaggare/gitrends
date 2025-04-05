import React, {useState} from "react";

import * as d3 from "d3";
import axios from "axios";

import {fetchFileHistory, FileHistory} from "../model";
import {SelectedFileModal} from "../viewHelpers";

interface HotspotStructureViewProps {
    onError: (response: any) => void;
}

interface HotspotStructureViewState {
    hotspotTree: HotspotTree;
    selectedFile: FileHistory;
}

export class HotspotStructureView extends React.Component<HotspotStructureViewProps, HotspotStructureViewState> {
    showFileModal: any;

    constructor(props) {
        super(props);

        this.state = {
            hotspotTree: null,
            selectedFile: null
        }

        this.fetchStructure();
    }

    render() {
        return (
            <div>
                <SelectedFileModal name="selectedFileModal" selectedFile={this.state.selectedFile} />

                <div className="pt-3 pb-2 mb-3 border-bottom">
                    <h1 className="h2">Hotspots structure</h1>
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
                    hotspotTree={this.state.hotspotTree}
                    onFileSelect={(fileName, leaf) => {
                        if (leaf) {
                            this.showSelectedFileModal(fileName);
                        }
                    }}
                />
            </div>
        );
    }

    showSelectedFileModal(fileName: string) {
        fetchFileHistory(
            fileName,
            fileHistory => {
                this.setState({
                    selectedFile: fileHistory
                });

                // @ts-ignore
                this.showFileModal = new bootstrap.Modal(document.getElementById("showFileModal"));
                this.showFileModal.show();
            },
            error => {
                this.props.onError(error);
            }
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
    weight?: number;
    children: HotspotTree[];
}

function StructureChart({ hotspotTree, onFileSelect }: { hotspotTree: HotspotTree; onFileSelect: (name: string, leaf: boolean) => void; }) {
    let margin = 10;
    let outerDiameter = 900;
    let innerDiameter = outerDiameter - margin - margin;

    let color = d3.scaleLinear<string>()
        .domain([-1, 5])
        .range(["hsl(185,60%,99%)", "hsl(187,40%,70%)"])
        .interpolate(d3.interpolateHcl);

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

    return (
        <svg width={width} height={height}>
            {
                descendants.map((node, nodeIndex) =>
                    <circle
                        key={nodeIndex}
                        className={node.parent ? node.children ? "node" : "node node-leaf" : "node node-root"}
                        cx={x(node.x)} cy={y(node.y)}
                        r={node.r * k}
                        fill={(node.data.weight ?? 0.0) > 0.0 ? "darkred" : node.children ? color(node.depth) : "WhiteSmoke"}
                        fillOpacity={node.children ? null : node.data.weight}
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

export function getFilePath(node: d3.HierarchyCircularNode<HotspotTree>) {
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