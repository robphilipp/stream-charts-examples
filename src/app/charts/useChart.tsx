import * as React from 'react';
import {createContext, useContext, useState} from 'react';
import {Dimensions} from "./margins";
import {GSelection} from "./d3types";
import {Observable, Subscription} from "rxjs";
import {ChartData} from "./chartData";
import {Datum} from "./datumSeries";
import {noop} from "./utils";
import {PlotDimensions} from "stream-charts/dist/src/app/charts/margins";

interface UseChartValues {
    chartId: number
    plotDimensions: Dimensions
    mainG?: GSelection
    container: SVGSVGElement | null

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
    children: JSX.Element | Array<JSX.Element>
}

export default function ChartProvider(props: Props): JSX.Element {
    const {container, chartId} = props
    // const [chartId, setChartId] = useState<number>(defaultUseChartValues.chartId)
    const [dimensions, setDimensions] = useState<PlotDimensions>(defaultUseChartValues.plotDimensions)
    const [mainG, setMainG] = useState<GSelection>()
    // const [container, setContainer] = useState<SVGSVGElement>()

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

    function setMainGSelection(g: GSelection): void {
        setMainG(mainG)
    }

    function setObservable(observable: Observable<ChartData>): void {
        setSeriesObservable(observable)
    }

    function updateDimensions(plotDimensions: PlotDimensions): void {
        setDimensions(plotDimensions)
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
            mainG, container,
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