import React, {useState} from "react";

import * as d3 from "d3";
import axios from "axios";

import {OnError, shortenName} from "../helpers/misc";
import {ShowSelectedFileModal} from "../helpers/selectedFileModal";
import {CIRCLE_PACKING_COLOR, EntryLegend, TABLEAU20} from "../helpers/charts";
import {AppConfig} from "../config";

interface MainDeveloperStructureViewProps {
    config: AppConfig;
    onError: OnError;
}

interface MainDeveloperStructureViewState {
    mainDeveloperTree: MainDeveloperTree;
}

export class MainDeveloperStructureView extends React.Component<MainDeveloperStructureViewProps, MainDeveloperStructureViewState> {
    showSelectedFileModal = React.createRef<ShowSelectedFileModal>();

    constructor(props) {
        super(props);

        this.state = {
            mainDeveloperTree: null
        }

        this.fetchStructure();
    }

    render() {
        return (
            <div>
                <ShowSelectedFileModal ref={this.showSelectedFileModal} onError={this.props.onError} />

                <div className="pt-3 pb-2 mb-3 border-bottom">
                    <h1 className="h2">Main developer</h1>
                </div>

                {this.renderChart()}
            </div>
        );
    }

    renderChart() {
        if (this.state.mainDeveloperTree == null) {
            return null;
        }

        return (
            <div className="flex-center">
                <StructureChart
                    mainDeveloper={this.state.mainDeveloperTree}
                    onFileSelect={(fileName, leaf) => {
                        if (leaf) {
                            this.showSelectedFileModal.current.show(fileName);
                        }
                    }}
                    maxNumDevelopers={this.props.config.mainDeveloperStructureMaxDevelopers}
                />
            </div>
        );
    }

    fetchStructure() {
        axios.get(`/api/file/main-developer-structure`)
            .then(response => {
                this.setState({
                    mainDeveloperTree: response.data
                });
            })
            .catch(error => {
                this.props.onError(error);
            });
    }
}

interface MainDeveloperTree {
    type: string;
    name: string;
    size?: number;
    main_developer: string;
    children: MainDeveloperTree[];
}

interface StructureChartProps {
    mainDeveloper: MainDeveloperTree;
    onFileSelect: (name: string, leaf: boolean) => void;
    maxNumDevelopers: number;
}

function StructureChart({ mainDeveloper, onFileSelect, maxNumDevelopers }: StructureChartProps) {
    let margin = 30;
    let outerDiameter = 900;
    let innerDiameter = outerDiameter - margin - margin;

    let root = d3.hierarchy(
        mainDeveloper,
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

    let pack = d3.pack<MainDeveloperTree>()
        .padding(2)
        .size([innerDiameter, innerDiameter]);

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

    let width = outerDiameter + 150;
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

    let developers = collectDevelopers(descendants, maxNumDevelopers);
    let developersSet = new Set<string>(developers);
    let developerColor = d3.scaleOrdinal(developers, TABLEAU20);

    let depthColor = CIRCLE_PACKING_COLOR;

    function getColor(node: Node) {
        if (node.children) {
            return depthColor(node.depth);
        } else {
            let developer = node.data.main_developer;
            if (developersSet.has(developer)) {
                return developerColor(developer);
            } else {
                return developerColor("Others");
            }
        }
    }

    return (
        <svg width={width} height={height}>
            <EntryLegend
                x={0}
                y={20}
                values={developers}
                color={developerColor}
                transformValue={value => shortenName(value)}
            />

            <g transform={`translate(0, ${margin + 20})`}>
                {
                    descendants.map((node, nodeIndex) =>
                        <circle
                            key={nodeIndex}
                            className={node.parent ? node.children ? "node" : "node node-leaf" : "node node-root"}
                            cx={x(node.x)} cy={y(node.y)}
                            r={node.r * k}
                            fill={getColor(node)}
                            fillOpacity={node.children ? null : 1.0}
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
                                <title>
                                    {node.data.main_developer}
                                </title>
                            </text>
                        );
                    })
                }
            </g>
        </svg>
    );
}

type Node = d3.HierarchyCircularNode<MainDeveloperTree>;

function collectDevelopers(descendants: Node[], max: number) {
    let developers = new Map<string, number>();
    for (let node of descendants) {
        if (node.data.type == "Leaf") {
            let count = developers.get(node.data.main_developer) ?? 0;
            developers.set(node.data.main_developer, count + 1);
        }
    }

    let topDevelopers = Array.from(developers.entries());
    topDevelopers.sort((a, b) => b[1] - a[1]);
    if (topDevelopers.length > max) {
        topDevelopers = topDevelopers.slice(0, max);
        topDevelopers.push(["Others", 0]);
    }

    return topDevelopers.map(entry => entry[0]);
}

function getFilePath(node: Node) {
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