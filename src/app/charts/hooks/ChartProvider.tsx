import type {BaseAxis, SeriesStyle} from "../axes/axes";
import {BaseAxisRange} from "../axes/BaseAxisRange";
import type {JSX, RefObject} from "react";
import {defaultUseChartValues} from "./defaultUseChartValues";
import {useAxes} from "./useAxes";
import {useMouse} from "./useMouse";
import {useTooltip} from "./useTooltip";
import type {GSelection} from "../d3types";
import type {SvgStyle} from "../styling/svgStyle";
import { ChartContext } from "./useChart";

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
     * The main group element for the chart
     */
    mainG: GSelection | null
    /**
     * The container element for the chart
     */
    container: SVGSVGElement | null
    /**
     * Base color
     */
    color: string
    /**
     * The base/default background color. This can be overridden by the {@link Props.svgStyle} property.
     */
    backgroundColor: string
    /**
     * Overrides for the SVG style
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
    /**
     * A reference to the currently hovered series
     */
    hoveredSeriesRef: RefObject<string | null>

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
        container,
        mainG,
        color,
        backgroundColor,
        seriesFilter = defaultUseChartValues().seriesFilter,
        svgStyle,
        seriesStyles = new Map<string, S>(),
        hoveredSeriesRef,
    } = props

    const axes = useAxes<AR, A>()
    const mouse = useMouse()
    const tooltip = useTooltip()

    return <ChartContext.Provider
        value={{
            chartId,
            color,
            backgroundColor,
            svgStyle,
            seriesStyles,
            seriesFilter,
            mainG,
            container,

            axes,
            mouse,
            tooltip,
            hoveredSeriesRef,
        }}
    >
        {props.children}
    </ChartContext.Provider>
}