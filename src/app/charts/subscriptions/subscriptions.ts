import {bufferCount, bufferTime, map, mergeAll, mergeWith} from "rxjs/operators";
import {
    continuousAxisRanges,
    type ContinuousNumericAxis,
    ordinalAxisRanges,
    type OrdinalStringAxis
} from "../axes/axes";
import type {Datum, TimeSeries} from "../series/timeSeries";
import {interval, Observable, Subscription} from "rxjs";
import type {TimeSeriesChartData} from "../series/timeSeriesChartData";
import type {AxesAssignment} from "../plots/plot";
import {AxesState} from "../axes/AxesState";
import {type BaseSeries, emptySeries} from "../series/baseSeries";
import type {IterateChartData} from "../observables/iterates";
import type {IterateDatum, IterateSeries} from "../series/iterateSeries";
import {
    copyOrdinalDatumExtremum,
    copyOrdinalValueStats,
    copyValueStatsForSeries,
    defaultOrdinalValueStats,
    initialMaxValueDatum,
    initialMinValueDatum,
    type OrdinalChartData,
    type OrdinalStats,
    type OrdinalValueStats
} from "../observables/ordinals";
import type {ChartData} from "../observables/ChartData";
import type {OrdinalDatum} from "../series/ordinalSeries";
import type {RefObject} from "react";
import {AxisInterval} from "../axes/AxisInterval";
import {Optional} from "result-fn";
import {OrdinalAxisRange} from "../axes/OrdinalAxisRange";
import {ContinuousAxisRange} from "../axes/ContinuousAxisRange";
import type {OutlierChartData} from "../observables/outliers";
import type {OutlierDatum, OutlierSeries} from "../series/outlierSeries";

/**
 * The behavior of the time window when data is added to the chart
 * Note: replaces enums to support `erasableSyntaxOnly`
 *  TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
 */
export const TimeWindowBehavior = {
    SCROLL: "SCROLL",
    SQUEEZE: "SQUEEZE"
} as const

export type TimeWindowBehavior = (typeof TimeWindowBehavior)[keyof typeof TimeWindowBehavior];

/**
 * Advances the visible window for the specified axis (in place, within `timesWindows`) so its
 * right edge sits at `targetTime`, preserving the window's current width -- but only once
 * `targetTime` actually exceeds the window's current right edge. This gate is what lets a user
 * pan/zoom the window ahead of the current time and watch the data catch up to it before
 * scrolling resumes; comparing only against the window's width (rather than its actual current
 * position) would ignore wherever the window was panned/zoomed to and jump straight to "now" the
 * moment enough time had elapsed, which is the wrong behavior.
 * @param timesWindows A `map(axis_id -> range)` updated in place
 * @param axisId The axis to advance
 * @param targetTime The time the axis's right edge should advance to (a no-op if it's already there)
 */
function advanceAxisRangeInMapTo(timesWindows: Map<string, ContinuousAxisRange>, axisId: string, targetTime: number): void {
    const range = timesWindows.get(axisId)
    if (range === undefined) return
    const [startTime, endTime] = range.current.asTuple()
    if (endTime < targetTime) {
        const timeWindow = endTime - startTime
        const newStart = Math.max(0, targetTime - timeWindow)
        const newEnd = Math.max(targetTime, timeWindow)
        // preserve the axis' current zoom level (the current-width vs. original-width ratio,
        // i.e. `scaleFactor`) across the advance, by shifting `.original` forward by the same
        // amount as `.current` -- rather than resetting `.original` to match `.current` (which
        // snaps scaleFactor back to 1). Zoom math (`ContinuousAxisRange.scaledRange`) divides by
        // `scaleFactor` fresh on every "zoom" event, and d3-zoom's `transform.k` is *cumulative*
        // from the start of the gesture -- if an interleaved data/cadence tick reset scaleFactor
        // to 1 mid-gesture (as the old code did), the next zoom event reapplied the full
        // cumulative k against an already-scaled width instead of just the incremental change,
        // compounding into runaway growth every tick: the axis would "expand by a huge amount"
        // while zooming during streaming, sometimes growing so large the data disappears.
        const shift = newEnd - endTime
        const [origStart, origEnd] = range.original.asTuple()
        timesWindows.set(
            axisId,
            ContinuousAxisRange.from(newStart, newEnd, origStart + shift, origEnd + shift)
        )
    }
}

/**
 * Same idea as {@link advanceAxisRangeInMapTo} (preserve `scaleFactor` across the advance by
 * shifting `.original` forward in step with `.current`, rather than collapsing `.original` to
 * `.current`), but for the SCROLL/SQUEEZE inline advance logic duplicated in
 * {@link subscriptionTimeSeriesFor} and {@link subscriptionOutlierFor}: those advance a range to
 * a target time only once new data actually arrives (rather than on every cadence tick), and
 * SQUEEZE mode pins the window's start to `initialStart` instead of letting it slide forward.
 * @param range The range to advance
 * @param targetTime The time the range's right edge should advance to
 * @param timeWindowBehavior Whether to scroll (both edges advance, width preserved) or squeeze
 * (start pinned at `initialStart`, so the window widens instead of sliding)
 * @param initialStart The pinned start time for SQUEEZE mode (ignored for SCROLL)
 * @return The advanced range, with `.original` shifted by the same amount as `.current.end`
 */
function scrollOrSqueezeRangeTo(
    range: ContinuousAxisRange,
    targetTime: number,
    timeWindowBehavior: TimeWindowBehavior,
    initialStart?: number,
): ContinuousAxisRange {
    const [startTime, endTime] = range.current.asTuple()
    const timeWindow = endTime - startTime
    const newStart = timeWindowBehavior === TimeWindowBehavior.SQUEEZE && initialStart !== undefined ?
        initialStart :
        Math.max(0, targetTime - timeWindow)
    const newEnd = Math.max(targetTime, timeWindow)
    const shift = newEnd - endTime
    const [origStart, origEnd] = range.original.asTuple()
    return ContinuousAxisRange.from(newStart, newEnd, origStart + shift, origEnd + shift)
}

/**
 * Creates a subscription to the series observable with the data stream. This is common code
 * shared by the plots.
 * @param seriesObservable The series observable holding the stream of chart data
 * @param onSubscribe Callback for when the observable is subscribed to
 * @param windowingTime Basically the update time when data is collected and then rendered
 * @param axisAssignments The assignment of the series to their x- and y-axes
 * @param xAxesState The current state of the x-axis
 * @param onUpdateData Callback for when data is updated
 * @param dropDataAfter Limits the amount of data stored. Any data older than this value (ms) will
 * be dropped on the next update
 * @param updateTimingAndPlot The callback function to update the plot and timing
 * @param seriesMap The series-name and the associated series
 * @param setCurrentTime Callback to update the current time based on the streamed data
 * @param timeWindowBehavior Whether to scroll the time axis or squeeze it
 * @param initialTimes The initial times for each axis, a map(axis_id -> initial_time)
 * @param dataUpdatePeriod The period (ms) at which `seriesObservable` itself emits new data. When
 * provided (and positive), buffering switches from wall-clock-based (`bufferTime`) to a fixed tick
 * count (`bufferCount`) derived from `windowingTime / dataUpdatePeriod`. `bufferTime` and the
 * source's own emission timer are two independent, unsynchronized clocks -- ordinary timer jitter
 * of just a few ms is enough to shift a tick across a buffer boundary, so the number of ticks
 * landing in any given flush can vary (e.g. between 1 and 2 when windowingTime is only 2x
 * dataUpdatePeriod), producing an uneven, jittery scroll once the axis starts auto-scrolling --
 * visible as time appearing to move forward and backward slightly, even though the underlying
 * values never actually decrease. `bufferCount` counts emissions directly, so it's immune to that
 * jitter. When omitted, falls back to the original `bufferTime` behavior.
 * @return A subscription to the observable (for cancelling and the likes)
 */
export function subscriptionTimeSeriesFor(
    seriesObservable: Observable<TimeSeriesChartData>,
    onSubscribe: (subscription: Subscription) => void,
    windowingTime: number,
    axisAssignments: Map<string, AxesAssignment>,
    xAxesState: AxesState<ContinuousNumericAxis>,
    onUpdateData: ((seriesName: string, data: Array<Datum>) => void) | undefined,
    dropDataAfter: number,
    updateTimingAndPlot: (ranges: Map<string, ContinuousAxisRange>) => void,
    seriesMap: Map<string, TimeSeries>,
    setCurrentTime: (axisId: string, end: number) => void,
    timeWindowBehavior: TimeWindowBehavior = TimeWindowBehavior.SCROLL,
    initialTimes: Map<string, number> = new Map<string, number>(),
    dataUpdatePeriod?: number,
): Subscription {
    const buffered = dataUpdatePeriod !== undefined && dataUpdatePeriod > 0 ?
        bufferCount<TimeSeriesChartData>(Math.max(1, Math.round(windowingTime / dataUpdatePeriod))) :
        bufferTime<TimeSeriesChartData>(windowingTime)

    // grab the time-windows for the x-axes ONCE, at subscribe time, and mutate/advance this same
    // map instance across every subsequent tick (rather than rebuilding it fresh from
    // `axis.scale.domain()` on every emission). `continuousAxisRanges` has no way to recover a
    // zoom's `.original` reference from the scale alone (the scale only stores the current
    // domain), so rebuilding fresh every tick silently collapsed `.original` back to `.current`
    // -- resetting `scaleFactor` to 1 -- possibly in the middle of an active zoom gesture. Since
    // d3-zoom's `transform.k` is *cumulative* from the start of the gesture, an interleaved data
    // tick resetting scaleFactor to 1 mid-gesture caused the next zoom event to reapply the full
    // cumulative k against an already-scaled width, compounding into runaway growth. Building this
    // map once and mutating it in place also means it becomes (and stays) the exact same object as
    // the plot's persisted ranges ref once handed back via `updateTimingAndPlot`, so zoom/pan
    // handlers mutating that ref are mutating this map too, instead of having their changes
    // silently discarded by the next rebuild.
    const timesWindows = continuousAxisRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>);

    const subscription = seriesObservable
        .pipe(buffered)
        .subscribe(dataList => {
            dataList.forEach(data => {
                //
                // calculate the max times for each x-axis, which is the max time over all the
                // series assigned to an x-axis

                // get the series associated with each axis (Map<axis_id, [series_names]>)
                const axesSeries = associatedSeriesForXAxes(data, axisAssignments, xAxesState)

                // add each new point to it's corresponding series, the new points
                // is a map(series_name -> new_point[])
                data.newPoints.forEach((newData, name) => {
                    // grab the current series associated with the new data
                    const series = seriesMap.get(name) || emptySeries(name)

                    // update the handler with the new data point
                    if (onUpdateData) onUpdateData(name, newData)

                    // add the new data to the series
                    series.data.push(...newData)

                    // calculate the current time for the series' assigned x-axis (which may end up
                    // just being the default) based on the max time for the series, and the overall
                    // max time
                    const axisId = axisAssignments.get(name)?.xAxis || xAxesState.axisDefaultId().getOrElse("");
                    const currentAxisTime = axesSeries.get(axisId)
                        ?.reduce(
                            (tMax, seriesName) => Math.max(data.maxTimes.get(seriesName) || data.maxTime, tMax),
                            -Infinity
                        ) || data.maxTime

                    if (currentAxisTime !== undefined) {
                        // drop data that is older than the max time-window
                        while (currentAxisTime - series.data[0].x > dropDataAfter) {
                            series.data.shift()
                        }

                        // update the time range for the x-axis, and if the time range
                        // needs to be updated, then recalculate the time range for the
                        // axis, update the time windows, and call the setCurrentTime
                        // callback to update the current time for the caller
                        const range = timesWindows.get(axisId)
                        const [, endTime] = Optional.ofNullable(range?.current)
                            .map(interval => interval.asTuple())
                            .getOrElse([0, 0])
                        if (range !== undefined && endTime < currentAxisTime) {
                            timesWindows.set(
                                axisId,
                                scrollOrSqueezeRangeTo(range, currentAxisTime, timeWindowBehavior, initialTimes.get(axisId))
                            )
                            setCurrentTime(axisId, endTime) // callback
                        }
                    }
                })

                // update the data
                updateTimingAndPlot(timesWindows)  // callback
            })
        })

    // provide the subscription to the caller
    onSubscribe(subscription)   // callback

    return subscription
}

/**
 * **Function has side effects on the Series (for performance).**
 *
 * Creates a subscription to the series observable with the data stream. The common code is
 * shared by the plots.
 * @param seriesObservable The series observable holding the stream of chart data
 * @param onSubscribe Callback for when the observable is subscribed to
 * @param windowingTime Basically the update time when data is collected and then rendered
 * @param axisAssignments The assignment of the series to their x- and y-axes
 * @param xAxesState The current state of the x-axis
 * @param onUpdateData Callback for when data is updated
 * @param dropDataAfter Limits the amount of data stored. Any data older than this value (ms) will
 * be dropped on the next update
 * @param updateTimingAndPlot The callback function to update the plot and timing
 * @param seriesMap The series-name and the associated series
 * @param setCurrentTime Callback to update the current time based on the streamed data
 * @param cadencePeriod The number of milliseconds between time updates. Cadence ticks -- not data
 * ticks -- drive the axis scroll in this mode (see the `data.currentTime !== undefined` branch
 * below), and are deliberately left unbuffered: `windowingTime` still batches the *data* stream
 * (a lever for reducing per-point overhead), but each cadence tick flows straight through to the
 * subscriber the moment it fires, so the axis scrolls smoothly at `cadencePeriod`'s own rate
 * regardless of how large `windowingTime` is.
 * @return A subscription to the observable (for cancelling and the likes)
 */
export function subscriptionTimeSeriesWithCadenceFor(
    seriesObservable: Observable<TimeSeriesChartData>,
    onSubscribe: (subscription: Subscription) => void,
    windowingTime: number,
    axisAssignments: Map<string, AxesAssignment>,
    xAxesState: AxesState<ContinuousNumericAxis>,
    onUpdateData: ((seriesName: string, data: Array<Datum>) => void) | undefined,
    dropDataAfter: number,
    updateTimingAndPlot: (ranges: Map<string, ContinuousAxisRange>) => void,
    seriesMap: Map<string, TimeSeries>,
    setCurrentTime: (axisId: string, end: number) => void,
    cadencePeriod: number
): Subscription {
    // The best-known "real" stream time, and the `performance.now()` moment it was measured --
    // together they let a cadence tick convert its own elapsed-since-subscribe into an absolute
    // stream time (`knownTime + (performance.now() - knownTimeMeasuredAt)`). Seeded here from
    // `seriesMap`'s latest datum, same as the original one-shot `maxTime` this replaces, but now
    // *corrected* by every real data tick below rather than staying fixed for the subscription's
    // whole life. That correction matters because `seriesMap` only reflects real stream progress
    // on a subscribe that's actually tracking the data from the start -- on a subscribe that
    // inherits a remounted plot (see `ScatterPlot`'s inherited-subscription teardown), `seriesMap`
    // has just been reseeded back to the chart's tiny seed data by `resetPlotForInitialData`,
    // while the real stream (and the axis window restored from the store) is far ahead. Without
    // the correction, every cadence tick computes a stream time permanently behind the axis's
    // already-advanced window, so `advanceAxisWindowTo`'s "don't move backward" gate silently
    // no-ops it forever -- only the buffered real-data ticks (every `windowingTime`) end up moving
    // the axis, which looks exactly like cadence "was dropped" after navigating away and back.
    let knownTime = Array.from(seriesMap.entries())
        .reduce(
            (tMax, [, series]) => Math.max(tMax, series.last().map(datum => datum.x).getOrElse(tMax)),
            -Infinity
        )
    let knownTimeMeasuredAt = performance.now()
    // the absolute stream time `knownTime`/`knownTimeMeasuredAt` currently project, i.e. what the
    // very next cadence tick would compute -- used both to produce a cadence tick's own
    // `cadenceTime` and (see the real-data branch below) to decide whether a real data tick's
    // `currentAxisTime` is worth correcting the anchor to.
    const cadenceTimeNow = (): number => knownTime + (performance.now() - knownTimeMeasuredAt)

    // wall-clock elapsed time since subscribing, rather than `value * cadencePeriod` (i.e.
    // counting ticks). The two are equivalent under normal conditions, but diverge whenever a
    // cadence tick is delivered late -- most notably because the tab/window was hidden (see the
    // `visibilitychange` handling below): the browser throttles `setInterval`/`setTimeout`
    // (what `interval()` is built on) for hidden pages, so ticks that *do* fire while hidden
    // still land at their "natural" 1-per-`cadencePeriod` count, undercounting how much real time
    // actually passed. Reporting elapsed wall-clock time instead means the very first tick after
    // becoming visible again immediately reports the true current time, rather than a stale value
    // that would otherwise take many additional ticks to "count up" to reality.
    const cadenceStartTime = performance.now()
    const cadence = interval(cadencePeriod)
        .pipe(
            map(() => {
                const elapsed = performance.now() - cadenceStartTime
                return {
                    currentTime: elapsed,
                    maxTime: elapsed,
                    maxTimes: new Map(),
                    newPoints: new Map()
                } as TimeSeriesChartData
            })
        )

    // cadence ticks (not data ticks -- see the `data.currentTime !== undefined` branch below) are
    // what advance the axis window in this mode, and cadence's whole purpose is to make that
    // advance smooth by ticking at its own fine-grained period, independent of how fast (or
    // slowly/irregularly) real data arrives. Buffering the data stream is still worthwhile -- it's
    // a lever for reducing per-point overhead when a lot of data arrives -- but cadence ticks must
    // NOT be routed through that same buffer: buffering delays delivery until a group of items is
    // ready, then delivers the whole group at once, so every cadence tick in that group ends up
    // redrawn in a single burst rather than at its own natural pace. That collapses cadence's
    // per-tick smoothness down to the buffer's flush rate -- the axis would only visibly scroll
    // once every `windowingTime` ms (in one bigger jump) instead of once every `cadencePeriod` ms.
    // Leaving `cadence` unbuffered here means each tick flows straight through to the subscriber
    // (and triggers its own `updateTimingAndPlot`/redraw) the moment it fires.
    const bufferedData = seriesObservable.pipe(bufferTime<TimeSeriesChartData>(windowingTime), mergeAll())

    // grab the time-windows for the x-axes ONCE, at subscribe time, and mutate/advance this same
    // map instance on every subsequent tick (cadence fires every `cadencePeriod`, far more often
    // than data itself) -- see subscriptionTimeSeriesFor's identical `timesWindows` for the full
    // explanation: rebuilding fresh from `axis.scale.domain()` on every tick collapses `.original`
    // back to `.current`, which -- interleaved with an active zoom gesture, whose `transform.k` is
    // cumulative from the gesture's start -- compounds into runaway axis growth on every tick.
    const timesWindows = continuousAxisRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)

    // Catch the axis up to the best-known current time (`knownTime`) *synchronously, right here*
    // -- rather than leaving it exactly where it was restored to and passively waiting for the
    // first RxJS tick (`cadence` or a `bufferedData` flush) to arrive and perform this same
    // catch-up. On a remount (see `ScatterPlot`'s inherited-subscription teardown) the axis
    // window is restored from the store to wherever it was when the user navigated away, but
    // real time has kept moving in the background (the shared observable never stopped -- see
    // `randomWeightDataObservable`'s `shareReplay`). Until some tick arrives, the axis sits
    // completely frozen at that stale position; how long that takes is bounded by
    // `windowingTime`/`cadencePeriod` in the best case, but ordinary browser timer scheduling
    // (especially right after a route change, while React is still committing the new tree) can
    // push it well past that -- and because `advanceAxisRangeInMapTo` sets the window straight to
    // its target rather than easing in, whatever delay there is shows up as "the plot pauses,
    // then suddenly jumps forward" rather than a smooth resumption. Performing the catch-up here
    // needs no new "current time" source: `knownTime` already *is* the best-known current time (it's
    // exactly what the first cadence tick would compute anyway), just available one RxJS round-trip
    // earlier. Harmless when there's nothing to catch up to (a fresh, non-remounted subscribe):
    // `knownTime` then matches the axis's own fresh domain, so this is a no-op.
    if (isFinite(knownTime)) {
        xAxesState.axisIds().forEach(axisId => advanceAxisRangeInMapTo(timesWindows, axisId, knownTime))
        updateTimingAndPlot(timesWindows)
    }

    const subscription = bufferedData
        .pipe(mergeWith(cadence))
        .subscribe(data => {
            // advances the visible window for the specified axis so its right edge sits at
            // `targetTime`, preserving the window's current width -- but only once `targetTime`
            // actually exceeds the window's current right edge, exactly like the non-cadence
            // path's `endTime < currentAxisTime` gate. That gate is what lets a user pan/zoom the
            // window ahead of the current time and watch the data catch up to it before scrolling
            // resumes; comparing only against the window's width (rather than its actual current
            // position) would ignore wherever the window was panned/zoomed to and jump straight to
            // "now" the moment enough time had elapsed, which is the wrong behavior.
            //
            // Shared by both cadence ticks and real data ticks: cadence ticks provide smooth,
            // frequent advances between data arrivals, but cadence (`interval(cadencePeriod)`) and
            // the data source (`interval(updatePeriod)`) are two independent timers with no
            // relationship to each other, and can drift apart over a long-running stream even when
            // each individually tracks wall-clock time reasonably well. Calling this from the
            // data-tick branch too means real data is always treated as ground truth: if a data
            // point's own timestamp is ever ahead of what cadence has computed, the window still
            // advances to it, so cadence drifting behind the data can't leave the axis permanently
            // behind.
            const advanceAxisWindowTo = (axisId: string, targetTime: number): void =>
                advanceAxisRangeInMapTo(timesWindows, axisId, targetTime)

            if (data.currentTime !== undefined) {
                const cadenceTime = cadenceTimeNow()
                xAxesState.axisIds().forEach(axisId => {
                    advanceAxisWindowTo(axisId, cadenceTime)
                    setCurrentTime(axisId, cadenceTime)
                })
            }

            if (data.newPoints.size === 0) {
                updateTimingAndPlot(timesWindows)
                return
            }

            // determine which series belong to each x-axis
            const axesSeries = associatedSeriesForXAxes(data, axisAssignments, xAxesState)

            // add each new point to it's corresponding series, the new points
            // is a map(series_name -> new_point[])
            data.newPoints.forEach((newData, name) => {
                // grab the current series associated with the new data
                const series = seriesMap.get(name) || emptySeries(name);

                // update the handler with the new data point
                if (onUpdateData) onUpdateData(name, newData);

                // add the new data to the series
                series.data.push(...newData);

                // drop data when specified
                const axisId = axisAssignments.get(name)?.xAxis || xAxesState.axisDefaultId().getOrElse("")
                const currentAxisTime = axesSeries.get(axisId)
                    ?.reduce(
                        (tMax, seriesName) => Math.max(data.maxTimes.get(seriesName) || data.maxTime, tMax),
                        -Infinity
                    ) || data.maxTime
                if (currentAxisTime !== undefined) {
                    // drop data that is older than the max time-window
                    while (currentAxisTime - series.data[0].x > dropDataAfter) {
                        series.data.shift()
                    }
                    // re-sync the axis to the data's own ground-truth time -- see
                    // `advanceAxisWindowTo` above for why this matters even though cadence ticks
                    // already advance the window
                    advanceAxisWindowTo(axisId, currentAxisTime)
                    // Correct cadence's anchor -- but only when real data has actually overtaken
                    // it (`cadenceTimeNow()`, what cadence itself projects *right now*), not
                    // merely whenever `currentAxisTime` exceeds the anchor's last-set value. Every
                    // real data tick arrives with some processing latency behind wall-clock (it's
                    // waited out a `bufferTime(windowingTime)` buffer, run through `scan`, etc.),
                    // so `currentAxisTime` is normally a little *behind* where cadence's own
                    // continuous tracking already is by the time this callback runs -- comparing
                    // against the stale, only-updated-at-the-last-correction `knownTime` instead
                    // of the live projection missed that, so this correction fired on essentially
                    // every real data tick and snapped the anchor backward by that same processing
                    // latency each time, producing a small but real backward jump in cadenceTime
                    // (visible as a brief stall/stutter) every `windowingTime`, even during
                    // ordinary steady-state streaming with no remount involved. Comparing against
                    // `cadenceTimeNow()` means this only corrects the anchor when cadence has
                    // genuinely fallen behind the data (e.g. right after a remount, or if cadence
                    // ticks were ever throttled/delayed) -- which is the only case this needs to
                    // handle at all -- and otherwise leaves cadence's smooth tracking undisturbed.
                    if (currentAxisTime > cadenceTimeNow()) {
                        knownTime = currentAxisTime
                        knownTimeMeasuredAt = performance.now()
                    }
                }
            })

            // update the data
            updateTimingAndPlot(timesWindows)
        })

    // Chrome fully pauses `requestAnimationFrame` while the tab/window is hidden -- including
    // when a macOS Spaces switch occludes the window, not just literal tab-switching -- and
    // throttles `setInterval`/`setTimeout` (what `cadence` and the underlying data source's own
    // timer both run on) down to as little as once per second. The two timers are independently
    // throttled, so they don't necessarily resume in lockstep: whichever one happens to have
    // ticked more while hidden ends up ahead, and `advanceAxisWindowTo`'s `endTime < targetTime`
    // gate then leaves the other one's calls as no-ops for that axis until it organically catches
    // up -- which, immediately after a long hidden stretch, can take a while, showing up as that
    // axis only advancing on whichever clock's ticks are still getting through (e.g. once every
    // `windowingTime` from the data side, since cadence is what usually provides the smooth,
    // frequent advances). Forcing every axis straight to the actual ground-truth time (the latest
    // real datum received so far) the moment the page becomes visible again closes that gap
    // immediately, rather than waiting on either clock's next tick.
    if (typeof document !== 'undefined') {
        const resyncAxesOnVisible = (): void => {
            if (document.visibilityState !== 'visible') return

            const groundTruthTime = Array.from(seriesMap.values())
                .reduce(
                    (tMax, series) => Math.max(tMax, series.last().map(datum => datum.x).getOrElse(tMax)),
                    -Infinity
                )
            if (!isFinite(groundTruthTime)) return

            // mutate the same shared `timesWindows` the main subscription reads/advances (see its
            // declaration above) rather than building a separate fresh map -- doing the latter
            // would leave the main subscription mutating a now-stale, orphaned map object while
            // `updateTimingAndPlot` (and the plot's persisted ranges ref) moved on to this new one.
            xAxesState.axisIds().forEach(axisId => {
                advanceAxisRangeInMapTo(timesWindows, axisId, groundTruthTime)
                setCurrentTime(axisId, groundTruthTime)
            })
            updateTimingAndPlot(timesWindows)
        }
        document.addEventListener('visibilitychange', resyncAxesOnVisible)
        subscription.add(() => document.removeEventListener('visibilitychange', resyncAxesOnVisible))
    }

    // One more catch-up, one animation frame later -- narrows the residual gap between the
    // synchronous catch-up above (accurate as of the moment this function was called) and
    // whenever the first real `cadence`/`bufferedData` tick actually arrives to confirm/advance
    // it further. `requestAnimationFrame` reliably fires on the very next paint (about 16 ms) for
    // a visible, foregrounded tab, regardless of how long `interval(cadencePeriod)` or
    // `bufferTime(windowingTime)` take to schedule their own first callback -- which, right after
    // a route change, while React is still committing/painting the whole new component tree, can
    // measurably lag behind a single frame (observed live: ~600 ms in one remount, vs. this
    // function's own synchronous catch-up landing within a few ms). This isn't a special case: it
    // computes exactly the same `cadenceTimeNow()` a real cadence tick would, just once, earlier;
    // if real data has already moved further by the time it runs, the usual gate
    // (`endTime < targetTime`) simply lets that larger value win, same as any other tick.
    const catchUpFrame = requestAnimationFrame(() => {
        const cadenceTime = cadenceTimeNow()
        xAxesState.axisIds().forEach(axisId => advanceAxisRangeInMapTo(timesWindows, axisId, cadenceTime))
        updateTimingAndPlot(timesWindows)
    })
    subscription.add(() => cancelAnimationFrame(catchUpFrame))

    // provide the subscription to the caller
    onSubscribe(subscription)

    return subscription
}

/**
 * Creates a subscription to the series observable with the data stream. The common code is
 * shared by the plots.
 * @param seriesObservable The series observable holding the stream of chart data
 * @param onSubscribe Callback for when the observable is subscribed to
 * @param windowingTime Basically the update time when data is collected and then rendered
 * @param xAxesState The current state of the x-axis
 * @param yAxesState The current state of the y-axis
 * @param onUpdateData Callback for when data is updated
 * @param dropDataAfter Limits the amount of data stored. Any data older than this value (ms) will
 * be dropped on the next update
 * @param updateRangesAndPlot The callback function to update the plot
 * @param seriesMap The series-name and the associated series
 * @param updateCurrentTime Callback to update the current time based on the streamed data
 * @return A subscription to the observable (for cancelling and the likes)
 */
export function subscriptionIteratesFor(
    seriesObservable: Observable<IterateChartData>,
    onSubscribe: (subscription: Subscription) => void,
    windowingTime: number,
    xAxesState: AxesState<ContinuousNumericAxis>,
    yAxesState: AxesState<ContinuousNumericAxis>,
    onUpdateData: ((seriesName: string, data: Array<IterateDatum>) => void) | undefined,
    dropDataAfter: number,
    updateRangesAndPlot: () => void,
    seriesMap: Map<string, IterateSeries>,
    updateCurrentTime: (time: number) => void
): Subscription {
    // maintains the x and y-axis ranges based on the original domain of the axes
    const xAxesRanges = new Map<string, ContinuousAxisRange>(Array.from(xAxesState.axes.entries())
        .map(([id, axis]) => {
            const [start, end] = (axis as ContinuousNumericAxis).scale.domain()
            return [id, ContinuousAxisRange.from(start, end)]
        }))
    const yAxesRanges = new Map<string, ContinuousAxisRange>(Array.from(yAxesState.axes.entries())
        .map(([id, axis]) => {
            const [start, end] = (axis as ContinuousNumericAxis).scale.domain()
            return [id, ContinuousAxisRange.from(start, end)]
        }))

    /**
     * Updates the original axis range with new domain values, while maintaining the original
     * domain values.
     * @param originals The original axis ranges
     * @param axes The current axes
     */
    function updateRange(originals: Map<string, ContinuousAxisRange>, axes: Map<string, ContinuousNumericAxis>): void {
        axes.forEach((axis, id) => {
            const [start, end] = axis.scale.domain()
            const original: ContinuousAxisRange = originals.get(id) || ContinuousAxisRange.from(start, end)
            originals.set(id, original.update(start, end))
        })
    }

    const subscription = seriesObservable
        .pipe(bufferTime(windowingTime))
        .subscribe(dataList => {
            dataList.forEach(data => {
                // calculate the bounds for each of the x- and y-axes
                updateRange(xAxesRanges, xAxesState.axes  as Map<string, ContinuousNumericAxis>)
                updateRange(yAxesRanges, yAxesState.axes  as Map<string, ContinuousNumericAxis>)

                // add each new point to its corresponding series, the newPoints object
                // is a map(series_name -> new_point[])
                data.newPoints.forEach((newData, seriesName) => {
                    // grab the current series associated with the new data
                    const series = seriesMap.get(seriesName) || emptySeries(seriesName)

                    // update the handler with the new data points
                    if (onUpdateData) onUpdateData(seriesName, newData)

                    // add the new data to the series
                    series.data.push(...newData)

                    // calculate and update the current time, which will be that max time of the
                    // f[n+1](x) values (y-axis)
                    const currentTime = Array.from(data.newPoints.values())
                        .reduce((maxTime, currentSeries) => {
                            const seriesMaxTime = currentSeries.length > 0 ? currentSeries[currentSeries.length-1].time : 0
                            if (seriesMaxTime > maxTime) {
                                return seriesMaxTime
                            }
                            return maxTime
                        }, 0)

                    updateCurrentTime(currentTime)

                    // drop data that is older than the max time-window
                    while (currentTime - series.data[0].time > dropDataAfter) {
                        series.data.shift()
                    }

                })

                // update the data
                const xRange = xAxesRanges.get(xAxesState.axisDefaultId().getOrElse(""))
                const yRange = yAxesRanges.get(yAxesState.axisDefaultId().getOrElse(""))
                if (xRange !== undefined && yRange !== undefined) {
                    updateRangesAndPlot()
                }
            })
        })

    // provide the subscription to the caller
    onSubscribe(subscription)

    return subscription
}

/**
 * Creates a subscription to the outlier-chart-data observable. Mirrors {@link subscriptionTimeSeriesFor}
 * but works with {@link OutlierDatum} where the (x, y) value is nested under `datum`. The visible
 * time-window scrolls (or squeezes) as the latest datum's time advances past the current end of
 * the x-axis range.
 * @param seriesObservable The observable streaming outlier-chart-data
 * @param onSubscribe Callback for when the observable is subscribed to
 * @param windowingTime Buffer interval (ms) before flushing batched data to the chart
 * @param axisAssignments Map associating each series to its x- and y-axes
 * @param xAxesState The current state of the x-axis
 * @param onUpdateData Optional callback fired when new data arrives for a series
 * @param dropDataAfter Drops series data points older than this many milliseconds
 * @param updateTimingAndPlot Callback that updates the plot and timing after the time-window changes
 * @param seriesMap A `map(series_name -> series)` updated in place as new data arrives
 * @param setCurrentTime Callback that records the current time for an axis
 * @param timeWindowBehavior Whether the time-axis scrolls or squeezes when data passes the end
 * @param initialTimes Initial start-times for each axis (used by the squeeze behavior)
 * @return The RxJS subscription
 */
export function subscriptionOutlierFor<M extends readonly number[]>(
    seriesObservable: Observable<OutlierChartData<M>>,
    onSubscribe: (subscription: Subscription) => void,
    windowingTime: number,
    axisAssignments: Map<string, AxesAssignment>,
    xAxesState: AxesState<ContinuousNumericAxis>,
    onUpdateData: ((seriesName: string, data: Array<OutlierDatum<M>>) => void) | undefined,
    dropDataAfter: number,
    updateTimingAndPlot: (ranges: Map<string, ContinuousAxisRange>) => void,
    seriesMap: Map<string, OutlierSeries<M>>,
    setCurrentTime: (axisId: string, end: number) => void,
    timeWindowBehavior: TimeWindowBehavior = TimeWindowBehavior.SCROLL,
    initialTimes: Map<string, number> = new Map<string, number>(),
    dataUpdatePeriod?: number,
): Subscription {
    // see subscriptionTimeSeriesFor's identical parameter for the full explanation: switches from
    // wall-clock `bufferTime` to a fixed tick-count `bufferCount` when the source's own emission
    // period is known, avoiding an uneven, jittery scroll once the axis auto-scrolls.
    const buffered = dataUpdatePeriod !== undefined && dataUpdatePeriod > 0 ?
        bufferCount<OutlierChartData<M>>(Math.max(1, Math.round(windowingTime / dataUpdatePeriod))) :
        bufferTime<OutlierChartData<M>>(windowingTime)

    // see subscriptionTimeSeriesFor's identical `timesWindows` for the full explanation: built
    // once, here, and mutated/advanced in place across every subsequent tick, rather than rebuilt
    // fresh from `axis.scale.domain()` each time (which cannot recover a zoom's `.original`
    // reference and so silently reset `scaleFactor` to 1, corrupting an in-progress zoom gesture).
    const timesWindows = continuousAxisRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)

    const subscription = seriesObservable
        .pipe(buffered)
        .subscribe(dataList => {
            dataList.forEach(data => {
                data.newPoints.forEach((newData, name) => {
                    const series = seriesMap.get(name) || emptySeries<OutlierDatum<M>>(name) as OutlierSeries<M>
                    if (!seriesMap.has(name)) seriesMap.set(name, series)

                    if (onUpdateData) onUpdateData(name, newData)

                    series.data.push(...newData)

                    const axisId = axisAssignments.get(name)?.xAxis || xAxesState.axisDefaultId().getOrElse("")
                    const currentAxisTime = Math.max(...newData.map(datum => datum.datum.x), -Infinity)

                    if (Number.isFinite(currentAxisTime)) {
                        while (series.data.length > 0 && currentAxisTime - series.data[0].datum.x > dropDataAfter) {
                            series.data.shift()
                        }

                        const range = timesWindows.get(axisId)
                        const [, endTime] = range?.current?.asTuple() ?? [0, 0]
                        if (range !== undefined && endTime < currentAxisTime) {
                            timesWindows.set(
                                axisId,
                                scrollOrSqueezeRangeTo(range, currentAxisTime, timeWindowBehavior, initialTimes.get(axisId))
                            )
                            setCurrentTime(axisId, endTime)
                        }
                    }
                })

                updateTimingAndPlot(timesWindows)
            })
        })

    onSubscribe(subscription)
    return subscription
}

/**
 * **Function has side effects on the Series (for performance).**
 *
 * Creates a subscription to the outlier-chart-data observable, merged with a periodic "cadence"
 * tick, so the visible time-window keeps scrolling (or squeezing) at a fixed interval even when
 * data arrives slower than that cadence -- mirrors {@link subscriptionTimeSeriesWithCadenceFor},
 * adapted for {@link OutlierDatum}, where the (x, y) value is nested under `datum`.
 * @param seriesObservable The observable streaming outlier-chart-data
 * @param onSubscribe Callback for when the observable is subscribed to
 * @param windowingTime Buffer interval (ms) before flushing batched data to the chart
 * @param xAxesState The current state of the x-axis
 * @param onUpdateData Optional callback fired when new data arrives for a series
 * @param dropDataAfter Drops series data points older than this many milliseconds
 * @param updateTimingAndPlot Callback that updates the plot and timing after the time-window changes
 * @param seriesMap A `map(series_name -> series)` updated in place as new data arrives
 * @param setCurrentTime Callback that records the current time for an axis
 * @param cadencePeriod The number of milliseconds between time updates
 * @return The RxJS subscription
 */
export function subscriptionOutlierWithCadenceFor<M extends readonly number[]>(
    seriesObservable: Observable<OutlierChartData<M>>,
    onSubscribe: (subscription: Subscription) => void,
    windowingTime: number,
    xAxesState: AxesState<ContinuousNumericAxis>,
    onUpdateData: ((seriesName: string, data: Array<OutlierDatum<M>>) => void) | undefined,
    dropDataAfter: number,
    updateTimingAndPlot: (ranges: Map<string, ContinuousAxisRange>) => void,
    seriesMap: Map<string, OutlierSeries<M>>,
    setCurrentTime: (axisId: string, end: number) => void,
    cadencePeriod: number,
): Subscription {
    // see subscriptionTimeSeriesWithCadenceFor's identical `knownTime`/`knownTimeMeasuredAt` for
    // the full explanation: seeded from `seriesMap` here, then corrected by every real data tick
    // below, so a cadence tick's absolute time doesn't stay pinned to a stale/small seed value
    // (e.g. after `seriesMap` gets reseeded by a remount) while the axis window it's compared
    // against has already been restored much further ahead.
    let knownTime = Array.from(seriesMap.entries())
        .reduce(
            (tMax, [, series]) => Math.max(tMax, series.last().map(datum => datum.datum.x).getOrElse(tMax)),
            -Infinity
        )
    let knownTimeMeasuredAt = performance.now()
    // see subscriptionTimeSeriesWithCadenceFor's identical `cadenceTimeNow` for the full
    // explanation: comparing a real data tick's time against this live projection (rather than
    // the stale, only-updated-at-the-last-correction `knownTime`) is what keeps the anchor
    // correction from firing -- and snapping cadence backward by its own processing latency --
    // on essentially every real data tick during ordinary steady-state streaming.
    const cadenceTimeNow = (): number => knownTime + (performance.now() - knownTimeMeasuredAt)

    // wall-clock elapsed time since subscribing, rather than `value * cadencePeriod` (i.e.
    // counting ticks) -- see subscriptionTimeSeriesWithCadenceFor's cadence for the full
    // explanation: a tick-counted cadence permanently undercounts real elapsed time once the
    // tab/window is throttled while hidden (e.g. a macOS Spaces switch), since the browser
    // clamps `setInterval` for hidden pages without "catching up" the ticks it skipped.
    const cadenceStartTime = performance.now()
    const cadence = interval(cadencePeriod)
        .pipe(
            map(() => ({
                seriesNames: new Set<string>(),
                newPoints: new Map<string, Array<OutlierDatum<M>>>(),
                currentTime: performance.now() - cadenceStartTime,
            } as OutlierChartData<M>))
        )

    // cadence ticks (not data ticks) are what advance the axis window smoothly in this mode --
    // see subscriptionTimeSeriesWithCadenceFor's identical `bufferedData` for the full
    // explanation. Routing `cadence` through the same `bufferTime(windowingTime)` as the data
    // (as this used to do) delays every cadence tick until the next buffer flush and delivers a
    // whole group of them at once, collapsing cadence's per-tick smoothness down to the buffer's
    // flush rate -- the axis would only visibly scroll once every `windowingTime` ms (in one
    // bigger jump) instead of once every `cadencePeriod` ms. Buffering only the real data stream,
    // and merging the unbuffered `cadence` in afterward, means each cadence tick flows straight
    // through to the subscriber the moment it fires, regardless of how large `windowingTime` is.
    const bufferedData = seriesObservable.pipe(bufferTime<OutlierChartData<M>>(windowingTime), mergeAll())

    // see subscriptionTimeSeriesWithCadenceFor's identical `timesWindows` for the full
    // explanation: built once, here, and mutated/advanced in place on every subsequent cadence
    // tick (every `cadencePeriod`), rather than rebuilt fresh from `axis.scale.domain()` each
    // time -- which cannot recover a zoom's `.original` reference and so silently reset
    // `scaleFactor` to 1 on every tick, corrupting any zoom gesture in progress.
    const timesWindows = continuousAxisRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)

    // see subscriptionTimeSeriesWithCadenceFor's identical synchronous catch-up for the full
    // explanation: performs the first tick's catch-up immediately, rather than leaving the axis
    // frozen at its remount-restored position until whatever RxJS timer fires first actually
    // does it -- which is what turns any scheduling delay right after a route change into a
    // visible "pause, then sudden jump".
    if (isFinite(knownTime)) {
        xAxesState.axisIds().forEach(axisId => advanceAxisRangeInMapTo(timesWindows, axisId, knownTime))
        updateTimingAndPlot(timesWindows)
    }

    const subscription = bufferedData
        .pipe(mergeWith(cadence))
        .subscribe(data => {
            // advance every x-axis's window on each cadence tick, regardless of whether new data
            // arrived -- this is what keeps the axes scrolling once the data has reached the
            // right-hand edge, rather than stalling until the next real datum shows up
            if (data.currentTime !== undefined) {
                const cadenceTime = cadenceTimeNow()
                xAxesState.axisIds().forEach(axisId => {
                    advanceAxisRangeInMapTo(timesWindows, axisId, cadenceTime)
                    setCurrentTime(axisId, cadenceTime)
                })
            }

            if (data.newPoints.size === 0) {
                updateTimingAndPlot(timesWindows)
                return
            }

            // add each new point to its corresponding series, the new points
            // is a map(series_name -> new_point[])
            //
            // also track the max real-data time seen in this emission, so that -- once every
            // series has been updated -- every x-axis can be re-synced to it (see the comment
            // below for why this matters even though cadence ticks already advance the window).
            // this function doesn't support per-series axis assignments (unlike
            // subscriptionTimeSeriesWithCadenceFor), so all axes advance to the same time here,
            // matching the cadence branch above.
            let maxRealTime = -Infinity
            data.newPoints.forEach((newData, name) => {
                // grab the current series associated with the new data, registering it the first
                // time a series shows up (seriesRef starts from just the initial data and grows as
                // the subscription emits new series)
                const series = seriesMap.get(name) || emptySeries<OutlierDatum<M>>(name) as OutlierSeries<M>
                if (!seriesMap.has(name)) seriesMap.set(name, series)

                // update the handler with the new data point
                if (onUpdateData) onUpdateData(name, newData)

                // add the new data to the series
                series.data.push(...newData)

                const currentAxisTime = Math.max(...newData.map(datum => datum.datum.x), -Infinity)

                if (Number.isFinite(currentAxisTime)) {
                    // drop data that is older than the max time-window
                    while (series.data.length > 0 && currentAxisTime - series.data[0].datum.x > dropDataAfter) {
                        series.data.shift()
                    }
                    maxRealTime = Math.max(maxRealTime, currentAxisTime)
                }
            })

            // re-sync the axes to the data's own ground-truth time -- cadence
            // (`interval(cadencePeriod)`) and the data source's own timer are two independent
            // timers that can drift apart over a long-running stream even when each individually
            // tracks wall-clock time reasonably well; treating real data as ground truth here
            // means cadence drifting behind the data can't leave the axes permanently behind.
            if (isFinite(maxRealTime)) {
                xAxesState.axisIds().forEach(axisId => advanceAxisRangeInMapTo(timesWindows, axisId, maxRealTime))
                // correct cadence's anchor only if real data has overtaken cadence's own live
                // projection -- see subscriptionTimeSeriesWithCadenceFor's identical correction
                // for why comparing against `cadenceTimeNow()` (not the stale `knownTime`) matters
                if (maxRealTime > cadenceTimeNow()) {
                    knownTime = maxRealTime
                    knownTimeMeasuredAt = performance.now()
                }
            }

            // update the data
            updateTimingAndPlot(timesWindows)
        })

    // see subscriptionTimeSeriesWithCadenceFor's identical block for the full explanation: forces
    // every x-axis straight to the actual ground-truth time (the latest real datum received so
    // far) the moment the page becomes visible again, rather than waiting on either the cadence
    // or data timer's next tick to organically catch up after being throttled while hidden.
    if (typeof document !== 'undefined') {
        const resyncAxesOnVisible = (): void => {
            if (document.visibilityState !== 'visible') return

            const groundTruthTime = Array.from(seriesMap.values())
                .reduce(
                    (tMax, series) => Math.max(tMax, series.last().map(datum => datum.datum.x).getOrElse(tMax)),
                    -Infinity
                )
            if (!isFinite(groundTruthTime)) return

            // mutate the same shared `timesWindows` the main subscription reads/advances (see its
            // declaration above) rather than building a separate fresh map -- doing the latter
            // would leave the main subscription mutating a now-stale, orphaned map object while
            // `updateTimingAndPlot` (and the plot's persisted ranges ref) moved on to this new one.
            xAxesState.axisIds().forEach(axisId => {
                advanceAxisRangeInMapTo(timesWindows, axisId, groundTruthTime)
                setCurrentTime(axisId, groundTruthTime)
            })
            updateTimingAndPlot(timesWindows)
        }
        document.addEventListener('visibilitychange', resyncAxesOnVisible)
        subscription.add(() => document.removeEventListener('visibilitychange', resyncAxesOnVisible))
    }

    // see subscriptionTimeSeriesWithCadenceFor's identical `catchUpFrame` for the full
    // explanation: narrows the residual gap between the synchronous catch-up above and whenever
    // the first real tick arrives, by re-confirming on the very next paint frame instead of
    // waiting on `interval`/`bufferTime`'s own scheduling.
    const catchUpFrame = requestAnimationFrame(() => {
        const cadenceTime = cadenceTimeNow()
        xAxesState.axisIds().forEach(axisId => advanceAxisRangeInMapTo(timesWindows, axisId, cadenceTime))
        updateTimingAndPlot(timesWindows)
    })
    subscription.add(() => cancelAnimationFrame(catchUpFrame))

    // provide the subscription to the caller
    onSubscribe(subscription)

    return subscription
}

export interface WindowedOrdinalStats extends OrdinalStats {
    /**
     * A map associating each series to stats about that series (e.g. map(series_name -> stats))
     */
    windowedValueStatsForSeries: Map<string, OrdinalValueStats>
}

/**
 * Creates a subscription to the series observable with the data stream. The common code is
 * shared by the plots.
 * @param seriesObservable The series observable holding the stream of chart data
 * @param onSubscribe Callback for when the observable is subscribed to
 * @param windowingTime Basically the update time when data is collected and then rendered
 * @param axisAssignments The assignment of the series to their x- and y-axes
 * @param yAxesState The current state of the x-axis
 * @param onUpdateData Callback for when data is updated
 * @param dropDataAfter Limits the amount of data stored. Any data older than this value (ms) will
 * be dropped on the next update
 * @param updateTimingAndPlot The callback function to update the plot and timing
 * @param seriesMap The series-name and the associated series
 * @param ordinalStatsRef The statistics about the data in the chart and about each series
 * @param setCurrentTime Callback to update the current time based on the streamed data
 * @param originalRange The original range of the axes
 * @return A subscription to the observable (for cancelling and the likes)
 */
export function subscriptionOrdinalXFor(
    seriesObservable: Observable<OrdinalChartData>,
    onSubscribe: (subscription: Subscription) => void,
    windowingTime: number,
    axisAssignments: Map<string, AxesAssignment>,
    yAxesState: AxesState<OrdinalStringAxis>,
    onUpdateData: ((seriesName: string, data: Array<OrdinalDatum>) => void) | undefined,
    dropDataAfter: number,
    updateTimingAndPlot: (ranges: Map<string, OrdinalAxisRange>) => void,
    seriesMap: Map<string, BaseSeries<OrdinalDatum>>,
    ordinalStatsRef: RefObject<WindowedOrdinalStats>,
    setCurrentTime: (currentTime: number) => void,
    originalRange: AxisInterval,
    dataUpdatePeriod?: number,
): Subscription {

    /**
     * First of two functions to calculate the current ordinal stats for the current time window. This
     * function updates the windowed stats for the new data.
     * @param newData The new data for that series
     * @param windowedStats The current windowed ordinal value status
     * @return The windowed ordinal value stats updated for the new data
     */
    function updatedWindowedValueStatsForNewData(newData: Array<OrdinalDatum>, windowedStats: OrdinalValueStats): OrdinalValueStats {
        const updatedStats = copyOrdinalValueStats(windowedStats)
        updatedStats.count += newData.length
        const newSum = newData.reduce((total, datum) => total + datum.value, 0)
        updatedStats.sum += newSum
        updatedStats.sumSquared += newSum * newSum
        updatedStats.mean = (updatedStats.count > 0) ? updatedStats.sum / updatedStats.count : NaN
        updatedStats.min = newData.reduce((min, datum) => datum.value < min.value ? datum : min, updatedStats.min)
        updatedStats.max = newData.reduce((max, datum) => datum.value > max.value ? datum : max, updatedStats.max)
        return updatedStats
    }

    /**
     * Second of two functions to calculate the current ordinal stats for the current time window. This
     * function updates the windowed stats by for the dropped data
     * @param droppedData An array of datum that was dropped from the time window
     * @param windowedStats The current windowed ordinal value stats
     * @param series An array of series holding all the current data in the time-window
     * @return The windowed ordinal value stats updated for the dropped data
     */
    function updateWindowedValueStatsForDroppedData(
        droppedData: Array<OrdinalDatum>,
        windowedStats: OrdinalValueStats,
        series: BaseSeries<OrdinalDatum>
    ): OrdinalValueStats {
        const updatedStats = copyOrdinalValueStats(windowedStats)
        // calculate the windowed stats based on the dropped data
        updatedStats.count -= droppedData.length
        const droppedSum = droppedData.reduce((total, datum) => total + datum.value, 0)
        updatedStats.sum -= droppedSum
        updatedStats.sumSquared -= droppedSum * droppedSum
        updatedStats.mean = (updatedStats.count > 0) ? updatedStats.sum / updatedStats.count : NaN
        updatedStats.min = series.data.reduce((min, datum) => datum.value < min.value ? datum : min, initialMinValueDatum())
        updatedStats.max = series.data.reduce((max, datum) => datum.value > max.value ? datum : max, initialMaxValueDatum())
        return updatedStats
    }

    //
    // beginning of the subscription function
    //
    // see subscriptionTimeSeriesFor's identical parameter for the full explanation: switches from
    // wall-clock `bufferTime` to a fixed tick-count `bufferCount` when the source's own emission
    // period is known, avoiding an uneven, jittery scroll once the axis auto-scrolls.
    const buffered = dataUpdatePeriod !== undefined && dataUpdatePeriod > 0 ?
        bufferCount<OrdinalChartData>(Math.max(1, Math.round(windowingTime / dataUpdatePeriod))) :
        bufferTime<OrdinalChartData>(windowingTime)

    const subscription = seriesObservable
        .pipe(buffered)
        .subscribe(dataList => {
            dataList.forEach((data: OrdinalChartData) => {
                // grab the axis ranges for the y-axes
                const yAxisRanges = ordinalAxisRanges(
                    yAxesState.axes as Map<string, OrdinalStringAxis>,
                    originalRange
                );

                //
                // calculate the max times for each x-axis, which is the max time over all the
                // series assigned to an x-axis

                // get the series associated with each y-axis (Map<axis_id, [series_names]>)
                const axesSeries = associatedSeriesForYAxes(data, axisAssignments, yAxesState)

                // add each new point to it's corresponding series, the new points
                // is a map(series_name -> new_point[])
                data.newPoints.forEach((newData, name) => {
                    // grab the current series associated with the new data
                    const series = seriesMap.get(name) || emptySeries(name)

                    // update the handler with the new data point
                    if (onUpdateData) onUpdateData(name, newData)

                    // add the new data to the series
                    series.data.push(...newData)

                    // grab the stats
                    ordinalStatsRef.current.minDatum = copyOrdinalDatumExtremum(data.stats.minDatum)
                    ordinalStatsRef.current.maxDatum = copyOrdinalDatumExtremum(data.stats.maxDatum)
                    ordinalStatsRef.current.valueStatsForSeries = copyValueStatsForSeries(data.stats.valueStatsForSeries)

                    // set up for the windowed-stats
                    const lifetimeValueStats = data.stats.valueStatsForSeries.get(name) || defaultOrdinalValueStats()
                    if (!ordinalStatsRef.current.windowedValueStatsForSeries.has(name)) {
                        ordinalStatsRef.current.windowedValueStatsForSeries.set(name, copyOrdinalValueStats(lifetimeValueStats))
                        // ordinalStatsRef.current.windowedValueStatsForSeries.set(name, defaultOrdinalValueStats())
                    }

                    // update the windowed-stats for the new points (later will deal with datum
                    // that were dropped)
                    const updatedStats = ordinalStatsRef.current.windowedValueStatsForSeries.get(name)!
                    const windowedValueStats = updatedWindowedValueStatsForNewData(newData, updatedStats)
                    ordinalStatsRef.current.windowedValueStatsForSeries.set(name, windowedValueStats)

                    // calculate the current value for the series' assigned y-axis (which may end up
                    // just being the default) based on the max time for the series, and the overall
                    // max time
                    const axisId = axisAssignments.get(name)?.yAxis || yAxesState.axisDefaultId().getOrElse("");
                    const currentTime = axesSeries.get(axisId)
                        ?.reduce(
                            (tMax, ) => Math.max(data.stats.maxDatum.time.time, tMax),
                            -Infinity
                        ) || NaN
                    setCurrentTime(currentTime)

                    if (currentTime !== undefined) {
                        // drop data that is older than the max time-window, holding on to the dropped ones
                        const droppedData: Array<OrdinalDatum> = []
                        while (currentTime - series.data[0].time > dropDataAfter) {
                            const dropped = series.data.shift()
                            if (dropped !== undefined) {
                                droppedData.push(dropped)
                            }
                        }

                        // calculate the windowed stats based on the dropped data
                        if (droppedData.length > 0) {
                            ordinalStatsRef.current.windowedValueStatsForSeries.set(
                                name,
                                updateWindowedValueStatsForDroppedData(droppedData, windowedValueStats, series)
                            )
                        }

                        // // update the time range for the x-axis, and if the time range
                        // // needs to be updated, then recalculate the time range for the
                        // // axis, update the time windows, and call the setCurrentTime
                        // // callback to update the current time for the caller
                        // const range = yAxisRanges.get(axisId)
                        // if (range !== undefined && range.end < currentAxisTime) {
                        //     const timeWindow = range.end - range.start
                        //     const timeRange = continuousAxisRangeFor(
                        //         // 0,
                        //         timeWindowBehavior === TimeWindowBehavior.SQUEEZE && initialTimes.get(axisId) !== undefined ?
                        //             initialTimes.get(axisId)! :
                        //             Math.max(0, currentAxisTime - timeWindow),
                        //         Math.max(currentAxisTime, timeWindow)
                        //     )
                        //     yAxisRanges.set(axisId, timeRange)
                        //     setCurrentTime(axisId, timeRange.end) // callback
                        // }
                    }
                })

                // // grab the stats
                // ordinalStatsRef.current.minDatum = copyOrdinalDatumExtremum(data.stats.minDatum)
                // ordinalStatsRef.current.maxDatum = copyOrdinalDatumExtremum(data.stats.maxDatum)
                // ordinalStatsRef.current.valueStatsForSeries = copyValueStatsForSeries(data.stats.valueStatsForSeries)

                // update the data
                updateTimingAndPlot(yAxisRanges)  // callback
            })
        })

    // provide the subscription to the caller
    onSubscribe(subscription)   // callback

    return subscription
}

/**
 * Determines which series are assigned to which x-axes, and returns a map holding the
 * x-axis names and their associated list of series
 * @param data The chart data
 * @param axisAssignments A map holding the  series names and its associated x-axis and y-axis names
 * @param xAxesState Holds information about the axis and how it is displayed
 * @return A map holding the x-axis names the names of the series associated with the axis.
 */
function associatedSeriesForXAxes(
    data: TimeSeriesChartData,
    axisAssignments: Map<string, AxesAssignment>,
    xAxesState: AxesState<ContinuousNumericAxis>
): Map<string, Array<string>> {
    return associatedSeriesFor(
        assignment => assignment?.xAxis || xAxesState.axisDefaultId().getOrElse(""),
        data,
        axisAssignments
    )
}

/**
 * Determines which series are assigned to which y-axes, and returns a map holding the
 * x-axis names and their associated list of series
 * @param data The chart data
 * @param axisAssignments A map holding the  series names and its associated x-axis and y-axis names
 * @param yAxesState Holds information about the axis and how it is displayed
 * @return A map holding the y-axis names the names of the series associated with the axis.
 */
function associatedSeriesForYAxes(
    data: ChartData,
    axisAssignments: Map<string, AxesAssignment>,
    yAxesState: AxesState<OrdinalStringAxis>
): Map<string, Array<string>> {
    return associatedSeriesFor(
        assignment => assignment?.yAxis || yAxesState.axisDefaultId().getOrElse(""),
        data,
        axisAssignments
    )
}

/**
 * Determines which series are assigned to which axes, and returns a map holding the
 * axis names and their associated list of series. The extractor function returns the axis ID
 * for the series and is responsible for return the x-axis ID or the y-axis ID depending
 * on the context of the call.
 * @param axisIdExtractor A function that accepts the {@link AxesAssignment} and returns the axis ID
 * @param data The chart data
 * @param axisAssignments A map holding the  series names and its associated x-axis and y-axis names
 * @return A map holding the axis names the names of the series associated with the axis.
 */
function associatedSeriesFor(
    axisIdExtractor: (assignment?: AxesAssignment) => string,
    data: ChartData,
    axisAssignments: Map<string, AxesAssignment>
): Map<string, Array<string>> {
    return Array
        .from(data.seriesNames)
        .reduce(
            (assignedSeries, seriesName) => {
                const id = axisIdExtractor(axisAssignments.get(seriesName))
                const series = assignedSeries.get(id) || []
                series.push(seriesName)
                assignedSeries.set(id, series)
                return assignedSeries
            },
            new Map<string, Array<string>>()
        )
}
