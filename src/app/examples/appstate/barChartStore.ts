import type {UseBoundStore} from "zustand";
import {create, type StoreApi} from 'zustand';
import {Observable} from "rxjs";
import {shareReplay} from "rxjs/operators";
import type {BaseSeries} from "../../charts/series/baseSeries.ts";
import type {OrdinalDatum} from "../../charts/series/ordinalSeries.ts";
import {type OrdinalChartData, ordinalsObservable} from "../../charts/observables/ordinals.ts";
import {barDanceDataObservable} from "../dataproviders/randomOrdinalData.ts";
import {createInitialVisibility} from "../options/visibility.ts";
import {DEFAULT_DROP_AFTER_10} from "../options/dropDataAfter.ts";
import type {BarPlotZoomState} from "../../charts/plots/BarPlot.tsx";
import {devtools} from "zustand/middleware";
import {type DataSlice, dataSliceStateCreator, type DataStateSlice} from "./stateslices/dataStateSlice.ts";
import {type RunSlice, runSliceStateCreator, type RunStateSlice} from "./stateslices/runStateSlice.ts";
import {
    type VisibilitySlice,
    visibilitySliceStateCreator,
    type VisibilityStateSlice
} from "./stateslices/visibilityStateSlice.ts";

/*
    set up the data state
 */
const DEFAULT_DATA_UPDATE_PERIOD = 50

// note: unlike randomSpikeDataObservable (used by the raster chart), this pipeline *does* carry
// per-subscription state: barDanceDataObservable's time is tick-counted from its `interval` (and
// it re-emits the initial data first via `concat`), and `ordinalsObservable` accumulates the
// series and their (windowed) stats in a `scan`. A fresh `.subscribe()` on remount (after
// BarPlot tears down an inherited subscription) would restart all of that from scratch -- time
// snapping back and the min/max/mean stats being wiped. So, as with randomWeightDataObservable
// (the scatter chart), share one running pipeline across resubscribes -- see that observable's
// `shareReplay` comment for the full explanation, including why `refCount: false`.
const randomData = (updatePeriod: number): (initialData: Array<BaseSeries<OrdinalDatum>>) => Observable<OrdinalChartData> => {
    return initialData => ordinalsObservable(barDanceDataObservable(initialData, updatePeriod)).pipe(
        shareReplay({bufferSize: 1, refCount: false})
    )
}
const randomDataObservable = randomData(DEFAULT_DATA_UPDATE_PERIOD)

const initialDataState: DataStateSlice<OrdinalChartData, OrdinalDatum, BaseSeries<OrdinalDatum>> = {
    initialData: [],
    observable: randomDataObservable([]),
    subscription: undefined
}
const createDataSlice = dataSliceStateCreator<OrdinalChartData, OrdinalDatum, BaseSeries<OrdinalDatum>>(initialDataState, randomDataObservable)

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
type BarChartState = {
    filterValue: string
    dropAfterMs: number
    numberOfSeries: number
    windowingTime: number
    dataUpdatePeriod: number
    // which of the time-series statistics are shown in the plot
    showMinMax: boolean
    showValue: boolean
    showMean: boolean
    showWinMinMax: boolean
    showWinMean: boolean
    // the bar plot's zoom/pan state (undefined when never zoomed/panned), handed back to the
    // plot when it remounts so that navigating away and back doesn't reset the zoom
    zoomState: BarPlotZoomState | undefined
}

const initialState: BarChartState = {
    filterValue: '',
    dropAfterMs: DEFAULT_DROP_AFTER_10[1],
    numberOfSeries: 50,
    windowingTime: 50,
    dataUpdatePeriod: DEFAULT_DATA_UPDATE_PERIOD,
    showMinMax: true,
    showValue: true,
    showMean: true,
    showWinMinMax: true,
    showWinMean: true,
    zoomState: undefined,
}

type BarChartActions = {
    setFilterValue: (filterValue: string) => void
    setDropAfterMs: (dropAfterMs: number) => void
    setNumberOfSeries: (numberOfSeries: number) => void
    setWindowingTime: (windowingTime: number) => void
    setDataUpdatePeriod: (dataUpdatePeriod: number) => void
    setShowMinMax: (show: boolean) => void
    setShowValue: (show: boolean) => void
    setShowMean: (show: boolean) => void
    setShowWinMinMax: (show: boolean) => void
    setShowWinMean: (show: boolean) => void
    setZoomState: (zoomState: BarPlotZoomState) => void
    reset: () => void
}

type BarChartStore = BarChartState & BarChartActions &
    DataSlice<OrdinalChartData, OrdinalDatum, BaseSeries<OrdinalDatum>> &
    RunSlice &
    VisibilitySlice

export const useBarChartStore: UseBoundStore<StoreApi<BarChartStore>> = create<BarChartStore>()(
    devtools<BarChartStore>((set, get, store) => ({
        ...initialState,
        // data slice for initial data, observable, and subscription
        ...createDataSlice(set, get, store),
        // run slice to track and manipulate running state
        ...createRunSlice(set, get, store),

        // the compiled regex is derived from this in the component, so its reference only
        // changes when the filter value actually changes
        setFilterValue: filterValue => set({filterValue}),

        // holds status of the visibility for tooltip, tracker, and axes highlighting
        ...createVisibilitySlice(set, get, store),

        setDropAfterMs: (dropAfterMs: number) => set({dropAfterMs}),

        setNumberOfSeries: (numberOfSeries: number) => set({numberOfSeries}),

        setWindowingTime: (windowingTime: number) => set({windowingTime}),

        setShowMinMax: (showMinMax: boolean) => set({showMinMax}),
        setShowValue: (showValue: boolean) => set({showValue}),
        setShowMean: (showMean: boolean) => set({showMean}),
        setShowWinMinMax: (showWinMinMax: boolean) => set({showWinMinMax}),
        setShowWinMean: (showWinMean: boolean) => set({showWinMean}),

        setZoomState: (zoomState: BarPlotZoomState) => set({zoomState}),

        // rebuilds the observable at the new update period, using whatever initial data is
        // currently in the store -- keeps the RxJS stream's data-generation rate in sync with
        // this setting, since it's baked into the observable at creation time
        setDataUpdatePeriod: (dataUpdatePeriod: number) => set(state => ({
            dataUpdatePeriod,
            observable: randomData(dataUpdatePeriod)(state.initialData)
        })),

        // overrides the data slice's default setInitialData (see createDataSlice above) so that
        // regenerating the initial data (e.g. from a number-of-series change) rebuilds the
        // observable using the *current* dataUpdatePeriod, rather than always reverting to the
        // slice's original default period
        setInitialData: (initialData: Array<BaseSeries<OrdinalDatum>>) => set(state => ({
            initialData,
            observable: randomData(state.dataUpdatePeriod)(initialData)
        })),

        reset: () => set({
            ...initialState,
            ...initialDataState,
            ...initialRunState,
            ...initialVisibilityState
        })
    })));
