import {SeriesStyle} from "../axes/axes";
import {SvgFillStyle, SvgStrokeStyle} from "./svgStyle";
import * as d3 from "d3";

export interface BarSeriesStyle extends SeriesStyle {
    minMaxBar: BarStyle
    windowedMinMaxBar: BarStyle
    valueLine: LineStyle
    meanValueLine: LineStyle
    windowedMeanValueLine: LineStyle
}

export interface BarStyle {
    widthFraction: number
    fill: SvgFillStyle
    stroke: SvgStrokeStyle
}

export interface LineStyle {
    regular: SvgStrokeStyle
    highlight: SvgStrokeStyle
}

export function defaultMinMaxBarStyle(color: string = "#008aad"): BarStyle {
    return {
        widthFraction: 0.65,
        fill: {
            color,
            opacity: 0.4
        },
        stroke: {
            width: 1,
            opacity: 0.6,
            color,
        }
    }
}

export function defaultWindowedMinMaxBarStyle(color: string = "#008aad"): BarStyle {
    return {
        widthFraction: 0.25,
        fill: {
            color: d3.color(color)?.darker(0.3).toString() ?? color,
            opacity: 0.6
        },
        stroke: {
            width: 0,
            opacity: 0,
            color: d3.color(color)?.darker(0.3).toString() ?? color,
        }
    }
}

export function defaultValueLineStyle(color: string = "#008aad"): LineStyle {
    return {
        regular: {
            color,
            opacity: 0.6,
            width: 3
        },
        highlight: {
            color,
            opacity: 1,
            width: 5
        }
    }
}

export function defaultMeanValueLineStyle(color: string = "#008aad"): LineStyle {
    return {
        regular: {
            color,
            opacity: 0.6,
            width: 1
        },
        highlight: {
            color,
            opacity: 1,
            width: 3
        }
    }
}

export function defaultWindowedMeanValueLineStyle(color: string = "#008aad"): LineStyle {
    return {
        regular: {
            color: 'red',
            opacity: 0.6,
            width: 1
        },
        highlight: {
            color,
            opacity: 1,
            width: 3
        }
    }
}

export function defaultBarSeriesStyle(color: string = "#008aad"): BarSeriesStyle {
    return {
        color,
        highlightColor: color,
        minMaxBar: defaultMinMaxBarStyle(color),
        windowedMinMaxBar: defaultWindowedMinMaxBarStyle(color),
        valueLine: defaultValueLineStyle(color),
        meanValueLine: defaultMeanValueLineStyle(color),
        windowedMeanValueLine: defaultWindowedMeanValueLineStyle(color),
    }
}
