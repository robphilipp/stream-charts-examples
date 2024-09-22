import {createContext, JSX, useContext, useEffect, useRef, useState} from "react";
import {Dimensions, Margin, plotDimensionsFrom} from "../margins";
import {GSelection} from "../d3types";
import {Subscription} from "rxjs";
import {Datum, TimeSeries} from "../timeSeries";
// import {noop} from "../utils";
import {SeriesLineStyle} from "../axes";
import {ContinuousAxisRange} from "../continuousAxisRangeFor";
import {Series} from "../plot";
import {TooltipDimensions} from "../tooltipUtils";
import {BaseSeries} from "../baseSeries";
import {defaultAxesValues, useAxes, UseAxesValues} from "./useAxes";

export const defaultMargin: Margin = {top: 30, right: 20, bottom: 30, left: 50}

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
     | AXES
     */
    axes: UseAxesValues

    /*
     | TIMING
     */
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
     | INTERNAL CHART EVENT HANDLERS
     */
    /**
     * Callback function that is called when the time ranges change. The time ranges could
     * change because of a zoom action, a pan action, or as new data is streamed in.
     * @param times A `map(axis_id -> time_range)` that associates the axis ID with the
     * current time range.
     */
    updateTimeRanges: (times: Map<string, ContinuousAxisRange>) => void
    /**
     * Update the plot dimensions (for example, on a window resize)
     * @param dimensions the new dimensions of the plot
     */
    updateDimensions: (dimensions: Dimensions) => void
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

    /*
     | INTERNAL INTERACTION EVENT HANDLERS
     */
    /**
     * Adds a mouse-over-series handler with the specified ID and handler function
     * @param handlerId The handler ID
     * @param handler The handler function called when a mouse-over-series event occurs.
     * The handler function is handed the series name, the time (x-value), the actual
     * series, and the mouse coordinates over which the mouse has moved over.
     * @return The handler ID.
     */
    registerMouseOverHandler: (
        handlerId: string,
        handler: (seriesName: string, time: number, series: Series, mouseCoords: [x: number, y: number]) => void
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
    mouseOverHandlerFor: (handlerId: string) =>
        ((seriesName: string, time: number, series: Series, mouseCoords: [x: number, y: number]) => void) | undefined
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
     * Registers the provider of the tooltip content (generally this will be registered by the plot).
     * When this function is called again, overwrites the previously registered provider with the
     * one specified. This function can be called repeatedly.
     * @param provider The function that provides the content when called.
     */
    registerTooltipContentProvider: (
        provider: (
            seriesName: string,
            time: number,
            series: Series,
            mouseCoords: [x: number, y: number]
        ) => TooltipDimensions) => void
    /**
     * @return The registered function that provides the tooltip content. If no function has been
     * registered, then returns `undefined`.
     */
    tooltipContentProvider: () =>
        ((seriesName: string, time: number, series: Series, mouseCoords: [x: number, y: number]) => TooltipDimensions) |
        undefined
}

const defaultUseChartValues: UseChartValues = {
    chartId: NaN,
    container: null,
    mainG: null,
    plotDimensions: {width: 0, height: 0},
    margin: defaultMargin,
    color: '#d2933f',
    seriesStyles: new Map(),

    // axes
    axes: defaultAxesValues(),

    // timing
    timeRangeFor: () => [NaN, NaN],
    setTimeRangeFor: noop,

    // data
    initialData: [],
    seriesFilter: /./,

    // internal event handlers
    updateTimeRanges: noop,
    updateDimensions: noop,
    addTimeUpdateHandler: () => noop,
    removeTimeUpdateHandler: () => noop,

    // internal chart-interaction event handlers
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
        containerDimensions,
        margin,
        color,
        initialData,
        seriesFilter = defaultUseChartValues.seriesFilter,
        seriesStyles = new Map(),

        onUpdateTime = noop,
    } = props

    const [dimensions, setDimensions] = useState<Dimensions>(defaultUseChartValues.plotDimensions)

    const axes = useAxes()

    const timeRangesRef = useRef<Map<string, [start: number, end: number]>>(new Map())

    const timeUpdateHandlersRef = useRef<Map<string, (updates: Map<string, ContinuousAxisRange>, plotDim: Dimensions) => void>>(new Map())

    const mouseOverHandlersRef = useRef<Map<string, (seriesName: string, time: number, series: Series, mouseCoords: [x: number, y: number]) => void>>(new Map())
    const mouseLeaveHandlersRef = useRef<Map<string, (seriesName: string) => void>>(new Map())
    const tooltipContentProviderRef = useRef<((seriesName: string, time: number, series: Series, mouseCoords: [x: number, y: number]) => TooltipDimensions) | undefined>(undefined)

    // update the plot dimensions when the container size or margin change
    useEffect(
        () => {
            setDimensions(plotDimensionsFrom(containerDimensions.width, containerDimensions.height, margin))
        },
        [containerDimensions, margin]
    )

    /**
     * Called when the time is updated on one or more of the chart's axes (generally x-axes). In turn,
     * dispatches the update to all the internal time update handlers.
     * @param updates A map holding the axis ID to the updated axis time-range
     */
    function updateTimeRanges(updates: Map<string, ContinuousAxisRange>): void {
        // update the current time-ranges reference
        updates.forEach((range, id) =>
            timeRangesRef.current.set(id, [range.start, range.end])
        )
        // dispatch the updates to all the registered handlers
        timeUpdateHandlersRef.current.forEach((handler, ) => handler(updates, dimensions))
    }

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

            axes,

            timeRangeFor: axisId => timeRangesRef.current.get(axisId),
            setTimeRangeFor: ((axisId, timeRange) => timeRangesRef.current.set(axisId, timeRange)),

            onUpdateTime,

            updateTimeRanges,
            updateDimensions: dimensions => setDimensions(dimensions),

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