import {createContext, type RefObject, useContext} from "react";
import type {GSelection} from "../d3types";
import type {BaseAxis, SeriesStyle} from "../axes/axes";
import {type UseAxesValues} from "./useAxes";
import {type UseMouseValues} from "./useMouse";
import {type UseTooltipValues} from "./useTooltip";
import type {SvgStyle} from "../styling/svgStyle";
import {BaseAxisRange} from "../axes/BaseAxisRange";
import {defaultUseChartValues} from "./defaultUseChartValues";

export type NoTooltipMetadata = object

/**
 * The values exposed through the {@link useChart} react hook
 * @param chartId The unique ID for the chart
 * @param mainG The root <g> element for the chart
 * @param container The SVG element which is the container for this chart
 * @template D The type of the series' datum
 * @template S The type of the series style
 * @template TM The type of the tooltip's metadata (data about the series data)
 * @template AR The type of the axis range
 * @template A The type of the axis
 */
export interface UseChartValues<D, S extends SeriesStyle, TM, AR extends BaseAxisRange, A extends BaseAxis> {
    /**
     * Unique ID for the chart
     */
    chartId: number
    /**
     * The root <g> element for the chart
     */
    mainG: GSelection | null
    /**
     * The SVG element which is the container for this chart
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
     * A `map(series_name -> series_line_style)`
     */
    seriesStyles: Map<string, S>

    /*
     | AXES
     */
    axes: UseAxesValues<AR, A>

    /*
     | DATA PROCESSING
     */
    /**
     * A regular expression uses against the series names to determine which series to show in the chart
     */
    seriesFilter: RegExp

    /*
     | INTERNAL INTERACTION EVENT HANDLERS
     */
    mouse: UseMouseValues<D, TM>
    tooltip: UseTooltipValues<D, TM>
    /**
     * Ref tracking the currently hovered series name (null when nothing is hovered).
     * Updated by the Legend; read by plots so new path elements use the correct stroke.
     */
    hoveredSeriesRef: RefObject<string | null>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ChartContext = createContext<UseChartValues<any, any, any, any, any>>(defaultUseChartValues())

/**
 * React hook that sets up the React context for the chart values.
 * @return The {@link UseChartValues} held in the React context.
 * @template D The type of the series' datum
 * @template S The type of the series style
 * @template TM The type of the tooltip's metadata (data about the series data)
 * @template AR The type of the axis range
 * @template A The type of the axis
 */
export function useChart<D, S extends SeriesStyle, TM, AR extends BaseAxisRange, A extends BaseAxis>(): UseChartValues<D, S, TM, AR, A> {
    const context = useContext<UseChartValues<D, S, TM, AR, A>>(ChartContext)
    const {chartId} = context
    if (isNaN(chartId)) {
        throw new Error("useChart can only be used when the parent is a <ChartProvider/>")
    }
    return context
}
