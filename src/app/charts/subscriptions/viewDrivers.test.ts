import {scaleLinear} from "d3";
import {Subject} from "rxjs";
import {
    iteratesViewDriverFor,
    ordinalViewDriverFor,
    outlierViewDriverFor,
    timeSeriesViewDriverFor,
    timeSeriesWithCadenceViewDriverFor,
} from "./viewDrivers";
import {TimeWindowBehavior} from "./subscriptions";
import {AxesState} from "../axes/AxesState";
import {AxisLocation, AxisType, type ContinuousNumericAxis, type OrdinalStringAxis} from "../axes/axes";
import {ContinuousAxisRange} from "../axes/ContinuousAxisRange";
import {assignAxes} from "../plots/plot";
import {datumOf, type Datum, type TimeSeries} from "../series/timeSeries";
import {seriesFrom} from "../series/baseSeries";
import type {TimeSeriesChartData} from "../series/timeSeriesChartData";
import type {OutlierChartData} from "../observables/outliers";
import type {OutlierDatum} from "../series/outlierSeries";
import {defaultOrdinalStats, type OrdinalChartData} from "../observables/ordinals";
import {ordinalDatumOf} from "../series/ordinalSeries";
import type {IterateChartData} from "../observables/iterates";
import {TimeSeriesDataSource} from "../datasources/timeSeriesDataSource";

/**
 * The view drivers only advance the view and ask the plot to redraw -- ingestion is covered by the
 * data-source tests. These mirror the view-behavior tests of the original `subscription*For`
 * functions (SCROLL/SQUEEZE, axis routing, cadence anchoring, catch-up, visibility resync).
 */

function fakeContinuousAxis(domain: [number, number] = [0, 1000]): ContinuousNumericAxis {
    return {
        axisId: 'x-axis-1',
        location: AxisLocation.Bottom,
        axisType: AxisType.ContinuousNumeric,
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

function chartDataFor(newPoints: Map<string, Array<Datum>>, maxTime: number): TimeSeriesChartData {
    return {
        seriesNames: new Set(newPoints.keys()),
        maxTime,
        maxTimes: new Map(Array.from(newPoints.entries()).map(([name, points]) => [name, points[points.length - 1].x])),
        newPoints,
    }
}

/**
 * A stand-in for a data source: the test pushes updates and sets the latest (ground-truth) time
 */
function fakeSource<CD>(latestTime: number = -Infinity) {
    const updates$ = new Subject<CD>()
    let latest = latestTime
    return {
        updates$,
        latestTime: () => latest,
        setLatestTime: (time: number) => {
            latest = time
        },
    }
}

const lastRanges = (mockFn: jest.Mock): Map<string, ContinuousAxisRange> =>
    mockFn.mock.calls[mockFn.mock.calls.length - 1][0] as Map<string, ContinuousAxisRange>

function installRafPolyfill(): void {
    const g = globalThis as unknown as {
        requestAnimationFrame: (cb: (t: number) => void) => number
        cancelAnimationFrame: (id: number) => void
    }
    g.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0) as unknown as number
    g.cancelAnimationFrame = (id) => clearTimeout(id)
}

function installDocumentStub(): {getVisibilityChangeListener: () => (() => void) | undefined, setVisible: (visible: boolean) => void} {
    let listener: (() => void) | undefined
    let visible = true
    const g = globalThis as unknown as {document: unknown}
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
    const g = globalThis as unknown as {document?: unknown, requestAnimationFrame?: unknown, cancelAnimationFrame?: unknown}
    delete g.document
    delete g.requestAnimationFrame
    delete g.cancelAnimationFrame
}

let liveSubscriptions: Array<{unsubscribe: () => void}> = []
afterEach(() => {
    liveSubscriptions.forEach(subscription => subscription.unsubscribe())
    liveSubscriptions = []
    uninstallGlobalStubs()
    jest.useRealTimers()
})

const track = <T extends {unsubscribe: () => void}>(subscription: T): T => {
    liveSubscriptions.push(subscription)
    return subscription
}

describe('timeSeriesViewDriverFor', () => {
    beforeEach(() => jest.useFakeTimers())

    it('advances the (SCROLL) window to cover new data and reports the previous end time', () => {
        const source = fakeSource<TimeSeriesChartData>()
        const updateTimingAndPlot = jest.fn()
        const setCurrentTime = jest.fn()
        track(timeSeriesViewDriverFor(source, 100, new Map(), axesStateWith('x-axis-1'), updateTimingAndPlot, setCurrentTime))

        source.updates$.next(chartDataFor(new Map([['series-a', [datumOf(1500, 42)]]]), 1500))
        jest.advanceTimersByTime(100)

        expect(lastRanges(updateTimingAndPlot).get('x-axis-1')!.current.asTuple()).toEqual([500, 1500])
        expect(setCurrentTime).toHaveBeenCalledWith('x-axis-1', 1000)
    })

    it('SQUEEZE mode pins the window start at initialStart and widens instead of sliding', () => {
        const source = fakeSource<TimeSeriesChartData>()
        const updateTimingAndPlot = jest.fn()
        track(timeSeriesViewDriverFor(
            source, 100, new Map(), axesStateWith('x-axis-1'), updateTimingAndPlot, jest.fn(),
            TimeWindowBehavior.SQUEEZE, new Map([['x-axis-1', 0]]),
        ))

        source.updates$.next(chartDataFor(new Map([['series-a', [datumOf(1500, 42)]]]), 1500))
        jest.advanceTimersByTime(100)

        expect(lastRanges(updateTimingAndPlot).get('x-axis-1')!.current.asTuple()).toEqual([0, 1500])
    })

    it('routes a series to its explicitly-assigned axis rather than the default', () => {
        const source = fakeSource<TimeSeriesChartData>()
        const xAxesState = AxesState.from<ContinuousNumericAxis>(new Map([
            ['x-axis-1', fakeContinuousAxis([0, 1000])],
            ['x-axis-2', fakeContinuousAxis([0, 1000])],
        ]))
        const axisAssignments = new Map([['series-b', assignAxes('x-axis-2', 'y-axis-1')]])
        const updateTimingAndPlot = jest.fn()
        track(timeSeriesViewDriverFor(source, 100, axisAssignments, xAxesState, updateTimingAndPlot, jest.fn()))

        source.updates$.next(chartDataFor(new Map([['series-a', [datumOf(1500, 1)]], ['series-b', [datumOf(1800, 2)]]]), 1800))
        jest.advanceTimersByTime(100)

        expect(lastRanges(updateTimingAndPlot).get('x-axis-1')!.current.end).toBe(1500)
        expect(lastRanges(updateTimingAndPlot).get('x-axis-2')!.current.end).toBe(1800)
    })

    it('batches by count when the data update period is known', () => {
        const source = fakeSource<TimeSeriesChartData>()
        const updateTimingAndPlot = jest.fn()
        // windowingTime 100 / dataUpdatePeriod 50 => flush every 2 updates, regardless of time
        track(timeSeriesViewDriverFor(
            source, 100, new Map(), axesStateWith('x-axis-1'), updateTimingAndPlot, jest.fn(),
            TimeWindowBehavior.SCROLL, new Map(), 50,
        ))

        source.updates$.next(chartDataFor(new Map([['series-a', [datumOf(1100, 1)]]]), 1100))
        expect(updateTimingAndPlot).not.toHaveBeenCalled()
        source.updates$.next(chartDataFor(new Map([['series-a', [datumOf(1200, 1)]]]), 1200))
        expect(updateTimingAndPlot).toHaveBeenCalledTimes(2)
    })

    it('leaves the data source running and ingesting when the driver is unsubscribed (plot unmounted)', () => {
        const generator = new Subject<TimeSeriesChartData>()
        const dataSource = new TimeSeriesDataSource({
            initialData: [seriesFrom<Datum>('series-a', [])] as Array<TimeSeries>,
            generator: () => generator,
        })
        dataSource.start()
        const driver = timeSeriesViewDriverFor(dataSource, 100, new Map(), axesStateWith('x-axis-1'), jest.fn(), jest.fn())

        driver.unsubscribe()
        generator.next(chartDataFor(new Map([['series-a', [datumOf(10, 1)]]]), 10))

        expect(dataSource.running).toBe(true)
        expect(dataSource.series.get('series-a')!.data.length).toBe(1)
        dataSource.dispose()
    })
})

describe('timeSeriesWithCadenceViewDriverFor', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        installRafPolyfill()
    })

    function drive(source: ReturnType<typeof fakeSource<TimeSeriesChartData>>, options: {
        updateTimingAndPlot?: jest.Mock,
        setCurrentTime?: jest.Mock,
    } = {}) {
        return track(timeSeriesWithCadenceViewDriverFor(
            source, 100, new Map(), axesStateWith('x-axis-1'),
            options.updateTimingAndPlot ?? jest.fn(), options.setCurrentTime ?? jest.fn(), 50,
        ))
    }

    it('synchronously catches the axis up to the data source\'s latest time on creation (e.g. after a remount)', () => {
        const source = fakeSource<TimeSeriesChartData>(5000)
        const updateTimingAndPlot = jest.fn()
        drive(source, {updateTimingAndPlot})

        expect(updateTimingAndPlot).toHaveBeenCalled()
        expect((updateTimingAndPlot.mock.calls[0][0] as Map<string, ContinuousAxisRange>).get('x-axis-1')!.current.end).toBe(5000)
    })

    it('does no catch-up when the data source has no data yet', () => {
        const updateTimingAndPlot = jest.fn()
        drive(fakeSource<TimeSeriesChartData>(), {updateTimingAndPlot})
        expect(updateTimingAndPlot).not.toHaveBeenCalled()
    })

    it('never advances the axis on cadence alone when no data has ever been seen', () => {
        const updateTimingAndPlot = jest.fn()
        drive(fakeSource<TimeSeriesChartData>(), {updateTimingAndPlot})
        jest.advanceTimersByTime(200)
        expect(lastRanges(updateTimingAndPlot).get('x-axis-1')!.current.asTuple()).toEqual([0, 1000])
    })

    it('advances the axis window on cadence ticks alone once a real anchor exists', () => {
        const setCurrentTime = jest.fn()
        drive(fakeSource<TimeSeriesChartData>(1000), {setCurrentTime})
        setCurrentTime.mockClear()

        jest.advanceTimersByTime(200)

        const lastCall = setCurrentTime.mock.calls[setCurrentTime.mock.calls.length - 1]
        expect(lastCall[0]).toBe('x-axis-1')
        expect(lastCall[1]).toBeGreaterThanOrEqual(1150)
        expect(lastCall[1]).toBeLessThanOrEqual(1250)
    })

    it('corrects the cadence anchor forward when real data overtakes it, instead of drifting behind', () => {
        const source = fakeSource<TimeSeriesChartData>()
        const updateTimingAndPlot = jest.fn()
        drive(source, {updateTimingAndPlot})

        jest.advanceTimersByTime(20)
        source.updates$.next(chartDataFor(new Map([['series-a', [datumOf(50_000, 1)]]]), 50_000))
        jest.advanceTimersByTime(100)
        expect(lastRanges(updateTimingAndPlot).get('x-axis-1')!.current.end).toBe(50_000)

        jest.advanceTimersByTime(50)
        expect(lastRanges(updateTimingAndPlot).get('x-axis-1')!.current.end).toBeGreaterThan(50_000)
    })

    it('resyncs the axis to the data source\'s latest time when the page becomes visible again', () => {
        const {getVisibilityChangeListener, setVisible} = installDocumentStub()
        const source = fakeSource<TimeSeriesChartData>()
        const updateTimingAndPlot = jest.fn()
        const setCurrentTime = jest.fn()
        drive(source, {updateTimingAndPlot, setCurrentTime})

        // data kept arriving at the source while the page was hidden
        source.setLatestTime(9000)
        updateTimingAndPlot.mockClear()
        setVisible(true)
        getVisibilityChangeListener()!()

        expect((updateTimingAndPlot.mock.calls[0][0] as Map<string, ContinuousAxisRange>).get('x-axis-1')!.current.end).toBe(9000)
        expect(setCurrentTime).toHaveBeenCalledWith('x-axis-1', 9000)
    })

    it('does not resync when the visibilitychange listener fires while still hidden', () => {
        const {getVisibilityChangeListener, setVisible} = installDocumentStub()
        const source = fakeSource<TimeSeriesChartData>()
        const updateTimingAndPlot = jest.fn()
        drive(source, {updateTimingAndPlot})

        source.setLatestTime(9000)
        updateTimingAndPlot.mockClear()
        setVisible(false)
        getVisibilityChangeListener()!()

        expect(updateTimingAndPlot).not.toHaveBeenCalled()
    })

    it('removes the visibilitychange listener and stops cadence when unsubscribed', () => {
        const {getVisibilityChangeListener} = installDocumentStub()
        const updateTimingAndPlot = jest.fn()
        const subscription = drive(fakeSource<TimeSeriesChartData>(1000), {updateTimingAndPlot})

        expect(getVisibilityChangeListener()).toBeDefined()
        subscription.unsubscribe()
        expect(getVisibilityChangeListener()).toBeUndefined()

        updateTimingAndPlot.mockClear()
        jest.advanceTimersByTime(500)
        expect(updateTimingAndPlot).not.toHaveBeenCalled()
    })
})

describe('outlierViewDriverFor', () => {
    beforeEach(() => jest.useFakeTimers())

    it('advances the window to cover the newest datum in the chunk', () => {
        const source = fakeSource<OutlierChartData<readonly [number]>>()
        const updateTimingAndPlot = jest.fn()
        track(outlierViewDriverFor(source, 100, new Map(), axesStateWith('x-axis-1'), updateTimingAndPlot, jest.fn()))

        const datum = (x: number): OutlierDatum<readonly [number]> => ({datum: {x, y: 1}, bounds: [{lower: 0, upper: 1}]})
        source.updates$.next({seriesNames: new Set(['a']), newPoints: new Map([['a', [datum(1200), datum(1500)]]])})
        jest.advanceTimersByTime(100)

        expect(lastRanges(updateTimingAndPlot).get('x-axis-1')!.current.asTuple()).toEqual([500, 1500])
    })
})

describe('ordinalViewDriverFor', () => {
    beforeEach(() => jest.useFakeTimers())

    it('reports the chart-wide current time and redraws', () => {
        const source = fakeSource<OrdinalChartData>()
        const updateTimingAndPlot = jest.fn()
        const setCurrentTime = jest.fn()
        track(ordinalViewDriverFor(
            source, 100, AxesState.from<OrdinalStringAxis>(new Map()), updateTimingAndPlot, setCurrentTime,
        ))

        const stats = defaultOrdinalStats()
        stats.maxDatum.time = ordinalDatumOf(750, 'a', 1)
        source.updates$.next({
            seriesNames: new Set(['a']),
            stats,
            newPoints: new Map([['a', [ordinalDatumOf(750, 'a', 1)]]]),
        } as unknown as OrdinalChartData)
        jest.advanceTimersByTime(100)

        expect(setCurrentTime).toHaveBeenCalledWith(750)
        expect(updateTimingAndPlot).toHaveBeenCalled()
    })
})

describe('iteratesViewDriverFor', () => {
    beforeEach(() => jest.useFakeTimers())

    it('reports the current time and redraws once both axes exist', () => {
        const source = fakeSource<IterateChartData>()
        const updateRangesAndPlot = jest.fn()
        const updateCurrentTime = jest.fn()
        track(iteratesViewDriverFor(
            source, 100, axesStateWith('x-axis-1'), axesStateWith('y-axis-1'), updateRangesAndPlot, updateCurrentTime,
        ))

        source.updates$.next({
            seriesNames: new Set(['a']),
            newPoints: new Map([['a', [{time: 42, iterateN: 0, iterateN_1: 0}]]]),
        } as unknown as IterateChartData)
        jest.advanceTimersByTime(100)

        expect(updateCurrentTime).toHaveBeenCalledWith(42)
        expect(updateRangesAndPlot).toHaveBeenCalled()
    })
})
