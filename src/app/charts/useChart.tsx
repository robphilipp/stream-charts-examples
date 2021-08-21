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

export const defaultMargin: Margin = {top: 30, right: 20, bottom: 30, left: 50}

interface UseChartValues {
    chartId: number
    plotDimensions: Dimensions
    mainG: GSelection | null
    container: SVGSVGElement | null
    margin: Margin
    color: string
    seriesStyles: Map<string, SeriesLineStyle>

    addXAxis: (axis: BaseAxis, id: string) => void
    xAxisFor: (axisId: string) => BaseAxis | undefined
    xAxisIds: () => Array<string>
    xAxes: () => Map<string, BaseAxis>
    xAxisDefaultName: () => string
    addYAxis: (axis: BaseAxis, id: string) => void
    yAxisFor: (axisId: string) => BaseAxis | undefined
    yAxisIds: () => Array<string>
    yAxes: () => Map<string, BaseAxis>
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

    // initial data
    initialData: Array<Series>

    seriesFilter: RegExp

    // when showing static data, these aren't needed
    seriesObservable?: Observable<ChartData>
    windowingTime?: number
    shouldSubscribe?: boolean

    // todo not sure about these
    onSubscribe: (subscription: Subscription) => void
    onUpdateData: (seriesName: string, data: Array<Datum>) => void
    // onUpdateTime: (time: number) => void
    // onUpdateTime: (axisId: string, time: number) => void
    // map(axis_id -> current_time)
    onUpdateTime: (times: Map<string, ContinuousAxisRange>) => void
    // setObservable: (observable: Observable<ChartData>) => void

    // newChart: (chartId: number, mainG: GSelection, container: SVGSVGElement) => void
    // newChart: (chartId: number, mainG: GSelection) => void
    // setMainGSelection: (g: GSelection) => void
    updateDimensions: (dimensions: Dimensions) => void
    // updateWindowingTime: (window: number) => void
    // updateShouldSubscribe: (subscribe: boolean) => void
    subscriptionHandler: (subscribeHandler: (subscription: Subscription) => void) => void
    dataUpdateHandler: (updateDataHandler: (seriesName: string, data: Array<Datum>) => void) => void
    addTimeUpdateHandler: (handlerId: string, handler: (updates: Map<string, ContinuousAxisRange>, plotDim: Dimensions) => void) => void
    removeTimeUpdateHandler: (handlerId: string) => void
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

    // const [seriesObservable, setSeriesObservable] = useState<Observable<ChartData>>()
    // const [windowingTime, setWindowingTime] = useState<number>(defaultUseChartValues.windowingTime || 100)
    // const [shouldSubscribe, setShouldSubscribe] = useState<boolean>(defaultUseChartValues.shouldSubscribe)
    // const [windowingTimes, setWindowingTimes] = useState<Map<string, number>>(defaultUseChartValues.windowingTimes)

    const [onSubscribe, setOnSubscribe] = useState<(subscription: Subscription) => void>(noop)
    const [onUpdateData, setOnUpdateData] = useState<(seriesName: string, data: Array<Datum>) => void>(noop)
    const timeUpdateHandlersRef = useRef<Map<string, (updates: Map<string, ContinuousAxisRange>, plotDim: Dimensions) => void>>(new Map())

    // update the plot dimensions when the container size or margin change
    useEffect(
        () => {
            setDimensions(plotDimensionsFrom(containerDimensions.width, containerDimensions.height, margin))
        },
        [containerDimensions, margin]
    )

    function updateDimensions(plotDimensions: Dimensions): void {
        setDimensions(plotDimensions)
    }

    function addXAxis(axis: BaseAxis, id: string): void {
        xAxesRef.current.set(id, axis)
    }

    function xAxisFor(id: string): BaseAxis | undefined {
        const axis = xAxesRef.current.get(id)
        if (axis === undefined && xAxesRef.current.size >= 1) {
            return Array.from(xAxesRef.current.values())[0]
        }
        return axis
    }

    function xAxisIds(): Array<string> {
        return Array.from(xAxesRef.current.keys())
    }

    function xAxes(): Map<string, BaseAxis> {
        return new Map(xAxesRef.current)
    }

    function xAxisDefaultName(): string {
        return Array.from(xAxesRef.current.keys())[0]
    }

    function addYAxis(axis: BaseAxis, id: string): void {
        yAxesRef.current.set(id, axis)
    }

    function yAxisFor(id: string): BaseAxis | undefined {
        const axis = yAxesRef.current.get(id)
        if (axis === undefined && yAxesRef.current.size >= 1) {
            return Array.from(yAxesRef.current.values())[0]
        }
        return axis
    }

    function yAxisIds(): Array<string> {
        return Array.from(yAxesRef.current.keys())
    }

    function yAxes(): Map<string, BaseAxis> {
        return new Map(yAxesRef.current)
    }

    function yAxisDefaultName(): string {
        return Array.from(yAxesRef.current.keys())[0]
    }

    /**
     * Retrieves the time range for the specified axis ID
     * @param axisId The ID of the axis for which to retrieve the time-range
     * @return The time-range as a `[t_start, t_end]` tuple if the axis ID is found, `undefined` otherwise
     */
    function timeRangeFor(axisId: string): [start: number, end: number] | undefined {
        return timeRangesRef.current.get(axisId)
    }

    /**
     * Sets the time-range for the specified axis ID to the specified range
     * @param axisId The ID of the axis for which to set the range
     * @param timeRange The new time range as an `[t_start, t_end]` tuple
     */
    function setTimeRangeFor(axisId: string, timeRange: [start: number, end: number]): void {
        timeRangesRef.current.set(axisId, timeRange)
    }

    function addTimeUpdateHandler(handlerId: string, handler: (updates: Map<string, ContinuousAxisRange>, plotDim: Dimensions) => void): void {
        timeUpdateHandlersRef.current.set(handlerId, handler)
    }

    function removeTimeUpdateHandler(handlerId: string): void {
        timeUpdateHandlersRef.current.delete(handlerId)
    }

    function handleUpdateTime(updates: Map<string, ContinuousAxisRange>): void {
        updates.forEach(
            (range, id) => timeRangesRef.current.set(id, [range.start, range.end])
        )
        timeUpdateHandlersRef.current.forEach((handler, ) => handler(updates, dimensions))
    }

    function subscriptionHandler(subscribeHandler: (subscription: Subscription) => void): void {
        setOnSubscribe(subscribeHandler)
    }

    function dataUpdateHandler(updateDataHandler: (seriesName: string, data: Array<Datum>) => void): void {
        setOnUpdateData(updateDataHandler)
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
            addXAxis, xAxisFor, xAxisIds, xAxes, xAxisDefaultName,
            addYAxis, yAxisFor, yAxisIds, yAxes, yAxisDefaultName,
            timeRangeFor, setTimeRangeFor,

            seriesObservable,
            windowingTime,
            shouldSubscribe,

            onSubscribe,
            onUpdateTime: handleUpdateTime,
            onUpdateData,
            updateDimensions,
            // updateWindowingTime,
            // updateShouldSubscribe,
            // setObservable,
            subscriptionHandler,
            dataUpdateHandler,
            addTimeUpdateHandler,
            removeTimeUpdateHandler,
        }}
    >
        {children}
    </ChartContext.Provider>
}

export function useChart(): UseChartValues {
    const context = useContext<UseChartValues>(ChartContext)
    const {chartId, subscriptionHandler, dataUpdateHandler} = context
    if (isNaN(chartId) || subscriptionHandler === undefined || dataUpdateHandler === undefined) {
        throw new Error("useChart can only be used when the parent is a <ChartProvider/>")
    }
    return context
}