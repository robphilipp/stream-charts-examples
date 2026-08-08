import {create} from 'zustand';
import type {TimeSeries} from "../../charts/series/timeSeries.ts";
import {Observable, type Subscription} from "rxjs";
import type {TimeSeriesChartData} from "../../charts/series/timeSeriesChartData.ts";
import {randomWeightDataObservable} from "../dataproviders/randomWeightData.ts";
import {createInitialVisibility, type Visibility} from "../options/visibility.ts";

type Range = [start: number, end: number]

interface ScatterChartStore {
    initialData: Array<TimeSeries>
    setInitialData: (initialData: Array<TimeSeries>) => void

    observable: Observable<TimeSeriesChartData>

    subscription: Subscription | undefined
    setSubscription: (subscription: Subscription) => void

    running: boolean
    setRunning: (running: boolean) => void
    startRunning: () => void
    stopRunning: () => void

    x1axisRange: Range
    setX1axisRange: (range: Range) => void
    x2axisRange: Range
    setX2axisRange: (range: Range) => void

    filterValue: string
    setFilterValue: (filterValue: string) => void

    visibility: Visibility
    setVisibility: (visibility: Visibility) => void

    selectedInterpolationName: string
    setSelectedInterpolationName: (name: string) => void

    dropAfterMs: number
    setDropAfterMs: (dropAfterMs: number) => void
}

const randomData = (delta: number, updatePeriod: number, min: number, max: number): (initialData: Array<TimeSeries>) => Observable<TimeSeriesChartData> => {
    return initialData => randomWeightDataObservable(initialData, delta, updatePeriod, min, max)
}
const randomDataObservable = randomData(25, 50, 10, 1000)

export const useScatterChartStore = create<ScatterChartStore>((set) => ({
    initialData: [],
    setInitialData: (initialData: Array<TimeSeries>) => set({
        initialData,
        observable: randomDataObservable(initialData)
    }),

    observable: randomDataObservable([]),

    subscription: undefined,
    setSubscription: (subscription: Subscription) => set({subscription}),

    running: false,
    setRunning: running => set({running}),
    startRunning: () => set({running: true}),
    stopRunning: () => set({running: false}),

    x1axisRange: [0, 10000],
    setX1axisRange: (range: Range) => set({x1axisRange: range}),
    x2axisRange: [0, 5000],
    setX2axisRange: (range: Range) => set({x2axisRange: range}),

    filterValue: '',
    setFilterValue: filterValue => set({filterValue}),

    // holds status of the visibility for tooltip, tracker, markers, legend
    visibility: createInitialVisibility(),
    setVisibility: visibility => set({visibility}),

    selectedInterpolationName: 'curveLinear',
    setSelectedInterpolationName: name => set({selectedInterpolationName: name}),

    dropAfterMs: 0,
    setDropAfterMs: (dropAfterMs: number) => set({dropAfterMs}),
}));
