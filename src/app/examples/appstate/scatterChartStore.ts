import {create, type StoreApi} from 'zustand';
import type {TimeSeries} from "../../charts/series/timeSeries.ts";
import {Observable, type Subscription} from "rxjs";
import type {TimeSeriesChartData} from "../../charts/series/timeSeriesChartData.ts";
import {randomWeightDataObservable} from "../dataproviders/randomWeightData.ts";
import {createInitialVisibility, type Visibility} from "../options/visibility.ts";
import type {UseBoundStore} from "zustand/react";

type Range = [start: number, end: number]

const randomData = (delta: number, updatePeriod: number, min: number, max: number): (initialData: Array<TimeSeries>) => Observable<TimeSeriesChartData> => {
    return initialData => randomWeightDataObservable(initialData, delta, updatePeriod, min, max)
}
const randomDataObservable = randomData(25, 50, 10, 1000)

type ScatterChartState = {
    initialData: Array<TimeSeries>
    observable: Observable<TimeSeriesChartData>
    subscription: Subscription | undefined
    running: boolean
    x1axisRange: Range
    x2axisRange: Range
    filterValue: string
    visibility: Visibility
    selectedInterpolationName: string
    dropAfterMs: number
}

const initialState: ScatterChartState = {
    initialData: [],
    observable: randomDataObservable([]),
    subscription: undefined,
    running: false,
    x1axisRange: [0, 10000],
    x2axisRange: [0, 5000],
    filterValue: '',
    visibility: createInitialVisibility(),
    selectedInterpolationName: 'curveLinear',
    dropAfterMs: 20_000,
}

type ScatterChartStore = ScatterChartState & {
    setInitialData: (initialData: Array<TimeSeries>) => void
    setSubscription: (subscription: Subscription) => void
    setRunning: (running: boolean) => void
    startRunning: () => void
    stopRunning: () => void
    setX1axisRange: (range: Range) => void
    setX2axisRange: (range: Range) => void
    setFilterValue: (filterValue: string) => void
    setVisibility: (visibility: Visibility) => void
    setSelectedInterpolationName: (name: string) => void
    setDropAfterMs: (dropAfterMs: number) => void
    reset: () => void
}

export const useScatterChartStore: UseBoundStore<StoreApi<ScatterChartStore>> =
    create<ScatterChartStore>((set) => ({
        ...initialState,
        setInitialData: (initialData: Array<TimeSeries>) => set({
            initialData,
            observable: randomDataObservable(initialData)
        }),

        setSubscription: (subscription: Subscription) => set({subscription}),

        setRunning: running => set({running}),
        startRunning: () => set({running: true}),
        stopRunning: () => set({running: false}),

        setX1axisRange: (range: Range) => set({x1axisRange: range}),
        setX2axisRange: (range: Range) => set({x2axisRange: range}),

        setFilterValue: filterValue => set({filterValue}),

        // holds status of the visibility for tooltip, tracker, markers, legend
        setVisibility: visibility => set({visibility}),

        setSelectedInterpolationName: name => set({selectedInterpolationName: name}),

        setDropAfterMs: (dropAfterMs: number) => set({dropAfterMs}),

        reset: () => set(initialState)
    }));
