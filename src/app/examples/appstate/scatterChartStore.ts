import type {UseBoundStore} from "zustand";
import {create, type StoreApi} from 'zustand';
import type {Datum, TimeSeries} from "../../charts/series/timeSeries.ts";
import {Observable} from "rxjs";
import type {TimeSeriesChartData} from "../../charts/series/timeSeriesChartData.ts";
import {randomWeightDataObservable} from "../dataproviders/randomWeightData.ts";
import {createInitialVisibility} from "../options/visibility.ts";
import {devtools} from "zustand/middleware";
import {type DataSlice, dataSliceStateCreator, type DataStateSlice} from "./stateslices/dataStateSlice.ts";
import {type RunSlice, runSliceStateCreator, type RunStateSlice} from "./stateslices/runStateSlice.ts";
import {
    type VisibilitySlice,
    visibilitySliceStateCreator,
    type VisibilityStateSlice
} from "./stateslices/visibilityStateSlice.ts";

export type Range = [start: number, end: number]

/*
    set up the data state
 */
const DATA_DELTA = 25
const DATA_MIN = 10
const DATA_MAX = 1000
const DEFAULT_DATA_UPDATE_PERIOD = 50

const randomData = (delta: number, updatePeriod: number, min: number, max: number): (initialData: Array<TimeSeries>) => Observable<TimeSeriesChartData> => {
    return initialData => randomWeightDataObservable(initialData, delta, updatePeriod, min, max)
}
const randomDataObservable = randomData(DATA_DELTA, DEFAULT_DATA_UPDATE_PERIOD, DATA_MIN, DATA_MAX)

const initialDataState: DataStateSlice<TimeSeriesChartData, Datum, TimeSeries> = {
    initialData: [],
    observable: randomDataObservable([]),
    subscription: undefined
}
const createDataSlice = dataSliceStateCreator<TimeSeriesChartData, Datum, TimeSeries>(initialDataState, randomDataObservable)

/*
    set up the run state
 */
const initialRunState: RunStateSlice = {
    running: false
}
const createRunSlice = runSliceStateCreator(initialRunState)

/*
    set up the visibility state
 */
const initialVisibilityState: VisibilityStateSlice = {
    visibility: createInitialVisibility()
}
const createVisibilitySlice = visibilitySliceStateCreator(initialVisibilityState)

/*
    pull all the slices together
 */
type ScatterChartState = {
    x1axisRange: Range
    x2axisRange: Range
    filterValue: string
    selectedInterpolationName: string
    dropAfterMs: number
    numberOfSeries: number
    windowingTime: number
    cadence: number
    dataUpdatePeriod: number
}

const initialState: ScatterChartState = {
    x1axisRange: [0, 10000],
    x2axisRange: [0, 5000],
    filterValue: '',
    selectedInterpolationName: 'curveLinear',
    dropAfterMs: 20_000,
    numberOfSeries: 10,
    windowingTime: 25,
    cadence: 0,
    dataUpdatePeriod: DEFAULT_DATA_UPDATE_PERIOD,
}

type ScatterChartActions = {
    setX1axisRange: (range: Range) => void
    setX2axisRange: (range: Range) => void
    setFilterValue: (filterValue: string) => void
    setSelectedInterpolationName: (name: string) => void
    setDropAfterMs: (dropAfterMs: number) => void
    setNumberOfSeries: (numberOfSeries: number) => void
    setWindowingTime: (windowingTime: number) => void
    setCadence: (cadence: number) => void
    setDataUpdatePeriod: (dataUpdatePeriod: number) => void
    reset: () => void
}

type ScatterChartStore = ScatterChartState & ScatterChartActions &
    DataSlice<TimeSeriesChartData, Datum, TimeSeries> &
    RunSlice &
    VisibilitySlice

export const useScatterChartStore: UseBoundStore<StoreApi<ScatterChartStore>> = create<ScatterChartStore>()(
    devtools<ScatterChartStore>((set, get, store) => ({
        ...initialState,
        // data slice for initial data, observable, and subscription
        ...createDataSlice(set, get, store),
        // run slice to track and manipulate running state
        ...createRunSlice(set, get, store),

        setX1axisRange: (range: Range) => set({x1axisRange: range}),
        setX2axisRange: (range: Range) => set({x2axisRange: range}),

        // the compiled regex is updated alongside its string representation so that the
        // regex reference only changes when the filter value actually changes
        setFilterValue: filterValue => set({filterValue}),

        // holds status of the visibility for tooltip, tracker, markers, legend
        ...createVisibilitySlice(set, get, store),

        setSelectedInterpolationName: name => set({selectedInterpolationName: name}),

        setDropAfterMs: (dropAfterMs: number) => set({dropAfterMs}),

        setNumberOfSeries: (numberOfSeries: number) => set({numberOfSeries}),

        setWindowingTime: (windowingTime: number) => set({windowingTime}),

        setCadence: (cadence: number) => set({cadence}),

        // rebuilds the observable at the new update period, using whatever initial data is
        // currently in the store -- keeps the RxJS stream's data-generation rate in sync with
        // this setting, since it's baked into the observable at creation time
        setDataUpdatePeriod: (dataUpdatePeriod: number) => set(state => ({
            dataUpdatePeriod,
            observable: randomData(DATA_DELTA, dataUpdatePeriod, DATA_MIN, DATA_MAX)(state.initialData)
        })),

        // overrides the data slice's default setInitialData (see createDataSlice above) so that
        // regenerating the initial data (e.g. from a number-of-series change) rebuilds the
        // observable using the *current* dataUpdatePeriod, rather than always reverting to the
        // slice's original default period
        setInitialData: (initialData: Array<TimeSeries>) => set(state => ({
            initialData,
            observable: randomData(DATA_DELTA, state.dataUpdatePeriod, DATA_MIN, DATA_MAX)(initialData)
        })),

        reset: () => set({
            ...initialState,
            ...initialDataState,
            ...initialRunState,
            ...initialVisibilityState
        })
    })));
