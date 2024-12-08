import {createContext, JSX, useContext} from "react";
import {GSelection} from "../d3types";
import {SeriesLineStyle} from "../axes/axes";
import {defaultAxesValues, useAxes, UseAxesValues} from "./useAxes";
import {defaultMouseValues, useMouse, UseMouseValues} from "./useMouse";
import {defaultTooltipValues, useTooltip, UseTooltipValues} from "./useTooltip";
import {SvgStyle} from "../styling/svgStyle";

/**
 * The values exposed through the {@link useChart} react hook
 */
interface UseChartValues<D> {
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
    seriesStyles: Map<string, SeriesLineStyle>

    /*
     | AXES
     */
    axes: UseAxesValues

    /*
     | DATA and DATA PROCESSING
     */
    /**
     * An array of time-series representing the initial data for the chart (i.e. static data
     * before streaming starts)
     */
    // initialData: Array<BaseSeries<any>>
    // initialData: Array<Series> | Array<IterateSeries>

    /**
     * A regular expression uses against the series names to determine which series to show in the chart
     */
    seriesFilter: RegExp

    /*
     | INTERNAL INTERACTION EVENT HANDLERS
     */
    mouse: UseMouseValues<D>
    tooltip: UseTooltipValues<D>
}

const defaultUseChartValues: UseChartValues<any> = {
    chartId: NaN,
    container: null,
    mainG: null,
    color: '#d2933f',
    backgroundColor: '#EEE',
    svgStyle: new Map(),
    seriesStyles: new Map(),

    // axes
    axes: defaultAxesValues(),

    // data
    // initialData: [],
    seriesFilter: /./,

    // internal chart-interaction event handlers
    mouse: defaultMouseValues(),
    tooltip: defaultTooltipValues()
}

const ChartContext = createContext<UseChartValues<any>>(defaultUseChartValues)

interface Props {
    chartId: number
    container: SVGSVGElement | null
    mainG: GSelection | null
    color: string
    backgroundColor: string
    svgStyle: Partial<SvgStyle>
    seriesStyles?: Map<string, SeriesLineStyle>
    // initialData: Array<TimeSeries>
    seriesFilter?: RegExp

    children: JSX.Element | Array<JSX.Element>
}

/**
 * The React context provider for the {@link UseChartValues}
 * @param props The properties
 * @return The children wrapped in this provider
 * @constructor
 */
export default function ChartProvider(props: Props): JSX.Element {
    const {
        chartId,
        container,
        mainG,
        color,
        backgroundColor,
        // initialData,
        seriesFilter = defaultUseChartValues.seriesFilter,
        svgStyle,
        seriesStyles = new Map(),
    } = props

    const axes = useAxes()
    const mouse = useMouse()
    const tooltip = useTooltip()

    return <ChartContext.Provider
        value={{
            chartId,
            color,
            backgroundColor,
            svgStyle,
            seriesStyles,
            // initialData,
            seriesFilter,
            mainG,
            container,

            axes,
            mouse,
            tooltip,
        }}
    >
        {props.children}
    </ChartContext.Provider>
}

/**
 * React hook that sets up the React context for the chart values.
 * @return The {@link UseChartValues} held in the React context.
 */
export function useChart<D>(): UseChartValues<D> {
    const context = useContext<UseChartValues<D>>(ChartContext)
    const {chartId} = context
    if (isNaN(chartId)) {
        throw new Error("useChart can only be used when the parent is a <ChartProvider/>")
    }
    return context
}
