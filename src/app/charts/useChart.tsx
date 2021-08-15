import * as React from 'react';
import {createContext, useContext, useEffect, useRef, useState} from 'react';
import {Dimensions, Margin, plotDimensionsFrom} from "./margins";
import {GSelection} from "./d3types";
import {Observable, Subscription} from "rxjs";
import {ChartData} from "./chartData";
import {Datum, Series} from "./datumSeries";
import {noop} from "./utils";
import {PlotDimensions} from "stream-charts/dist/src/app/charts/margins";
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

    timeRangeFor: (axisId: string) => [start: number, end: number] | undefined
    setTimeRangeFor: (axisId: string, timeRange: [start: number, end: number]) => void

    // initial data
    // initialData: Map<string, Series>
    initialData: Array<Series>

    seriesFilter: RegExp

    // when showing static data, these aren't needed
    seriesObservable?: Observable<ChartData>
    windowingTime?: number
    shouldSubscribe?: boolean

    // the time axes will likely have different windowing times. the map
    // associations the axis ID with the windowing time
    // windowingTimes: Map<string, number>
    // setWindowingTimeFor: (axisId: string, windowingTime: number) => void

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
    updateDimensions: (dimensions: PlotDimensions) => void
    // updateWindowingTime: (window: number) => void
    // updateShouldSubscribe: (subscribe: boolean) => void
    subscriptionHandler: (subscribeHandler: (subscription: Subscription) => void) => void
    dataUpdateHandler: (updateDataHandler: (seriesName: string, data: Array<Datum>) => void) => void
    // timeUpdateHandler: (updateTimeHandler: (axisId: string, time: number) => void) => void
    addTimeUpdateHandler: (handlerId: string, handler: (updates: Map<string, ContinuousAxisRange>) => void) => void
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

    // initialData: new Map(),
    initialData: [],

    seriesFilter: /./,

    //
    windowingTime: NaN,
    shouldSubscribe: false,
    // windowingTimes: new Map(),
    // setWindowingTimeFor: noop,

    onSubscribe: noop,
    onUpdateData: noop,
    onUpdateTime: noop,

    // newChart: noop,
    // setMainGSelection: noop,
    updateDimensions: noop,
    // updateWindowingTime: noop,
    // updateShouldSubscribe: noop,
    // setObservable: noop,
    subscriptionHandler: () => noop,
    dataUpdateHandler: () => noop,
    // timeUpdateHandler: () => noop,

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
    // const [chartId, setChartId] = useState<number>(defaultUseChartValues.chartId)
    const [dimensions, setDimensions] = useState<PlotDimensions>(defaultUseChartValues.plotDimensions)
    // const [mainG, setMainG] = useState<GSelection>()
    // const [container, setContainer] = useState<SVGSVGElement>()

    const xAxesRef = useRef<Map<string, BaseAxis>>(new Map())
    const yAxesRef = useRef<Map<string, BaseAxis>>(new Map())

    const timeRangesRef = useRef<Map<string, [start: number, end: number]>>(new Map())

    // const [seriesObservable, setSeriesObservable] = useState<Observable<ChartData>>()
    // const [windowingTime, setWindowingTime] = useState<number>(defaultUseChartValues.windowingTime || 100)
    // const [shouldSubscribe, setShouldSubscribe] = useState<boolean>(defaultUseChartValues.shouldSubscribe)
    // const [windowingTimes, setWindowingTimes] = useState<Map<string, number>>(defaultUseChartValues.windowingTimes)

    const [onSubscribe, setOnSubscribe] = useState<(subscription: Subscription) => void>(noop)
    const [onUpdateData, setOnUpdateData] = useState<(seriesName: string, data: Array<Datum>) => void>(noop)
    // todo making this a state fixes the resize issue, but causes react to break its update depth...
    // const [onUpdateTime, setOnUpdateTime] = useState<(axisId: string, time: number) => void>(noop)
    const timeUpdateHandlersRef = useRef<Map<string, (updates: Map<string, ContinuousAxisRange>) => void>>(new Map())
    // const [timeUpdateHandlers, setTimeUpdateHandlers] = useState<Map<string, (updates: Map<string, ContinuousAxisRange>) => void>>(new Map())

    // // function newChart(chartId: number, mainG: GSelection, container: SVGSVGElement): void {
    // function newChart(chartId: number, mainG: GSelection): void {
    //     setChartId(chartId)
    // }

    // update the plot dimensions when the container size or margin change
    useEffect(
        () => {
            setDimensions(plotDimensionsFrom(containerDimensions.width, containerDimensions.height, margin))
        },
        [containerDimensions, margin]
    )

    // function setMainGSelection(g: GSelection): void {
    //     setMainG(g)
    // }

    // function setObservable(observable: Observable<ChartData>): void {
    //     setSeriesObservable(observable)
    // }

    function updateDimensions(plotDimensions: PlotDimensions): void {
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

    function timeRangeFor(axisId: string): [start: number, end: number] | undefined {
        return timeRangesRef.current.get(axisId)
    }

    function setTimeRangeFor(axisId: string, timeRange: [start: number, end: number]): void {
        timeRangesRef.current.set(axisId, timeRange)
    }

    function addTimeUpdateHandler(handlerId: string, handler: (updates: Map<string, ContinuousAxisRange>) => void): void {
        // const handlers = new Map(timeUpdateHandlers)
        // handlers.set(handlerId, handler)
        // setTimeUpdateHandlers(handlers)
        timeUpdateHandlersRef.current.set(handlerId, handler)
    }

    function removeTimeUpdateHandler(handlerId: string): void {
        // if (timeUpdateHandlers.delete(handlerId)) {
        //     setTimeUpdateHandlers(new Map(timeUpdateHandlers))
        // }
        timeUpdateHandlersRef.current.delete(handlerId)
    }

    function handleUpdateTime(updates: Map<string, ContinuousAxisRange>): void {
        updates.forEach(
            (range, id) => timeRangesRef.current.set(id, [range.start, range.end])
        )
        // timeUpdateHandlers.forEach((handler, id) => handler(updates))
        timeUpdateHandlersRef.current.forEach((handler, ) => handler(updates))
    }

    // function setWindowingTimeFor(axisId: string, windowingTime: number): void {
    //     const times = new Map(windowingTimes)
    //     times.set(axisId, windowingTime)
    //     setWindowingTimes(times)
    // }

    // function updateWindowingTime(window: number): void {
    //     setWindowingTime(window)
    // }

    // function updateShouldSubscribe(subscribe: boolean): void {
    //     setShouldSubscribe(subscribe)
    // }

    function subscriptionHandler(subscribeHandler: (subscription: Subscription) => void): void {
        setOnSubscribe(subscribeHandler)
    }

    function dataUpdateHandler(updateDataHandler: (seriesName: string, data: Array<Datum>) => void): void {
        setOnUpdateData(updateDataHandler)
    }

    // function timeUpdateHandler(updateTimeHandler: (axisId: string, time: number) => void): void {
    //     setOnUpdateTime(updateTimeHandler)
    // }

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

            // windowingTimes,
            // setWindowingTimeFor,

            seriesObservable,
            windowingTime,
            shouldSubscribe,

            onSubscribe,
            onUpdateTime: handleUpdateTime,
            onUpdateData,
            // setMainGSelection,
            updateDimensions,
            // updateWindowingTime,
            // updateShouldSubscribe,
            // setObservable,
            subscriptionHandler,
            dataUpdateHandler,
            // timeUpdateHandler
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
    // const {chartId, subscriptionHandler, dataUpdateHandler, timeUpdateHandler} = context
    if (
        isNaN(chartId) || subscriptionHandler === undefined ||
        // dataUpdateHandler === undefined || timeUpdateHandler === undefined
        dataUpdateHandler === undefined
    ) {
        throw new Error("useChart can only be used when the parent is a <ChartProvider/>")
    }
    return context
}