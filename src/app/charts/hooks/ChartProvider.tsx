import type {BaseAxis, SeriesStyle} from "../axes/axes";
import {BaseAxisRange} from "../axes/BaseAxisRange";
import {type JSX, useState} from "react";
import {defaultUseChartValues} from "./defaultUseChartValues";
import {useAxes} from "./useAxes";
import {useMouse} from "./useMouse";
import {useTooltip} from "./useTooltip";
import type {CanvasContext} from "../d3types";
import type {SvgStyle} from "../styling/svgStyle";
import {ChartContext} from "./useChart";

/**
 * The properties for the {@link ChartProvider}
 * @template S The type of the series style
 */
export interface Props<S extends SeriesStyle> {
    /**
     * The unique ID for the chart
     */
    chartId: number
    /**
     * The canvas drawing context and redraw-registration API for the chart. Replaces the old
     * `mainG` (root SVG `<g>` selection) -- axes, plots, and the tracker register their draw
     * functions with this instead of creating/updating SVG child elements.
     */
    canvasContext: CanvasContext | null
    /**
     * The `<canvas>` element backing the chart. Replaces the old `container` (root `<svg>`
     * element) -- still handed down mainly so mouse-position/hit-testing code can call
     * `getBoundingClientRect()` on it.
     */
    canvas: HTMLCanvasElement | null
    /**
     * Base color
     */
    color: string
    /**
     * The base/default background color. This can be overridden by the {@link Props.svgStyle} property.
     */
    backgroundColor: string
    /**
     * Overrides for the chart container's CSS style
     */
    svgStyle: Partial<SvgStyle>
    /**
     * A `map(series_name -> series_line_style)` holding the style for each series
     */
    seriesStyles?: Map<string, S>
    /**
     * An optional regular expression uses against the series names to determine which series to show in the chart
     */
    seriesFilter?: RegExp

    children: JSX.Element | Array<JSX.Element>
}

/**
 * The React context provider for the {@link UseChartValues}
 * @param props The properties
 * @return The children wrapped in this provider
 * @template D The type of the series' datum
 * @template S The type of the series style
 * @template TM The type of the tooltip's metadata (data about the series data)
 * @template AR The type of the axis range
 * @template A The type of the axis
 */
export default function ChartProvider<S extends SeriesStyle, AR extends BaseAxisRange, A extends BaseAxis>(props: Props<S>): JSX.Element {
    const {
        chartId,
        canvas,
        canvasContext,
        color,
        backgroundColor,
        seriesFilter = defaultUseChartValues().seriesFilter,
        svgStyle,
        seriesStyles = new Map<string, S>(),
    } = props

    const axes = useAxes<AR, A>()
    const mouse = useMouse()
    const tooltip = useTooltip()
    // holds the name of the currently selected/hovered series to allow components to share this state
    const [hoveredSeriesName, setHoveredSeriesName] = useState<string | null>(null)

    return <ChartContext.Provider
        value={{
            chartId,
            color,
            backgroundColor,
            svgStyle,
            seriesStyles,
            seriesFilter,
            canvasContext,
            canvas,

            axes,
            mouse,
            tooltip,
            hoveredSeriesName,
            setHoveredSeriesName
        }}
    >
        {props.children}
    </ChartContext.Provider>
}
