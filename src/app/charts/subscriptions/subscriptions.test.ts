import {scaleBand, scaleLinear} from "d3";
import {Subject} from "rxjs";
import {FastShiftArray} from "fast-shift-array";
import {
    subscriptionOrdinalXFor,
    subscriptionOutlierFor,
    subscriptionTimeSeriesFor,
    subscriptionTimeSeriesWithCadenceFor,
    TimeWindowBehavior,
    type WindowedOrdinalStats,
} from "./subscriptions";
import {AxesState} from "../axes/AxesState";
import {AxisLocation, type ContinuousNumericAxis, type OrdinalStringAxis} from "../axes/axes";
import {ContinuousAxisRange} from "../axes/ContinuousAxisRange";
import {OrdinalAxisRange} from "../axes/OrdinalAxisRange";
import {type AxesAssignment, assignAxes} from "../plots/plot";
import {datumOf} from "../series/timeSeries";
import type {TimeSeries} from "../series/timeSeries";
import {type BaseSeries, seriesFrom} from "../series/baseSeries";
import type {TimeSeriesChartData} from "../series/timeSeriesChartData";
import type {OutlierDatum, OutlierSeries} from "../series/outlierSeries";
import type {OutlierChartData} from "../observables/outliers";
import {defaultOrdinalStats, defaultOrdinalValueStats, type OrdinalChartData} from "../observables/ordinals";
import {ordinalDatumOf, type OrdinalDatum} from "../series/ordinalSeries";

/**
 * Exercises the actual exported subscription-creating functions that {@link subscription.test.ts}
 * doesn't (see the adversarial review's H7 finding) -- `subscriptionTimeSeriesFor` and
 * `subscriptionTimeSeriesWithCadenceFor` here, covering the `dropDataAfter` dequeue, SCROLL vs
 * SQUEEZE window behavior, cadence-anchor correction, the synchronous catch-up on subscribe, and
 * visibility resync that the module's own comments describe as previously buggy.
 */

function fakeContinuousAxis(domain: [number, number] = [0, 1000]): ContinuousNumericAxis {
    return {
        axisId: 'x-axis-1',
        location: AxisLocation.Bottom,
        scale: scaleLinear().domain(domain),
        update: () => {
        },
        updateFont: () => {
        },
        setHighlighted: () => {
        },
    }
}

function axesStateWith(axisId: string, domain: [number, number] = [0, 1000]): AxesState<ContinuousNumericAxis> {
    return AxesState.from<ContinuousNumericAxis>(new Map([[axisId, fakeContinuousAxis(domain)]]))
}

function chartDataFor(newPoints: Map<string, Array<{x: number, y: number}>>, maxTime: number): TimeSeriesChartData {
    return {
        seriesNames: new Set(newPoints.keys()),
        maxTime,
        maxTimes: new Map(Array.from(newPoints.entries()).map(([name, points]) => [name, points[points.length - 1].x])),
        newPoints,
    }
}

describe('subscriptionTimeSeriesFor', () => {
    // every subscription created in a test, torn down in `afterEach` so `bufferTime`'s internal
    // timer doesn't keep the fake-timer clock (and the test process) busy past the test's end
    let liveSubscriptions: Array<{unsubscribe: () => void}> = []
    afterEach(() => {
        liveSubscriptions.forEach(subscription => subscription.unsubscribe())
        liveSubscriptions = []
        jest.useRealTimers()
    })

    type TimeSeriesSubscribeOptions = {
        xAxesState?: AxesState<ContinuousNumericAxis>,
        axisAssignments?: Map<string, AxesAssignment>,
        dropDataAfter?: number,
        timeWindowBehavior?: TimeWindowBehavior,
        initialTimes?: Map<string, number>,
        updateTimingAndPlot?: (ranges: Map<string, ContinuousAxisRange>) => void,
        setCurrentTime?: (axisId: string, end: number) => void,
    }

    // subscribes with a fresh `Subject` so the test controls exactly when data arrives, then
    // returns that `Subject` alongside the subscription so the test can push into it
    function subscribeWithSource(
        seriesMap: Map<string, TimeSeries>,
        options: TimeSeriesSubscribeOptions = {},
    ) {
        const source = new Subject<TimeSeriesChartData>()
        const subscription = subscriptionTimeSeriesFor(
            source,
            () => {
            },
            100,
            options.axisAssignments ?? new Map(),
            options.xAxesState ?? axesStateWith('x-axis-1'),
            undefined,
            options.dropDataAfter ?? Infinity,
            options.updateTimingAndPlot ?? (() => {
            }),
            seriesMap,
            options.setCurrentTime ?? (() => {
            }),
            options.timeWindowBehavior,
            options.initialTimes,
        )
        liveSubscriptions.push(subscription)
        return {source, subscription}
    }

    it('adds new points to the series and advances the (SCROLL) window to cover the new time', () => {
        jest.useFakeTimers()
        const seriesMap = new Map<string, TimeSeries>([['series-a', seriesFrom('series-a', [])]])
        const updateTimingAndPlot = jest.fn()
        const setCurrentTime = jest.fn()
        const {source} = subscribeWithSource(seriesMap, {updateTimingAndPlot, setCurrentTime})

        source.next(chartDataFor(new Map([['series-a', [datumOf(1500, 42)]]]), 1500))
        jest.advanceTimersByTime(100)

        expect(seriesMap.get('series-a')!.data.length).toBe(1)
        expect(seriesMap.get('series-a')!.data[0]).toEqual(datumOf(1500, 42))

        const ranges = updateTimingAndPlot.mock.calls[0][0] as Map<string, ContinuousAxisRange>
        // SCROLL: the window slides to keep its original width (1000), landing at [500, 1500]
        // rather than just growing to cover the new point
        expect(ranges.get('x-axis-1')!.current.asTuple()).toEqual([500, 1500])
        expect(setCurrentTime).toHaveBeenCalledWith('x-axis-1', 1000)
    })

    it('SQUEEZE mode pins the window start at initialStart and widens instead of sliding', () => {
        jest.useFakeTimers()
        const seriesMap = new Map<string, TimeSeries>([['series-a', seriesFrom('series-a', [])]])
        const updateTimingAndPlot = jest.fn()
        const {source} = subscribeWithSource(seriesMap, {
            updateTimingAndPlot,
            timeWindowBehavior: TimeWindowBehavior.SQUEEZE,
            initialTimes: new Map([['x-axis-1', 0]]),
        })

        source.next(chartDataFor(new Map([['series-a', [datumOf(1500, 42)]]]), 1500))
        jest.advanceTimersByTime(100)

        const ranges = updateTimingAndPlot.mock.calls[0][0] as Map<string, ContinuousAxisRange>
        // SQUEEZE: start stays pinned at 0, so the window widens to [0, 1500] instead of sliding
        expect(ranges.get('x-axis-1')!.current.asTuple()).toEqual([0, 1500])
    })

    it('drops data older than dropDataAfter relative to the axis current time', () => {
        jest.useFakeTimers()
        const seeded = seriesFrom('series-a', [datumOf(0, 1), datumOf(100, 2), datumOf(200, 3)])
        const seriesMap = new Map<string, TimeSeries>([['series-a', seeded]])
        const {source} = subscribeWithSource(seriesMap, {dropDataAfter: 250})

        // new point at t=400: a point is dropped while (currentAxisTime - point.x) > dropDataAfter
        // (250), so t=0 (gap 400) and t=100 (gap 300) are dropped, but t=200 (gap 200) and the new
        // t=400 point (gap 0) both survive
        source.next(chartDataFor(new Map([['series-a', [datumOf(400, 4)]]]), 400))
        jest.advanceTimersByTime(100)

        const remaining = Array.from({length: seriesMap.get('series-a')!.data.length}, (_, i) => seriesMap.get('series-a')!.data[i])
        expect(remaining.map(d => d.x)).toEqual([200, 400])
    })

    it('does not drop data when dropDataAfter is never exceeded', () => {
        jest.useFakeTimers()
        const seeded = seriesFrom('series-a', [datumOf(0, 1), datumOf(50, 2)])
        const seriesMap = new Map<string, TimeSeries>([['series-a', seeded]])
        const {source} = subscribeWithSource(seriesMap, {dropDataAfter: 1000})

        source.next(chartDataFor(new Map([['series-a', [datumOf(60, 3)]]]), 60))
        jest.advanceTimersByTime(100)

        expect(seriesMap.get('series-a')!.data.length).toBe(3)
    })

    it('routes a series to its explicitly-assigned axis rather than the default', () => {
        jest.useFakeTimers()
        const xAxesState = AxesState.from<ContinuousNumericAxis>(new Map([
            ['x-axis-1', fakeContinuousAxis([0, 1000])],
            ['x-axis-2', fakeContinuousAxis([0, 1000])],
        ]))
        const axisAssignments = new Map([['series-b', assignAxes('x-axis-2', 'y-axis-1')]])
        const seriesMap = new Map<string, TimeSeries>([
            ['series-a', seriesFrom('series-a', [])],
            ['series-b', seriesFrom('series-b', [])],
        ])
        const updateTimingAndPlot = jest.fn()
        const {source} = subscribeWithSource(seriesMap, {xAxesState, axisAssignments, updateTimingAndPlot})

        source.next(chartDataFor(
            new Map([
                ['series-a', [datumOf(1500, 1)]],
                ['series-b', [datumOf(1800, 2)]],
            ]),
            1800,
        ))
        jest.advanceTimersByTime(100)

        const ranges = updateTimingAndPlot.mock.calls[updateTimingAndPlot.mock.calls.length - 1][0] as Map<string, ContinuousAxisRange>
        // series-a (unassigned) advances the default axis (x-axis-1) to its own time (1500), while
        // series-b (assigned to x-axis-2) advances x-axis-2 to its own, later time (1800) --
        // proving the two axes track their assigned series independently, not just whichever is default
        expect(ranges.get('x-axis-1')!.current.end).toBe(1500)
        expect(ranges.get('x-axis-2')!.current.end).toBe(1800)
    })
})

/**
 * `subscriptionTimeSeriesWithCadenceFor` unconditionally calls the browser's
 * `requestAnimationFrame`/`cancelAnimationFrame` (no `typeof` guard, unlike its `document` usage
 * below) -- in this project's plain-Node Jest environment (no jsdom; see CLAUDE.md/memory notes)
 * those are simply undefined, so calling the function at all throws `ReferenceError` without this
 * polyfill. Built on `setTimeout` so it still advances deterministically under `jest.useFakeTimers()`.
 */
function installRafPolyfill(): void {
    const g = global as unknown as {
        requestAnimationFrame: (cb: (t: number) => void) => number
        cancelAnimationFrame: (id: number) => void
    }
    g.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0) as unknown as number
    g.cancelAnimationFrame = (id) => clearTimeout(id as unknown as NodeJS.Timeout)
}

/**
 * `document` usage in `subscriptionTimeSeriesWithCadenceFor` IS guarded by `typeof document !==
 * 'undefined'`, so omitting this stub doesn't throw -- it just means the visibility-resync
 * feature is silently unreachable, which is the "zero regression coverage for ... visibility
 * resync logic" H7 flagged. Returns the captured listener so a test can invoke it directly to
 * simulate a real `visibilitychange` event firing.
 */
function installDocumentStub(): {getVisibilityChangeListener: () => (() => void) | undefined, setVisible: (visible: boolean) => void} {
    let listener: (() => void) | undefined
    let visible = true
    const g = global as unknown as {document: unknown}
    g.document = {
        get visibilityState() {
            return visible ? 'visible' : 'hidden'
        },
        addEventListener: (_event: string, handler: () => void) => {
            listener = handler
        },
        removeEventListener: (_event: string, handler: () => void) => {
            if (listener === handler) listener = undefined
        },
    }
    return {
        getVisibilityChangeListener: () => listener,
        setVisible: (v: boolean) => {
            visible = v
        },
    }
}

function uninstallGlobalStubs(): void {
    const g = global as unknown as {document?: unknown, requestAnimationFrame?: unknown, cancelAnimationFrame?: unknown}
    delete g.document
    delete g.requestAnimationFrame
    delete g.cancelAnimationFrame
}

describe('subscriptionTimeSeriesWithCadenceFor', () => {
    let liveSubscriptions: Array<{unsubscribe: () => void}> = []

    beforeEach(() => {
        jest.useFakeTimers()
        installRafPolyfill()
    })

    afterEach(() => {
        liveSubscriptions.forEach(subscription => subscription.unsubscribe())
        liveSubscriptions = []
        uninstallGlobalStubs()
        jest.useRealTimers()
    })

    function subscribeWithSource(
        seriesMap: Map<string, TimeSeries>,
        cadencePeriod: number,
        options: {
            xAxesState?: AxesState<ContinuousNumericAxis>,
            dropDataAfter?: number,
            updateTimingAndPlot?: (ranges: Map<string, ContinuousAxisRange>) => void,
            setCurrentTime?: (axisId: string, end: number) => void,
        } = {},
    ) {
        const source = new Subject<TimeSeriesChartData>()
        const subscription = subscriptionTimeSeriesWithCadenceFor(
            source,
            () => {
            },
            100,
            new Map(),
            options.xAxesState ?? axesStateWith('x-axis-1'),
            undefined,
            options.dropDataAfter ?? Infinity,
            options.updateTimingAndPlot ?? (() => {
            }),
            seriesMap,
            options.setCurrentTime ?? (() => {
            }),
            cadencePeriod,
        )
        liveSubscriptions.push(subscription)
        return {source, subscription}
    }

    it('synchronously catches the axis up to inherited seriesMap data on subscribe, before any tick', () => {
        // simulates a remounted plot: seriesMap already holds data from before this subscription
        // existed (see `ScatterPlot`'s inherited-subscription teardown), far ahead of the axis's
        // fresh [0, 1000] domain
        const seriesMap = new Map<string, TimeSeries>([
            ['series-a', seriesFrom('series-a', [datumOf(5000, 1)])],
        ])
        const updateTimingAndPlot = jest.fn()
        subscribeWithSource(seriesMap, 50, {updateTimingAndPlot})

        // must have already been called synchronously, before advancing any fake timer at all
        expect(updateTimingAndPlot).toHaveBeenCalled()
        const ranges = updateTimingAndPlot.mock.calls[0][0] as Map<string, ContinuousAxisRange>
        expect(ranges.get('x-axis-1')!.current.end).toBe(5000)
    })

    it('is a no-op catch-up on a fresh subscribe with no inherited data', () => {
        const seriesMap = new Map<string, TimeSeries>()
        const updateTimingAndPlot = jest.fn()
        subscribeWithSource(seriesMap, 50, {updateTimingAndPlot})

        // knownTime is -Infinity with nothing in seriesMap, so the synchronous catch-up's
        // `isFinite(knownTime)` guard must skip calling updateTimingAndPlot entirely here
        expect(updateTimingAndPlot).not.toHaveBeenCalled()
    })

    it('never advances the axis on cadence alone when no data has ever been seen (no anchor to project from)', () => {
        // `knownTime` (the cadence anchor) is seeded from `seriesMap` at subscribe time and from
        // then on only ever corrected by real data ticks (see the `currentAxisTime >
        // cadenceTimeNow()` branch) -- with an empty `seriesMap` and no data ever arriving, it
        // starts and stays at -Infinity, so every cadence tick projects `cadenceTimeNow()` as
        // -Infinity too. `setCurrentTime` is still called every tick (unconditionally) with that
        // garbage value, but `advanceAxisRangeInMapTo`'s `endTime < targetTime` gate against
        // -Infinity never passes, so the axis range itself never actually moves. Cadence alone
        // only ever *continues* progress from a real anchor; it can't originate one from nothing
        // -- in practice a chart always seeds at least one initial datum before relying on it.
        const seriesMap = new Map<string, TimeSeries>()
        const setCurrentTime = jest.fn()
        const updateTimingAndPlot = jest.fn()
        subscribeWithSource(seriesMap, 50, {setCurrentTime, updateTimingAndPlot})

        jest.advanceTimersByTime(200)

        expect(setCurrentTime).toHaveBeenCalled()
        setCurrentTime.mock.calls.forEach(call => expect(call[1]).toBe(-Infinity))

        expect(updateTimingAndPlot).toHaveBeenCalled()
        const lastRanges = updateTimingAndPlot.mock.calls[updateTimingAndPlot.mock.calls.length - 1][0] as Map<string, ContinuousAxisRange>
        // the axis is still exactly at its fresh, un-advanced [0, 1000] domain
        expect(lastRanges.get('x-axis-1')!.current.asTuple()).toEqual([0, 1000])
    })

    it('advances the axis window on cadence ticks alone once a real anchor exists', () => {
        // seed one datum so `knownTime` starts finite (e.g. the chart's initial seed data, or a
        // remount inheriting prior stream progress), then let only cadence run from there
        const seriesMap = new Map<string, TimeSeries>([['series-a', seriesFrom('series-a', [datumOf(1000, 1)])]])
        const setCurrentTime = jest.fn()
        subscribeWithSource(seriesMap, 50, {setCurrentTime})
        setCurrentTime.mockClear() // drop the calls from the synchronous catch-up on subscribe

        jest.advanceTimersByTime(200)

        // cadence reports knownTime (1000) plus elapsed wall-clock time since subscribe; after
        // 200ms of fake-timer advance it must have advanced to a time in that ballpark
        expect(setCurrentTime).toHaveBeenCalled()
        const lastCall = setCurrentTime.mock.calls[setCurrentTime.mock.calls.length - 1]
        expect(lastCall[0]).toBe('x-axis-1')
        expect(lastCall[1]).toBeGreaterThanOrEqual(1000 + 150)
        expect(lastCall[1]).toBeLessThanOrEqual(1000 + 250)
    })

    it('corrects the cadence anchor forward when real data overtakes it, instead of drifting behind', () => {
        const seriesMap = new Map<string, TimeSeries>([['series-a', seriesFrom('series-a', [])]])
        const updateTimingAndPlot = jest.fn()
        const {source} = subscribeWithSource(seriesMap, 50, {updateTimingAndPlot})

        // let a little cadence-driven time pass, then delivers a real data point far ahead of
        // where cadence's own wall-clock projection is (simulating a remount's reseeded seriesMap
        // catching back up, per this function's own `knownTime` doc comment)
        jest.advanceTimersByTime(20)
        source.next(chartDataFor(new Map([['series-a', [datumOf(50_000, 1)]]]), 50_000))
        jest.advanceTimersByTime(100) // flush the data buffer

        const rangesAfterData = updateTimingAndPlot.mock.calls[updateTimingAndPlot.mock.calls.length - 1][0] as Map<string, ContinuousAxisRange>
        expect(rangesAfterData.get('x-axis-1')!.current.end).toBe(50_000)

        // the next cadence tick must continue forward from the corrected anchor (~50_000 + a few
        // ms), not from the old wall-clock-elapsed projection (~120ms) the anchor would otherwise
        // still be stuck at
        jest.advanceTimersByTime(50)
        const rangesAfterCadence = updateTimingAndPlot.mock.calls[updateTimingAndPlot.mock.calls.length - 1][0] as Map<string, ContinuousAxisRange>
        expect(rangesAfterCadence.get('x-axis-1')!.current.end).toBeGreaterThan(50_000)
    })

    it('drops data older than dropDataAfter in cadence mode too', () => {
        const seeded = seriesFrom('series-a', [datumOf(0, 1), datumOf(100, 2), datumOf(200, 3)])
        const seriesMap = new Map<string, TimeSeries>([['series-a', seeded]])
        const {source} = subscribeWithSource(seriesMap, 50, {dropDataAfter: 250})

        source.next(chartDataFor(new Map([['series-a', [datumOf(400, 4)]]]), 400))
        jest.advanceTimersByTime(100)

        const series = seriesMap.get('series-a')!
        const remaining = Array.from({length: series.data.length}, (_, i) => series.data[i])
        expect(remaining.map(d => d.x)).toEqual([200, 400])
    })

    it('resyncs the axis to seriesMap ground truth when the page becomes visible again', () => {
        const {getVisibilityChangeListener, setVisible} = installDocumentStub()
        const seriesMap = new Map<string, TimeSeries>()
        const updateTimingAndPlot = jest.fn()
        const setCurrentTime = jest.fn()
        subscribeWithSource(seriesMap, 50, {updateTimingAndPlot, setCurrentTime})

        // simulates data having arrived (from the still-running shared observable) while the tab
        // was hidden -- the resync handler reads straight from seriesMap, not from any tick
        seriesMap.set('series-a', seriesFrom('series-a', [datumOf(9000, 1)]))
        updateTimingAndPlot.mockClear()

        const listener = getVisibilityChangeListener()
        expect(listener).toBeDefined()
        setVisible(true)
        listener!()

        expect(updateTimingAndPlot).toHaveBeenCalled()
        const ranges = updateTimingAndPlot.mock.calls[0][0] as Map<string, ContinuousAxisRange>
        expect(ranges.get('x-axis-1')!.current.end).toBe(9000)
        expect(setCurrentTime).toHaveBeenCalledWith('x-axis-1', 9000)
    })

    it('does not resync when the visibilitychange listener fires while still hidden', () => {
        const {getVisibilityChangeListener, setVisible} = installDocumentStub()
        const seriesMap = new Map<string, TimeSeries>()
        const updateTimingAndPlot = jest.fn()
        subscribeWithSource(seriesMap, 50, {updateTimingAndPlot})

        seriesMap.set('series-a', seriesFrom('series-a', [datumOf(9000, 1)]))
        updateTimingAndPlot.mockClear()

        setVisible(false)
        getVisibilityChangeListener()!()

        expect(updateTimingAndPlot).not.toHaveBeenCalled()
    })

    it('removes the visibilitychange listener on unsubscribe', () => {
        const {getVisibilityChangeListener} = installDocumentStub()
        const seriesMap = new Map<string, TimeSeries>()
        const {subscription} = subscribeWithSource(seriesMap, 50)

        expect(getVisibilityChangeListener()).toBeDefined()
        subscription.unsubscribe()
        expect(getVisibilityChangeListener()).toBeUndefined()
    })
})

type M1 = readonly [number]

function outlierDatum(time: number, value: number): OutlierDatum<M1> {
    return {datum: {x: time, y: value}, bounds: [{lower: 0, upper: 1}]}
}

function outlierSeries(name: string, data: Array<OutlierDatum<M1>> = []): OutlierSeries<M1> {
    return {...seriesFrom<OutlierDatum<M1>>(name, data), measures: [0.95] as const}
}

function outlierChartDataFor(newPoints: Map<string, Array<OutlierDatum<M1>>>): OutlierChartData<M1> {
    return {
        seriesNames: new Set(newPoints.keys()),
        newPoints,
    }
}

describe('subscriptionOutlierFor', () => {
    let liveSubscriptions: Array<{unsubscribe: () => void}> = []
    afterEach(() => {
        liveSubscriptions.forEach(subscription => subscription.unsubscribe())
        liveSubscriptions = []
        jest.useRealTimers()
    })

    function subscribeWithSource(
        seriesMap: Map<string, OutlierSeries<M1>>,
        options: {
            xAxesState?: AxesState<ContinuousNumericAxis>,
            axisAssignments?: Map<string, AxesAssignment>,
            dropDataAfter?: number,
            updateTimingAndPlot?: (ranges: Map<string, ContinuousAxisRange>) => void,
            setCurrentTime?: (axisId: string, end: number) => void,
        } = {},
    ) {
        const source = new Subject<OutlierChartData<M1>>()
        const subscription = subscriptionOutlierFor<M1>(
            source,
            () => {
            },
            100,
            options.axisAssignments ?? new Map(),
            options.xAxesState ?? axesStateWith('x-axis-1'),
            undefined,
            options.dropDataAfter ?? Infinity,
            options.updateTimingAndPlot ?? (() => {
            }),
            seriesMap,
            options.setCurrentTime ?? (() => {
            }),
        )
        liveSubscriptions.push(subscription)
        return {source, subscription}
    }

    it('adds new points to the series and advances the window to cover the new time', () => {
        jest.useFakeTimers()
        const seriesMap = new Map<string, OutlierSeries<M1>>([['series-a', outlierSeries('series-a')]])
        const updateTimingAndPlot = jest.fn()
        const {source} = subscribeWithSource(seriesMap, {updateTimingAndPlot})

        source.next(outlierChartDataFor(new Map([['series-a', [outlierDatum(1500, 42)]]])))
        jest.advanceTimersByTime(100)

        expect(seriesMap.get('series-a')!.data.length).toBe(1)
        expect(seriesMap.get('series-a')!.data[0]).toEqual(outlierDatum(1500, 42))

        const ranges = updateTimingAndPlot.mock.calls[0][0] as Map<string, ContinuousAxisRange>
        expect(ranges.get('x-axis-1')!.current.asTuple()).toEqual([500, 1500])
    })

    it('auto-creates and stores a series that is not yet in seriesMap', () => {
        // unlike subscriptionTimeSeriesFor, this function stores the freshly-created series back
        // into seriesMap when a new series name arrives that wasn't already present
        jest.useFakeTimers()
        const seriesMap = new Map<string, OutlierSeries<M1>>()
        const {source} = subscribeWithSource(seriesMap)

        source.next(outlierChartDataFor(new Map([['brand-new', [outlierDatum(10, 1)]]])))
        jest.advanceTimersByTime(100)

        expect(seriesMap.has('brand-new')).toBe(true)
        expect(seriesMap.get('brand-new')!.data.length).toBe(1)
    })

    it('drops data older than dropDataAfter relative to the axis current time', () => {
        jest.useFakeTimers()
        const seeded = outlierSeries('series-a', [outlierDatum(0, 1), outlierDatum(100, 2), outlierDatum(200, 3)])
        const seriesMap = new Map<string, OutlierSeries<M1>>([['series-a', seeded]])
        const {source} = subscribeWithSource(seriesMap, {dropDataAfter: 250})

        source.next(outlierChartDataFor(new Map([['series-a', [outlierDatum(400, 4)]]])))
        jest.advanceTimersByTime(100)

        const series = seriesMap.get('series-a')!
        const remaining = Array.from({length: series.data.length}, (_, i) => series.data[i])
        expect(remaining.map(d => d.datum.x)).toEqual([200, 400])
    })
})

function fakeOrdinalAxis(axisId: string): OrdinalStringAxis {
    return {
        axisId,
        location: AxisLocation.Left,
        scale: scaleBand<string>(),
        categorySize: 10,
        update: () => 10,
        updateFont: () => {
        },
        setHighlighted: () => {
        },
    }
}

function windowedOrdinalStatsRef(): {current: WindowedOrdinalStats} {
    return {current: {...defaultOrdinalStats(), windowedValueStatsForSeries: new Map()}}
}

function ordinalChartDataFor(newPoints: Map<string, Array<OrdinalDatum>>, maxTimeDatum: OrdinalDatum): OrdinalChartData {
    return {
        seriesNames: new Set(newPoints.keys()),
        newPoints: new Map(Array.from(newPoints.entries()).map(([name, points]) => [name, FastShiftArray.fromArray(points)])),
        stats: {
            ...defaultOrdinalStats(),
            maxDatum: {time: maxTimeDatum, value: maxTimeDatum},
            valueStatsForSeries: new Map(Array.from(newPoints.keys()).map(name => [name, defaultOrdinalValueStats()])),
        },
    }
}

describe('subscriptionOrdinalXFor', () => {
    let liveSubscriptions: Array<{unsubscribe: () => void}> = []
    afterEach(() => {
        liveSubscriptions.forEach(subscription => subscription.unsubscribe())
        liveSubscriptions = []
        jest.useRealTimers()
    })

    function subscribeWithSource(
        seriesMap: Map<string, BaseSeries<OrdinalDatum>>,
        options: {
            yAxesState?: AxesState<OrdinalStringAxis>,
            axisAssignments?: Map<string, AxesAssignment>,
            dropDataAfter?: number,
            updateTimingAndPlot?: (ranges: Map<string, OrdinalAxisRange>) => void,
            setCurrentTime?: (currentTime: number) => void,
            ordinalStatsRef?: {current: WindowedOrdinalStats},
        } = {},
    ) {
        const source = new Subject<OrdinalChartData>()
        const subscription = subscriptionOrdinalXFor(
            source,
            () => {
            },
            100,
            options.axisAssignments ?? new Map(),
            options.yAxesState ?? AxesState.from<OrdinalStringAxis>(new Map([['y-axis-1', fakeOrdinalAxis('y-axis-1')]])),
            undefined,
            options.dropDataAfter ?? Infinity,
            options.updateTimingAndPlot ?? (() => {
            }),
            seriesMap,
            options.ordinalStatsRef ?? windowedOrdinalStatsRef(),
            options.setCurrentTime ?? (() => {
            }),
        )
        liveSubscriptions.push(subscription)
        return {source, subscription}
    }

    it('adds new points to the series and reports the current time from the chart-wide max time datum', () => {
        jest.useFakeTimers()
        const seriesMap = new Map<string, BaseSeries<OrdinalDatum>>([['series-a', seriesFrom<OrdinalDatum>('series-a', [])]])
        const updateTimingAndPlot = jest.fn()
        const setCurrentTime = jest.fn()
        const {source} = subscribeWithSource(seriesMap, {updateTimingAndPlot, setCurrentTime})

        const newDatum = ordinalDatumOf(500, 'series-a', 42)
        source.next(ordinalChartDataFor(new Map([['series-a', [newDatum]]]), newDatum))
        jest.advanceTimersByTime(100)

        expect(seriesMap.get('series-a')!.data.length).toBe(1)
        expect(seriesMap.get('series-a')!.data[0]).toEqual(newDatum)
        expect(setCurrentTime).toHaveBeenCalledWith(500)
        expect(updateTimingAndPlot).toHaveBeenCalled()
        const ranges = updateTimingAndPlot.mock.calls[0][0] as Map<string, OrdinalAxisRange>
        expect(ranges.has('y-axis-1')).toBe(true)
    })

    it('copies the chart-wide min/max stats into ordinalStatsRef', () => {
        jest.useFakeTimers()
        const seriesMap = new Map<string, BaseSeries<OrdinalDatum>>([['series-a', seriesFrom<OrdinalDatum>('series-a', [])]])
        const statsRef = windowedOrdinalStatsRef()
        const {source} = subscribeWithSource(seriesMap, {ordinalStatsRef: statsRef})

        const newDatum = ordinalDatumOf(500, 'series-a', 42)
        source.next(ordinalChartDataFor(new Map([['series-a', [newDatum]]]), newDatum))
        jest.advanceTimersByTime(100)

        expect(statsRef.current.maxDatum.time).toEqual(newDatum)
        expect(statsRef.current.windowedValueStatsForSeries.has('series-a')).toBe(true)
    })

    it('drops data older than dropDataAfter relative to the chart-wide current time', () => {
        jest.useFakeTimers()
        const seeded = seriesFrom<OrdinalDatum>('series-a', [
            ordinalDatumOf(0, 'series-a', 1),
            ordinalDatumOf(100, 'series-a', 2),
            ordinalDatumOf(200, 'series-a', 3),
        ])
        const seriesMap = new Map<string, BaseSeries<OrdinalDatum>>([['series-a', seeded]])
        const {source} = subscribeWithSource(seriesMap, {dropDataAfter: 250})

        const newDatum = ordinalDatumOf(400, 'series-a', 4)
        source.next(ordinalChartDataFor(new Map([['series-a', [newDatum]]]), newDatum))
        jest.advanceTimersByTime(100)

        const series = seriesMap.get('series-a')!
        const remaining = Array.from({length: series.data.length}, (_, i) => series.data[i])
        expect(remaining.map(d => d.time)).toEqual([200, 400])
    })
})
