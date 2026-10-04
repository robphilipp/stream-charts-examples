import type {UseBoundStore} from "zustand";
import {create, type StoreApi} from 'zustand';
import {devtools} from "zustand/middleware";
import {EMPTY} from "rxjs";
import type {IterateChartData} from "../../charts/observables/iterates.ts";
import {iteratesObservable} from "../../charts/observables/iterates.ts";
import type {IterateSeries} from "../../charts/series/iterateSeries.ts";
import type {Datum, TimeSeries} from "../../charts/series/timeSeries.ts";
import {IteratesDataSource} from "../../charts/datasources/iteratesDataSource.ts";
import type {DataGenerator} from "../../charts/datasources/StreamingDataSource.ts";
import {iterateFunctionObservable} from "../dataproviders/randomIterateData.ts";
import {createInitialVisibility, type Visibility} from "../options/visibility.ts";
import {DEFAULT_DROP_AFTER_20} from "../options/dropDataAfter.ts";
import {type DataSourceSlice, dataSourceSlice} from "./stateslices/dataSourceStateSlice.ts";

/**
 * An iterate function, `x[n+1] = f(x[n])`, as a function of the time and `x[n]`
 */
export type IterateFunction = (time: number, xn: number) => Datum

const UPDATE_PERIOD = 50

/**
 * Creates the iterates generator: iterates the specified function from the seed values, and
 * converts the stream into `f[n](x)` versus `f[n+lag](x)` iterates. Each start iterates from the
 * seed values (as before the data source existed, Run restarts the iteration from the seeds), so
 * the generator ignores the data source's current series.
 * @param iterateFunction The iterate function
 * @param lagN The lag of the iterates plot (e.g. f[n](x) vs f[n+N](x), where N is the lag)
 * @param seeds The seed (initial) value for each series
 * @return The data generator
 */
export const iteratesGenerator = (
    iterateFunction: IterateFunction,
    lagN: number,
    seeds: Array<TimeSeries>
): DataGenerator<IterateChartData, IterateSeries> =>
    () => iteratesObservable(iterateFunctionObservable(iterateFunction, seeds, UPDATE_PERIOD), lagN)

/**
 * A generator that emits nothing -- the chart sets the real generator (from the selected iterate
 * function and lag) just before each run
 */
const NO_DATA: DataGenerator<IterateChartData, IterateSeries> = () => EMPTY

/**
 * Creates the chart's data source
 * @param initialData The initial series (owned by the data source from here on)
 * @param dropAfterMs Data older than this (ms) is dropped
 * @return The data source
 */
const newDataSource = (initialData: Array<IterateSeries>, dropAfterMs: number): IteratesDataSource =>
    new IteratesDataSource({initialData, generator: NO_DATA, dropDataAfter: dropAfterMs})

type PoincareChartState = {
    dropAfterMs: number
    selectedInterpolationName: string
    selectedLagN: string
    selectedIterateFunction: string
    axesRange: [start: number, end: number]
    visibility: Visibility
    highlightAxes: boolean
}

const initialState: PoincareChartState = {
    dropAfterMs: DEFAULT_DROP_AFTER_20[1],
    selectedInterpolationName: 'curveStepAfter',
    selectedLagN: 'lag = 1',
    selectedIterateFunction: 'Tent Map',
    axesRange: [0, 1],
    visibility: createInitialVisibility(),
    highlightAxes: false,
}

type PoincareChartActions = {
    setDropAfterMs: (dropAfterMs: number) => void
    setSelectedInterpolationName: (name: string) => void
    setSelectedLagN: (name: string) => void
    setSelectedIterateFunction: (name: string) => void
    setAxesRange: (range: [start: number, end: number]) => void
    setVisibility: (visibility: Visibility) => void
    setHighlightAxes: (highlight: boolean) => void
}

type PoincareChartStore = PoincareChartState & PoincareChartActions &
    DataSourceSlice<IteratesDataSource, IterateSeries>

/**
 * The Poincaré chart's state, which survives the chart being unmounted (e.g. navigating to
 * another page and back) -- including its data source, which keeps ingesting in the meantime.
 */
export const usePoincareChartStore: UseBoundStore<StoreApi<PoincareChartStore>> = create<PoincareChartStore>()(
    devtools<PoincareChartStore>((set, get) => ({
        ...initialState,
        // the data source (which owns the data generator's subscription and the series), and
        // whether it's running
        ...dataSourceSlice<IteratesDataSource, IterateSeries>(
            set,
            get,
            newDataSource([], initialState.dropAfterMs),
            initialData => newDataSource(initialData, get().dropAfterMs)
        ),

        // data retention belongs to the data source, so keep it in step
        setDropAfterMs: (dropAfterMs: number) => {
            get().dataSource.setDropDataAfter(dropAfterMs)
            set({dropAfterMs})
        },
        setSelectedInterpolationName: (selectedInterpolationName: string) => set({selectedInterpolationName}),
        setSelectedLagN: (selectedLagN: string) => set({selectedLagN}),
        setSelectedIterateFunction: (selectedIterateFunction: string) => set({selectedIterateFunction}),
        setAxesRange: (axesRange: [start: number, end: number]) => set({axesRange}),
        setVisibility: (visibility: Visibility) => set({visibility}),
        setHighlightAxes: (highlightAxes: boolean) => set({highlightAxes}),
    })));
