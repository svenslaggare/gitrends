import React, {useRef} from "react";

import * as d3 from "d3";
import axios from "axios";

import {OnError} from "../helpers";

interface ChangeCouplingStructureViewProps {
    onError: OnError;
}

interface ChangeCouplingStructureViewState {
    changeCouplingTree: ChangeCouplingTree;
}

export class ChangeCouplingStructureView extends React.Component<ChangeCouplingStructureViewProps, ChangeCouplingStructureViewState> {
    constructor(props) {
        super(props);

        this.state = {
            changeCouplingTree: null
        }

        this.fetchStructure();
    }

    render() {
        return (
            <div>
                <div className="pt-3 pb-2 mb-3 border-bottom">
                    <h1 className="h2">Change coupling structure</h1>
                </div>

                {this.renderChart()}
            </div>
        );
    }

    renderChart() {
        if (this.state.changeCouplingTree == null) {
            return null;
        }

        return (
            <div className="flex-center">
                <StructureChart changeCouplingTree={this.state.changeCouplingTree} />
            </div>
        );
    }

    fetchStructure() {
        axios.get(`/api/file/change-coupling-structure`)
            .then(response => {
                this.setState({
                    changeCouplingTree: response.data
                });
            })
            .catch(error => {
                this.props.onError(error);
            });
    }
}

interface ChangeCouplingTree {
    type: string;
    name: string;
    couplings?: Couplings[];
    children: ChangeCouplingTree[];
}

interface Couplings {
    coupled: string;
    coupling_ratio: number;
}

function StructureChart({ changeCouplingTree }: { changeCouplingTree: ChangeCouplingTree }) {
    const width = 954;
    let margin = 70;
    const radius = width / 2 - margin;

    let tree = d3.cluster<ChangeCouplingTree>()
        .size([2 * Math.PI, radius - 100]);

    let root = tree(
        createLinks(
            (d3.hierarchy(changeCouplingTree) as HierarchyEdgeNode)
                .sort((a, b) => d3.ascending(a.height, b.height) || d3.ascending(a.data.name, b.data.name))
        )
    ) as HierarchyEdgePointNode;

    let line = d3.lineRadial<d3.HierarchyPointNode<ChangeCouplingTree>>()
        .curve(d3.curveBundle.beta(0.85))
        .radius(node => node.y)
        .angle(node => node.x);

    let hoveredNode: HierarchyEdgePointNode = null;

    let isHovered = (node: HierarchyEdgePointNode) => {
        return node.data == hoveredNode?.data;
    };

    let edgeIsHovered = (node: HierarchyEdgePointNode) => {
        for (let edge of node.outgoing) {
            if (isHovered(edge[1])) {
                return true;
            }
        }

        return false;
    };

    const textNormalColor = "white";
    const textHoveredColor = "#829ab1";

    const pathNormalColor = "#2C2E30";
    const pathHoveredColor = "#829ab1";
    const pathBlendMode = "screen";

    let setHoveredNode = (newNode: HierarchyEdgePointNode) => {
        let updatedEdges = new Set<string>();

        if (hoveredNode?.data == newNode?.data) {
            return;
        }

        let updateEdge = (edge: Edge, sourceHovered: boolean, targetHovered: boolean) => {
            let source = edge[0];
            let target = edge[1];

            target.textRef.current.setAttribute("fill", targetHovered ? textHoveredColor : textNormalColor);
            target.textRef.current.style.fontWeight = targetHovered ? "bold" : "";

            for (let ref of (source.pathRefs ?? [])) {
                let edgeIndex = ref.current.dataset.edgeIndex;
                if (updatedEdges.has(edgeIndex)) {
                    continue;
                }

                updatedEdges.add(edgeIndex);

                ref.current.style.mixBlendMode = hoveredNode != null ? null : pathBlendMode;
                ref.current.setAttribute("stroke", sourceHovered ? pathHoveredColor : pathNormalColor);

                if (sourceHovered) {
                    ref.current.parentNode.appendChild(ref.current);
                }
            }
        };

        hoveredNode = newNode;

        root.leaves()
            .flatMap(leaf => leaf.outgoing)
            .forEach(edge => {
                updateEdge(edge, isHovered(edge[0]), edgeIsHovered(edge[1]));
            });
    };

    return (
        <svg
            width={width}
            height={width}
            viewBox={[-width / 2, -width / 2, width, width].join(", ")}
            style={{ maxWidth: "100%", height: "auto", font: "10px sans-serif" }}
        >
            {
                root.leaves().map((node, nodeIndex) => {
                    let ref = useRef<SVGTextElement>();
                    node.textRef = ref;

                    return (
                        <g key={nodeIndex} transform={`rotate(${node.x * 180 / Math.PI - 90}) translate(${node.y},0)`}>
                            <text
                                ref={ref}
                                x={node.x < Math.PI ? 6 : -6}
                                dy="0.31em"
                                transform={node.x >= Math.PI ? "rotate(180)" : null}
                                textAnchor={node.x < Math.PI ? "start" : "end"}
                                fill={textNormalColor}
                                onMouseOver={event => {
                                    (event.target as SVGTextElement).setAttribute("font-weight", "bold");
                                    setHoveredNode(node);
                                }}
                                onMouseOut={event => {
                                    (event.target as SVGTextElement).setAttribute("font-weight", "");
                                    setHoveredNode(null);
                                }}
                            >
                                {node.data.name}
                                <title>
                                    {getFilePath(node)}, coupled: {node.outgoing.length}
                                </title>
                            </text>
                        </g>
                    );
                })
            }

            {
                root.leaves()
                    .flatMap(leaf => leaf.outgoing)
                    .map((edge, edgeIndex) => {
                        let ref = useRef<SVGPathElement>();
                        let node = edge[0];
                        if (node.pathRefs == undefined) {
                            node.pathRefs = [];
                        }

                        node.pathRefs.push(ref);

                        let edgeTargetPath = getFilePath(edge[1]);
                        let couplingRatio = 0.0;
                        for (let coupling of edge[0].data.couplings) {
                            if (coupling.coupled == edgeTargetPath) {
                                couplingRatio = coupling.coupling_ratio;
                            }
                        }

                        return (
                            <path
                                key={edgeIndex}
                                ref={ref}
                                d={line(edge[0].path(edge[1]))}
                                style={{ mixBlendMode: pathBlendMode }}
                                stroke={pathNormalColor}
                                fill="none"
                                strokeWidth={Math.max(1.0, couplingRatio * 10.0)}
                                data-edge-index={edgeIndex}
                            />
                        );
                    })
            }
        </svg>
    );
}

interface HierarchyEdgeNode extends d3.HierarchyNode<ChangeCouplingTree> {
    incoming: [HierarchyEdgeNode, HierarchyEdgeNode][];
    outgoing: [HierarchyEdgeNode, HierarchyEdgeNode][];
}

type Edge = [HierarchyEdgePointNode, HierarchyEdgePointNode];

interface HierarchyEdgePointNode extends d3.HierarchyPointNode<ChangeCouplingTree> {
    incoming: Edge[];
    outgoing: Edge[];

    textRef: React.MutableRefObject<SVGTextElement>;
    pathRefs: React.MutableRefObject<SVGPathElement>[];
}

function createLinks(root: HierarchyEdgeNode) {
    let map = new Map(root.leaves().map(node => [getFilePath(node), node]));
    for (const node of root.leaves()) {
        node.incoming = [];
        node.outgoing = (node.data.couplings ?? []).map(nodeTarget => [node, map.get(nodeTarget.coupled)])
    }

    for (let node of root.leaves()) {
        for (let nodeTarget of node.outgoing) {
            nodeTarget[1].incoming.push(nodeTarget);
        }
    }

    return root;
}

function getFilePath(node: HierarchyEdgeNode): string {
    if (node.parent) {
        let parentId = getFilePath(node.parent);
        if (parentId != "") {
            return `${parentId}/${node.data.name}`;
        }
    }

    return node.data.name;
}
