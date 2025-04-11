import React, {useEffect, useRef} from "react";
import Moment from "react-moment";

import * as d3 from "d3";

import {FileHistoryEntry} from "../model";

export function CodeComplexityTimeChart({ data }: { data: FileHistoryEntry[] }) {
    let width = 1300;
    let legendWidth = 100;
    let chartWidth = width - legendWidth;
    let height = 400;
    let marginTop = 30;
    let marginBottom = 30;
    let marginRight = 40;
    let marginLeft = 40;

    const gx = useRef();
    const gy = useRef();

    const dateParser = d3.timeParse("%s");
    const time = d3.scaleUtc(d3.extent(data, d => dateParser(d.date.toString())), [marginLeft, chartWidth - marginRight]);
    const y = d3.scaleLinear([0, d3.max(data, d => Math.max(d.total_indent_levels, d.num_code_lines))], [height - marginBottom, marginTop]);

    const line1 = d3.line<FileHistoryEntry>()
        .x(d => time(dateParser(d.date.toString())))
        .y(d => y(d.num_code_lines))

    const line2 = d3.line<FileHistoryEntry>()
        .x(d => time(dateParser(d.date.toString())))
        .y(d => y(d.total_indent_levels))

    let timeAxis = d3.axisBottom(time).ticks(chartWidth / 80).tickSizeOuter(0);
    let yAxis = d3.axisLeft(y).ticks(height / 40);

    // @ts-ignore
    useEffect(() => void d3.select(gx.current).call(timeAxis), [gx, time]);
    // @ts-ignore
    useEffect(() => void d3.select(gy.current).call(yAxis), [gy, y]);

    let line1Color = "#4B4376";
    let line2Color = "#AE445A";

    let drawFills = (color: string, key: string) => {
        return (
            <g fill={color} stroke={color} strokeWidth="1.5">
                {
                    data.map((d, i) => {
                        let date = dateParser(d.date.toString());

                        return (
                            <circle
                                key={i} cx={time(date)} cy={y(d[key])} r="2.5">
                                <title><Moment format="YYYY-MM-DD HH:mm:ss">{date}</Moment> - {d[key]}</title>
                            </circle>
                        );
                    })
                }
            </g>
        );
    }

    return (
        <svg width={width} height={height}>
            <g ref={gx} transform={`translate(0,${height - marginBottom})`} />
            <g ref={gy} transform={`translate(${marginLeft},0)`} />

            <path fill="none" stroke={line1Color} strokeWidth="1.5" d={line1(data)} />
            <path fill="none" stroke={line2Color} strokeWidth="1.5" d={line2(data)} />

            {drawFills(line1Color, "num_code_lines")}
            {drawFills(line2Color, "total_indent_levels")}

            <g transform={`translate(${chartWidth}, 0)`}>
                <circle cx={0} cy={15} r={5} fill={line1Color} />
                <text fill="white" fontSize={14} x={10} y={20}>Code lines</text>

                <circle cx={0} cy={40} r={5} fill={line2Color} />
                <text fill="white" fontSize={14} x={10} y={45}>Complexity</text>
            </g>
        </svg>
    );
}

export function HistogramChart({ data, max, normalized }: { data: Map<string, number>; max: number; normalized: boolean }) {
    let width = 1200;
    let height = 600;

    let marginTop = 30;
    let marginRight = 60;
    let marginBottom = 30;
    let marginLeft = 140;

    const gx = useRef();
    const gy = useRef();

    let orderedData = Array.from(data.entries());
    orderedData.sort((a, b) => -(a[1] - b[1]));
    let total = d3.sum(orderedData, d => d[1]);

    let maxIndex = Math.min(max, orderedData.length);
    let othersData = [...orderedData].slice(maxIndex);
    orderedData = orderedData.slice(0, maxIndex);

    if (othersData.length > 0) {
        orderedData.push([
            "Others",
            d3.sum(othersData, d => d[1])
        ]);
    }

    if (normalized) {
        orderedData = orderedData.map(([name, value]) => [name, value / total]);
    }

    const x = d3.scaleLinear()
        .domain([0, d3.max(orderedData, d => d[1])])
        .range([marginLeft, width - marginRight]);

    const y = d3.scaleBand()
        .domain(orderedData.map(d => d[0]))
        .rangeRound([marginTop, height - marginBottom])
        .padding(0.1);

    let shortLimit = orderedData.length > 0 ? 0.05 * orderedData[0][1] : 0.0;

    useEffect(
        () => {
            d3.select(gx.current)
                .call(g => g.select("g").remove())
                // @ts-ignore
                .call(d3.axisTop(x).ticks(width / 80, normalized ? "%" : ""))
                .call(g => g.select(".domain").remove())
        },
        [gx, x]
    );

    useEffect(
        () => {
            d3.select(gy.current)
                .call(g => g.select("g").remove())
                // @ts-ignore
                .call(d3.axisLeft(y).tickSizeOuter(0))
        },
        [gy, y]
    );

    return (
        <svg width={width} height={height}>
            <g ref={gx} transform={`translate(0,${marginTop})`} />
            <g ref={gy} transform={`translate(${marginLeft},0)`} />

            <g fill="steelblue">
                {
                    orderedData.map(([name, value], valueIndex) =>
                        <rect
                            key={valueIndex}
                            x={x(0)}
                            y={y(name)}
                            width={x(value) - x(0)}
                            height={y.bandwidth()}
                        />
                    )
                }
            </g>

            {
                orderedData.map(([name, value], valueIndex) => {
                    let isShort = value <= shortLimit;

                    return (
                        <text
                            key={valueIndex}
                            className={isShort ? "bar-chart-value-text-short" : "bar-chart-value-text"}
                            x={x(value)}
                            y={y(name) + y.bandwidth() / 2.0}
                            dx={isShort ? 4 : -4}
                            dy={"0.35em"}
                        >
                            {normalized ? `${(value * 100.0).toFixed(1)} %` : value}
                        </text>
                    );
                })
            }
        </svg>
    );
}

export function EntryLegend({ x, y, values, color }: { x: number; y: number; values: string[], color: (name: string) => string }) {
    return (
        <text x={x} y={y}>
            {
                values.map((value, valueIndex) =>
                    [
                        <tspan key={valueIndex * 2} fill={color(value)} fontSize="20px">■ </tspan>,
                        <tspan key={valueIndex * 2 + 1} fill="white">{value} </tspan>
                    ]
                )
            }
        </text>
    );
}

export const CIRCLE_PACKING_COLOR = d3.scaleLinear<string>()
    .domain([-1, 5])
    .range(["hsl(185,60%,99%)", "hsl(187,40%,70%)"])
    .interpolate(d3.interpolateHcl);

export const TABLEAU20  = [
    "#1F77B4",
    "#FF7F0E",
    "#2CA02C",
    "#D62728",
    "#9467BD",
    "#8C564B",
    "#E377C2",
    "#7F7F7F",
    "#BCBD22",
    "#17BECF",
    "#AEC7E8",
    "#FFBB78",
    "#98DF8A",
    "#FF9896",
    "#C5B0D5",
    "#C49C94",
    "#F7B6D2",
    "#C7C7C7",
    "#DBDB8D",
    "#9EDAE5"
];