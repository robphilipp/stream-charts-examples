import * as React from 'react';
import {createContext, useContext, useEffect, useRef, useState} from 'react';
import {Dimensions, Margin, plotDimensionsFrom} from "./margins";
import {GSelection} from "./d3types";
import {Observable, Subscription} from "rxjs";
import {ChartData} from "./chartData";
import {Datum, Series} from "./datumSeries";
import {noop} from "./utils";
import {BaseAxis, SeriesLineStyle} from "./axes";
import {ContinuousAxisRange} from "./continuousAxisRangeFor";
import {TimeSeries} from "./plot";
import {TooltipDimensions} from "./tooltipUtils";

export const defaultMargin: Margin = {top: 30, right: 20, bottom: 30, left: 50}

/**
 * The values exposed through the {@link useChart} react hook
 */
interface UseChartValues {
    /**
     * Unique ID for the chart
     */
    chartId: number
    /**
     * The width and height (in pixels) of this chart
     */
    plotDimensions: Dimensions
    /**
     * The root <g> element for the chart
     */
    mainG: GSelection | null
    /**
     * The SVG element which is the container for this chart
     */
    container: SVGSVGElement | null
    /**
     * The plot margins for the border of main G
     */
    margin: Margin
    /**
     * Base color
     */
    color: string
    /**
     * A `map(series_name -> series_line_style)`
     */
    seriesStyles: Map<string, SeriesLineStyle>

    /*
     | X-AXIS
     */
    /**
     * Callback function for adding an x-axis to the chart
     * @param axis The axis to add
     * @param id The unique ID of the axis
     */
    addXAxis: (axis: BaseAxis, id: string) => void
    /**
     * Attempts to retrieve the x-axis for the specified ID
     * @param axisId The unique ID of the axis
     * @return The axis, or undefined if no axis with the specified ID is found
     */
    xAxisFor: (axisId: string) => BaseAxis | undefined
    /**
     * @return An array holding all existing the x-axis IDs
     */
    xAxisIds: () => Array<string>
    /**
     * @return A `map(x_axis_id -> axis)` holding the association of the x-axis
     * IDs to their axes.
     */
    xAxes: () => Map<string, BaseAxis>
    /**
     * @return The default name of the x-axis (in case only on default axis was added)
     */
    xAxisDefaultName: () => string

    /*
     | Y-AXIS
     */
    /**
     * Callback function for adding an y-axis to the chart
     * @param axis The axis to add
     * @param id The unique ID of the axis
     */
    addYAxis: (axis: BaseAxis, id: string) => void
    /**
     * Attempts to retrieve the y-axis for the specified ID
     * @param axisId The unique ID of the axis
     * @return The axis, or undefined if no axis with the specified ID is found
     */
    yAxisFor: (axisId: string) => BaseAxis | undefined
    /**
     * @return An array holding all existing the y-axis IDs
     */
    yAxisIds: () => Array<string>
    /**
     * @return A `map(y_axis_id -> axis)` holding the association of the y-axis
     * IDs to their axes.
     */
    yAxes: () => Map<string, BaseAxis>
    /**
     * @return The default name of the y-axis (in case only on default axis was added)
     */
    yAxisDefaultName: () => string

    /**
     * Retrieves the time range for the specified axis ID
     * @param axisId The ID of the axis for which to retrieve the time-range
     * @return The time-range as a `[t_start, t_end]` tuple if the axis ID is found, `undefined` otherwise
     */
    timeRangeFor: (axisId: string) => [start: number, end: number] | undefined
    /**
     * Sets the time-range for the specified axis ID to the specified range
     * @param axisId The ID of the axis for which to set the range
     * @param timeRange The new time range as an `[t_start, t_end]` tuple
     */
    setTimeRangeFor: (axisId: string, timeRange: [start: number, end: number]) => void

    /**
     * A regular expression uses against the series names to determine which series to show in the chart
     */
    seriesFilter: RegExp

    /*
     | DATA
     */
    /**
     * An array of time-series representing the initial data for the chart (i.e. static data
     * before streaming starts)
     */
    initialData: Array<Series>
    /**
     * An observable source for chart data
     */
    seriesObservable?: Observable<ChartData>
    /**
     * When `true` the chart will subscribe to the observable, or if already subscribed, will remain
     * subscribed. When `false` the chart will unsubscribe to the observable if subscribed, or will
     * remain unsubscribed if not already subscribed.
     */
    shouldSubscribe?: boolean
    /**
     * The windowing time for aggregating chart-data events. Defines the update rate of the chart.
     * For example if chart-data events occur every 1 ms, and the windowing time is set to 10 ms,
     * then events will be aggregated for 10 ms, and then the chart will be updated. In this example,
     * the chart would be updated only once per 10 ms.
     */
    windowingTime?: number

    /**
     * Callback function that is called when the chart subscribes to the observable
     * @param subscription The subscription resulting form the subscribe action
     */
    onSubscribe: (subscription: Subscription) => void
    /**
     * Callback function that is called when new data arrives to the chart.
     * @param seriesName The name of the series for which new data arrived
     * @param data The new data that arrived in the windowing tine
     * @see UseChartValues.windowingTime
     */
    onUpdateData: (seriesName: string, data: Array<Datum>) => void
    /**
     * Callback function that is called when the time ranges change. The time ranges could
     * change because of a zoom action, a pan action, or as new data is streamed in.
     * @param times A `map(axis_id -> time_range)` that associates the axis ID with the
     * current time range.
     */
    onUpdateTime: (times: Map<string, ContinuousAxisRange>) => void

    /**
     * Update the plot dimensions (for example, on a window resize)
     * @param dimensions the new dimensions of the plot
     */
    updateDimensions: (dimensions: Dimensions) => void
    /**
     * Sets the handler for the current subscription
     * @param subscribeHandler The handler called when the observable is subscribed
     */
    subscriptionHandler: (subscribeHandler: (subscription: Subscription) => void) => void
    /**
     * Sets the handler for when data is updated
     * @param updateDataHandler the handler called when the new data arrives
     */
    dataUpdateHandler: (updateDataHandler: (seriesName: string, data: Array<Datum>) => void) => void
    /**
     * Adds a handler for when the time is updated. The time could change because of a zoom action,
     * a pan action, or as new data is streamed in.
     * @param handlerId The unique ID of the handler to register/add
     * @param handler The handler function
     */
    addTimeUpdateHandler: (handlerId: string, handler: (updates: Map<string, ContinuousAxisRange>, plotDim: Dimensions) => void) => void
    /**
     * Removes the time-update handler with the specified ID
     * @param handlerId The ID of the handler to remove
     */
    removeTimeUpdateHandler: (handlerId: string) => void

    /**
     * Adds a mouse-over-series handler with the specified ID and handler function
     * @param handlerId The handler ID
     * @param handler The handler function called when a mouse-over-series event occurs
     * @return The handler ID
     */
    registerMouseOverHandler: (
        handlerId: string,
        handler: (seriesName: string, time: number, series: TimeSeries, mouseCoords: [x: number, y: number]) => void
    ) => string
    /**
     * Removes the mouse-over-series handler with the specified ID
     * @param handlerId The ID of the handler to remove
     */
    unregisterMouseOverHandler: (handlerId: string) => void
    /**
     * Attempts to retrieve the mouse-over-series handler for the specified ID
     * @param handlerId The ID of the handler
     * @return The mouse-over-series handler for the ID, or `undefined` if not found
     */
    mouseOverHandlerFor: (handlerId: string) => ((seriesName: string, time: number, series: TimeSeries, mouseCoords: [x: number, y: number]) => void) | undefined

    /**
     * Adds a mouse-leave-series handler with the specified ID and handler function
     * @param handlerId The handler ID
     * @param handler The handler function called when a mouse-leave-series event occurs
     * @return The handler ID
     */
    registerMouseLeaveHandler: (handlerId: string, handler: (seriesName: string) => void) => string
    /**
     * Removes the mouse-leave-series handler with the specified ID
     * @param handlerId The ID of the handler to remove
     */
    unregisterMouseLeaveHandler: (handlerId: string) => void
    /**
     * Attempts to retrieve the mouse-leave-series handler for the specified ID
     * @param handlerId The ID of the handler
     * @return The mouse-leave-series handler for the ID, or `undefined` if not found
     */
    mouseLeaveHandlerFor: (handlerId: string) => ((seriesName: string) => void) | undefined

    /**
     * Registers the provider of the tooltip content (generally this will be registered by the plot)
     * @param provider The function that provides the content when called.
     */
    registerTooltipContentProvider: (provider: (seriesName: string, time: number, series: TimeSeries, mouseCoords: [x: number, y: number]) => TooltipDimensions) => void
    /**
     * @return The registered function that provides the tooltip content. If no function has been
     * registered, then returns `undefined`.
     */
    tooltipContentProvider: () => ((seriesName: string, time: number, series: TimeSeries, mouseCoords: [x: number, y: number]) => TooltipDimensions) | undefined
}

const defaultUseChartValues: UseChartValues = {
    chartId: NaN,
    container: null,
    mainG: null,
    plotDimensions: {width: 0, height: 0},
    margin: defaultMargin,
    color: '#d2933f',
    seriesStyles: new Map(),

    addXAxis: noop,
    xAxisFor: () => undefined,
    xAxisIds: () => [],
    xAxes: () => new Map(),
    xAxisDefaultName: () => "",
    addYAxis: noop,
    yAxisFor: () => undefined,
    yAxisIds: () => [],
    yAxes: () => new Map(),
    yAxisDefaultName: () => "",

    timeRangeFor: () => [NaN, NaN],
    setTimeRangeFor: noop,

    initialData: [],

    seriesFilter: /./,

    //
    windowingTime: NaN,
    shouldSubscribe: false,

    onSubscribe: noop,
    onUpdateData: noop,
    onUpdateTime: noop,

    updateDimensions: noop,
    subscriptionHandler: () => noop,
    dataUpdateHandler: () => noop,

    addTimeUpdateHandler: () => noop,
    removeTimeUpdateHandler: () => noop,

    registerMouseOverHandler: () => '',
    unregisterMouseOverHandler: noop,
    mouseOverHandlerFor: () => undefined,

    registerMouseLeaveHandler: () => '',
    unregisterMouseLeaveHandler: noop,
    mouseLeaveHandlerFor: () => undefined,

    registerTooltipContentProvider: noop,
    tooltipContentProvider: () => undefined
}

const ChartContext = createContext<UseChartValues>(defaultUseChartValues)

interface Props {
    chartId: number
    container: SVGSVGElement | null
    mainG: GSelection | null
    containerDimensions: Dimensions
    margin: Margin
    color: string
    seriesStyles?: Map<string, SeriesLineStyle>
    initialData: Array<Series>
    seriesFilter?: RegExp

    // live data
    seriesObservable?: Observable<ChartData>
    windowingTime?: number
    shouldSubscribe?: boolean

    children: JSX.Element | Array<JSX.Element>
}

/**
 * The react context provider for the {@link UseChartValues}
 * @param props The properties
 * @return The children wrapped in this provider
 * @constructor
 */
export default function ChartProvider(props: Props): JSX.Element {
    const {
        chartId,
        container,
        mainG,
        containerDimensions,
        margin,
        color,
        initialData,
        seriesFilter = defaultUseChartValues.seriesFilter,
        seriesStyles = new Map(),

        seriesObservable,
        windowingTime = defaultUseChartValues.windowingTime || 100,
        shouldSubscribe,
    } = props
    const [dimensions, setDimensions] = useState<Dimensions>(defaultUseChartValues.plotDimensions)

    const xAxesRef = useRef<Map<string, BaseAxis>>(new Map())
    const yAxesRef = useRef<Map<string, BaseAxis>>(new Map())

    const timeRangesRef = useRef<Map<string, [start: number, end: number]>>(new Map())

    const [onSubscribe, setOnSubscribe] = useState<(subscription: Subscription) => void>(noop)
    const [onUpdateData, setOnUpdateData] = useState<(seriesName: string, data: Array<Datum>) => void>(noop)
    const timeUpdateHandlersRef = useRef<Map<string, (updates: Map<string, ContinuousAxisRange>, plotDim: Dimensions) => void>>(new Map())

    const mouseOverHandlersRef = useRef<Map<string, (seriesName: string, time: number, series: TimeSeries, mouseCoords: [x: number, y: number]) => void>>(new Map())
    const mouseLeaveHandlersRef = useRef<Map<string, (seriesName: string) => void>>(new Map())
    const tooltipContentProviderRef = useRef<((seriesName: string, time: number, series: TimeSeries, mouseCoords: [x: number, y: number]) => TooltipDimensions) | undefined>(undefined)

    // update the plot dimensions when the container size or margin change
    useEffect(
        () => {
            setDimensions(plotDimensionsFrom(containerDimensions.width, containerDimensions.height, margin))
        },
        [containerDimensions, margin]
    )

    function xAxisFor(id: string): BaseAxis | undefined {
        const axis = xAxesRef.current.get(id)
        if (axis === undefined && xAxesRef.current.size >= 1) {
            return Array.from(xAxesRef.current.values())[0]
        }
        return axis
    }

    function yAxisFor(id: string): BaseAxis | undefined {
        const axis = yAxesRef.current.get(id)
        if (axis === undefined && yAxesRef.current.size >= 1) {
            return Array.from(yAxesRef.current.values())[0]
        }
        return axis
    }

    function onUpdateTime(updates: Map<string, ContinuousAxisRange>): void {
        updates.forEach(
            (range, id) => timeRangesRef.current.set(id, [range.start, range.end])
        )
        timeUpdateHandlersRef.current.forEach((handler, ) => handler(updates, dimensions))
    }

    const {children} = props
    return <ChartContext.Provider
        value={{
            chartId,
            plotDimensions: dimensions,
            margin,
            color,
            seriesStyles,
            initialData,
            seriesFilter,

            mainG, container,

            addXAxis: (axis, id) => xAxesRef.current.set(id, axis),
            xAxisFor,
            xAxisIds: () => Array.from(xAxesRef.current.keys()),
            xAxes: () => new Map(xAxesRef.current),
            xAxisDefaultName: () => Array.from(xAxesRef.current.keys())[0],

            addYAxis: (axis, id) => yAxesRef.current.set(id, axis),
            yAxisFor,
            yAxisIds: () => Array.from(yAxesRef.current.keys()),
            yAxes: () => new Map(yAxesRef.current),
            yAxisDefaultName: () => Array.from(yAxesRef.current.keys())[0],

            timeRangeFor: axisId => timeRangesRef.current.get(axisId),
            setTimeRangeFor: ((axisId, timeRange) => timeRangesRef.current.set(axisId, timeRange)),

            seriesObservable,
            windowingTime,
            shouldSubscribe,

            onSubscribe,
            onUpdateTime,
            onUpdateData,
            updateDimensions: dimensions => setDimensions(dimensions),

            subscriptionHandler: handler => setOnSubscribe(handler),

            dataUpdateHandler: handler => setOnUpdateData(handler),
            addTimeUpdateHandler: (handlerId, handler) => timeUpdateHandlersRef.current.set(handlerId, handler),
            removeTimeUpdateHandler: handlerId => timeUpdateHandlersRef.current.delete(handlerId),

            registerMouseOverHandler: (handlerId, handler) => {
                mouseOverHandlersRef.current.set(handlerId, handler)
                return handlerId
            },
            unregisterMouseOverHandler: handlerId => mouseOverHandlersRef.current.delete(handlerId),
            mouseOverHandlerFor: handlerId => mouseOverHandlersRef.current.get(handlerId),

            registerMouseLeaveHandler: (handlerId, handler) => {
                mouseLeaveHandlersRef.current.set(handlerId, handler)
                return handlerId
            },
            unregisterMouseLeaveHandler: handlerId => mouseLeaveHandlersRef.current.delete(handlerId),
            mouseLeaveHandlerFor: handlerId => mouseLeaveHandlersRef.current.get(handlerId),

            registerTooltipContentProvider: provider => tooltipContentProviderRef.current = provider,
            tooltipContentProvider: () => tooltipContentProviderRef.current,
        }}
    >
        {children}
    </ChartContext.Provider>
}

/**
 * React hook that sets up the react context for the chart values.
 * @return The {@link UseChartValues} held in the react context.
 */
export function useChart(): UseChartValues {
    const context = useContext<UseChartValues>(ChartContext)
    const {chartId, subscriptionHandler, dataUpdateHandler} = context
    if (isNaN(chartId) || subscriptionHandler === undefined || dataUpdateHandler === undefined) {
        throw new Error("useChart can only be used when the parent is a <ChartProvider/>")
    }
    return context
}