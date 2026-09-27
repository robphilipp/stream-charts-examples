import type {UseBoundStore} from "zustand";
import {create, type StoreApi} from 'zustand';
import type {Datum, TimeSeries} from "../../charts/series/timeSeries.ts";
import {Observable} from "rxjs";
import type {TimeSeriesChartData} from "../../charts/series/timeSeriesChartData.ts";
import {randomSpikeDataObservable} from "../dataproviders/randomSpikeData.ts";
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
const SPIKE_PROBABILITY = 0.1
const DEFAULT_DATA_UPDATE_PERIOD = 50

// note: unlike randomWeightDataObservable (used by the scatter chart), randomSpikeDataObservable
// has no `scan`-based accumulator -- each tick's spikes are generated fresh from a fixed,
// closed-over `initialData.maxTimes` and a wall-clock time anchored at observable-creation. So,
// unlike the scatter chart's store, there's no accumulated per-subscription state that a fresh
// `.subscribe()` call (e.g. on remount, after tearing down an inherited subscription) could lose
// or reset -- and so no need for a `shareReplay` here to keep such state alive across resubscribes.
const randomData = (updatePeriod: number, spikeProbability: number): (initialData: Array<TimeSeries>) => Observable<TimeSeriesChartData> => {
    return initialData => randomSpikeDataObservable(initialData, updatePeriod, spikeProbability)
}
const randomDataObservable = randomData(DEFAULT_DATA_UPDATE_PERIOD, SPIKE_PROBABILITY)

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
type RasterChartState = {
    xAxisRange: Range
    filterValue: string
    dropAfterMs: number
    numberOfSeries: number
    windowingTime: number
    cadence: number
    dataUpdatePeriod: number
}

const initialState: RasterChartState = {
    xAxisRange: [0, 10000],
    filterValue: '',
    dropAfterMs: 20_000,
    numberOfSeries: 50,
    windowingTime: 50,
    cadence: 25,
    dataUpdatePeriod: DEFAULT_DATA_UPDATE_PERIOD,
}

type RasterChartActions = {
    setXAxisRange: (range: Range) => void
    setFilterValue: (filterValue: string) => void
    setDropAfterMs: (dropAfterMs: number) => void
    setNumberOfSeries: (numberOfSeries: number) => void
    setWindowingTime: (windowingTime: number) => void
    setCadence: (cadence: number) => void
    setDataUpdatePeriod: (dataUpdatePeriod: number) => void
    reset: () => void
}

type RasterChartStore = RasterChartState & RasterChartActions &
    DataSlice<TimeSeriesChartData, Datum, TimeSeries> &
    RunSlice &
    VisibilitySlice

export const useRasterChartStore: UseBoundStore<StoreApi<RasterChartStore>> = create<RasterChartStore>()(
    devtools<RasterChartStore>((set, get, store) => ({
        ...initialState,
        // data slice for initial data, observable, and subscription
        ...createDataSlice(set, get, store),
        // run slice to track and manipulate running state
        ...createRunSlice(set, get, store),

        setXAxisRange: (range: Range) => set({xAxisRange: range}),

        // the compiled regex is derived from this in the component, so its reference only
        // changes when the filter value actually changes
        setFilterValue: filterValue => set({filterValue}),

        // holds status of the visibility for tooltip, tracker, markers, legend
        ...createVisibilitySlice(set, get, store),

        setDropAfterMs: (dropAfterMs: number) => set({dropAfterMs}),

        setNumberOfSeries: (numberOfSeries: number) => set({numberOfSeries}),

        setWindowingTime: (windowingTime: number) => set({windowingTime}),

        setCadence: (cadence: number) => set({cadence}),

        // rebuilds the observable at the new update period, using whatever initial data is
        // currently in the store -- keeps the RxJS stream's data-generation rate in sync with
        // this setting, since it's baked into the observable at creation time
        setDataUpdatePeriod: (dataUpdatePeriod: number) => set(state => ({
            dataUpdatePeriod,
            observable: randomData(dataUpdatePeriod, SPIKE_PROBABILITY)(state.initialData)
        })),

        // overrides the data slice's default setInitialData (see createDataSlice above) so that
        // regenerating the initial data (e.g. from a number-of-series change) rebuilds the
        // observable using the *current* dataUpdatePeriod, rather than always reverting to the
        // slice's original default period
        setInitialData: (initialData: Array<TimeSeries>) => set(state => ({
            initialData,
            observable: randomData(state.dataUpdatePeriod, SPIKE_PROBABILITY)(initialData)
        })),

        reset: () => set({
            ...initialState,
            ...initialDataState,
            ...initialRunState,
            ...initialVisibilityState
        })
    })));
