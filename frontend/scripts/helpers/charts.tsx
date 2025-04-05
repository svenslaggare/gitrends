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
