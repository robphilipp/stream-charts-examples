import {createContext, JSX, useContext} from "react";
import {GSelection} from "../d3types";
import {Subscription} from "rxjs";
import {Datum, TimeSeries} from "../timeSeries";
// import {noop} from "../utils";
import {SeriesLineStyle} from "../axes";
import {BaseSeries} from "../baseSeries";
import {defaultAxesValues, useAxes, UseAxesValues} from "./useAxes";
import {defaultMouseValues, useMouse, UseMouseValues} from "./useMouse";
import {defaultTooltipValues, useTooltip, UseTooltipValues} from "./useTooltip";

// export const defaultMargin: Margin = {top: 30, right: 20, bottom: 30, left: 50}

/**
 * No operation function for use when a default function is needed
 */
const noop = () => {
    /* empty on purpose */
}

/**
 * The values exposed through the {@link useChart} react hook
 */
interface UseChartValues {
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
    initialData: Array<BaseSeries<any>>
    // initialData: Array<Series> | Array<IterateSeries>

    /**
     * A regular expression uses against the series names to determine which series to show in the chart
     */
    seriesFilter: RegExp

    /*
     | USER CALLBACK FUNCTIONS
     */
    /**
     * Callback when the time range changes.
     * @param times The times (start, end) times for each axis in the plot. The times argument is a
     * map(axis_id -> (start, end)). Where start and end refer to the time-range for the
     * axis.
     * @return void
     */
    onUpdateTime?: (times: Map<string, [start: number, end: number]>) => void


    /*
     | INTERNAL INTERACTION EVENT HANDLERS
     */
    mouse: UseMouseValues
    tooltip: UseTooltipValues
}

const defaultUseChartValues: UseChartValues = {
    chartId: NaN,
    container: null,
    mainG: null,
    color: '#d2933f',
    seriesStyles: new Map(),

    // axes
    axes: defaultAxesValues(),

    // data
    initialData: [],
    seriesFilter: /./,

    // internal chart-interaction event handlers
    mouse: defaultMouseValues(),
    tooltip: defaultTooltipValues()
}

const ChartContext = createContext<UseChartValues>(defaultUseChartValues)

interface Props {
    chartId: number
    container: SVGSVGElement | null
    mainG: GSelection | null
    color: string
    seriesStyles?: Map<string, SeriesLineStyle>
    initialData: Array<TimeSeries>
    seriesFilter?: RegExp

    /*
     | USER CALLBACK FUNCTIONS
     */
    /**
     * Callback function that is called when the chart subscribes to the observable
     * @param subscription The subscription resulting form the subscribe action
     */
    onSubscribe?: (subscription: Subscription) => void
    /**
     * Callback when the time range changes.
     * @param times The times (start, end) times for each axis in the plot
     * @return void
     */
    onUpdateTime?: (times: Map<string, [start: number, end: number]>) => void
    /**
     * Callback function that is called when new data arrives to the chart.
     * @param seriesName The name of the series for which new data arrived
     * @param data The new data that arrived in the windowing tine
     * @see UseChartValues.windowingTime
     */
    onUpdateData?: (seriesName: string, data: Array<Datum>) => void

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
        initialData,
        seriesFilter = defaultUseChartValues.seriesFilter,
        seriesStyles = new Map(),

        onUpdateTime = noop,
    } = props

    const axes = useAxes()
    const mouse = useMouse()
    const tooltip = useTooltip()

    return <ChartContext.Provider
        value={{
            chartId,
            color,
            seriesStyles,
            initialData,
            seriesFilter,

            mainG, container,

            axes,

            onUpdateTime,

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
export function useChart(): UseChartValues {
    const context = useContext<UseChartValues>(ChartContext)
    const {chartId} = context
    if (isNaN(chartId)) {
        throw new Error("useChart can only be used when the parent is a <ChartProvider/>")
    }
    return context
}
