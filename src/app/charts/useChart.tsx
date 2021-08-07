import * as React from 'react';
import {createContext, useContext, useEffect, useRef, useState} from 'react';
import {Dimensions, Margin, plotDimensionsFrom} from "./margins";
import {GSelection} from "./d3types";
import {Observable, Subscription} from "rxjs";
import {ChartData} from "./chartData";
import {Datum, Series} from "./datumSeries";
import {noop} from "./utils";
import {PlotDimensions} from "stream-charts/dist/src/app/charts/margins";
import {BaseAxis} from "./axes";

export const defaultMargin: Margin = {top: 30, right: 20, bottom: 30, left: 50}

interface UseChartValues {
    chartId: number
    plotDimensions: Dimensions
    mainG?: GSelection
    container: SVGSVGElement | null
    margin: Margin
    color: string

    // xAxes: Map<string, BaseAxis>
    addXAxis: (axis: BaseAxis, id: string) => void
    xAxisFor: (id: string) => BaseAxis | undefined
    // yAxes: Map<string, BaseAxis>
    addYAxis: (axis: BaseAxis, id: string) => void
    yAxisFor: (id: string) => BaseAxis | undefined

    // initial data
    initialData: Map<string, Series>

    // todo not sure about these
    seriesObservable?: Observable<ChartData>
    windowingTime: number
    shouldSubscribe: boolean

    onSubscribe: (subscription: Subscription) => void
    onUpdateData: (seriesName: string, data: Array<Datum>) => void
    onUpdateTime: (time: number) => void
    setObservable: (observable: Observable<ChartData>) => void

    // newChart: (chartId: number, mainG: GSelection, container: SVGSVGElement) => void
    // newChart: (chartId: number, mainG: GSelection) => void
    setMainGSelection: (g: GSelection) => void
    updateDimensions: (dimensions: PlotDimensions) => void
    updateWindowingTime: (window: number) => void
    updateShouldSubscribe: (subscribe: boolean) => void
    subscriptionHandler: (subscribeHandler: (subscription: Subscription) => void) => void
    dataUpdateHandler: (updateDataHandler: (seriesName: string, data: Array<Datum>) => void) => void
    timeUpdateHandler: (updateTimeHandler: (time: number) => void) => void
}

const defaultUseChartValues: UseChartValues = {
    chartId: NaN,
    container: null,
    plotDimensions: {width: 0, height: 0},
    margin: defaultMargin,
    color: '#d2933f',

    // xAxes: new Map(),
    addXAxis: noop,
    xAxisFor: () => undefined,
    // yAxes: new Map(),
    addYAxis: noop,
    yAxisFor: () => undefined,

    initialData: new Map(),

    windowingTime: NaN,
    shouldSubscribe: false,

    onSubscribe: noop,
    onUpdateData: noop,
    onUpdateTime: noop,

    // newChart: noop,
    setMainGSelection: noop,
    updateDimensions: noop,
    updateWindowingTime: noop,
    updateShouldSubscribe: noop,
    setObservable: noop,
    subscriptionHandler: noop,
    dataUpdateHandler: noop,
    timeUpdateHandler: noop,
}

const ChartContext = createContext<UseChartValues>(defaultUseChartValues)

interface Props {
    container: SVGSVGElement | null
    chartId: number
    containerDimensions: Dimensions
    margin: Margin
    color: string
    initialData: Map<string, Series>

    children: JSX.Element | Array<JSX.Element>
}

export default function ChartProvider(props: Props): JSX.Element {
    const {
        chartId,
        container,
        containerDimensions,
        margin,
        color,
        initialData
    } = props
    // const [chartId, setChartId] = useState<number>(defaultUseChartValues.chartId)
    const [dimensions, setDimensions] = useState<PlotDimensions>(defaultUseChartValues.plotDimensions)
    const [mainG, setMainG] = useState<GSelection>()
    // const [container, setContainer] = useState<SVGSVGElement>()

    const xAxesRef = useRef<Map<string, BaseAxis>>(new Map())
    const yAxesRef = useRef<Map<string, BaseAxis>>(new Map())

    const [seriesObservable, setSeriesObservable] = useState<Observable<ChartData>>()
    const [windowingTime, setWindowingTime] = useState<number>(defaultUseChartValues.windowingTime)
    const [shouldSubscribe, setShouldSubscribe] = useState<boolean>(defaultUseChartValues.shouldSubscribe)

    const [onSubscribe, setOnSubscribe] = useState<(subscription: Subscription) => void>(noop)
    const [onUpdateData, setOnUpdateData] = useState<(seriesName: string, data: Array<Datum>) => void>(noop)
    const [onUpdateTime, setOnUpdateTime] = useState<(time: number) => void>(noop)

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

    function setMainGSelection(g: GSelection): void {
        setMainG(g)
    }

    function setObservable(observable: Observable<ChartData>): void {
        setSeriesObservable(observable)
    }

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

    function updateWindowingTime(window: number): void {
        setWindowingTime(window)
    }

    function updateShouldSubscribe(subscribe: boolean): void {
        setShouldSubscribe(subscribe)
    }

    function subscriptionHandler(subscribeHandler: (subscription: Subscription) => void): void {
        setOnSubscribe(subscribeHandler)
    }

    function dataUpdateHandler(updateDataHandler: (seriesName: string, data: Array<Datum>) => void): void {
        setOnUpdateData(updateDataHandler)
    }

    function timeUpdateHandler(updateTimeHandler: (time: number) => void): void {
        setOnUpdateTime(updateTimeHandler)
    }

    const {children} = props
    return <ChartContext.Provider
        value={{
            chartId,
            plotDimensions: dimensions,
            margin,
            color,
            initialData,
            mainG, container,
            addXAxis, xAxisFor,
            addYAxis, yAxisFor,
            seriesObservable, windowingTime, shouldSubscribe,
            onSubscribe, onUpdateTime, onUpdateData,
            setMainGSelection,
            updateDimensions, updateWindowingTime, updateShouldSubscribe, setObservable,
            subscriptionHandler, dataUpdateHandler, timeUpdateHandler
        }}
    >
        {children}
    </ChartContext.Provider>
}

export function useChart(): UseChartValues {
    const context = useContext<UseChartValues>(ChartContext)
    const {chartId, subscriptionHandler, dataUpdateHandler, timeUpdateHandler} = context
    if (
        isNaN(chartId) || subscriptionHandler === undefined ||
        dataUpdateHandler === undefined || timeUpdateHandler === undefined
    ) {
        throw new Error("useChart can only be used when the parent is a <ChartProvider/>")
    }
    return context
}