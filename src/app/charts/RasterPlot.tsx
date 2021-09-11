import {AxesAssignment, setClipPath, TimeSeries} from "./plot";
import * as d3 from "d3";
import {noop} from "./utils";
import {useChart} from "./hooks/useChart";
import {useCallback, useEffect, useRef} from "react";
import {datumOf, Series, seriesFrom} from "./datumSeries";
import {ContinuousAxisRange, continuousAxisRangeFor} from "./continuousAxisRangeFor";
import {GSelection} from "./d3types";
import {BaseAxis, CategoryAxis, ContinuousNumericAxis, defaultLineStyle} from "./axes";
import {Subscription} from "rxjs";

interface Props {
    /**
     * Holds the mapping between a series and the axis it uses (is assigned). The
     * map's key holds the series name, and the value is an {@link AxesAssignment}
     * object holding the ID of the assigned x-axis and y-axis.
     */
    axisAssignments?: Map<string, AxesAssignment>
    /**
     * The number of milliseconds of data to hold in memory before dropping it. Defaults to
     * infinity (i.e. no data is dropped)
     */
    dropDataAfter?: number
}

export function RasterPlot(props: Props): null {
    const {
        chartId,
        container,
        mainG,
        xAxesState,
        yAxesState,
        setTimeRangeFor,
        plotDimensions,
        margin,
        color,
        seriesStyles,
        initialData,
        seriesFilter,

        seriesObservable,
        windowingTime = 100,
        shouldSubscribe,

        onSubscribe = noop,
        onUpdateData = noop,
        onUpdateTime = noop,

        mouseOverHandlerFor,
        mouseLeaveHandlerFor,
    } = useChart()

    const {
        axisAssignments = new Map<string, AxesAssignment>(),
        dropDataAfter = Infinity,
    } = props

    // const liveDataRef = useRef<Map<string, Series>>(new Map(initialData.map(series => [series.name, series])))
    const dataRef = useRef<Array<Series>>(initialData.slice())
    const seriesRef = useRef<Map<string, Series>>(new Map(initialData.map(series => [series.name, series])))
    // map(axis_id -> current_time) -- maps the axis ID to the current time for that axis
    const currentTimeRef = useRef<Map<string, number>>(new Map())

    useEffect(
        () => {
            currentTimeRef.current = new Map(Array.from(xAxesState.axes.keys()).map(id => [id, 0]))
        },
        [xAxesState]
    )

    const updatePlot = useCallback(
        (timeRanges: Map<string, ContinuousAxisRange>, mainGElem: GSelection) => {
            if (container) {
                // select the svg element bind the data to them
                const svg = d3.select<SVGSVGElement, any>(container)

                // create a map associating series-names to their time-series
                // const boundedSeries = new Map(initialData.map(series => [
                //     series.name,
                //     // selectInTimeRange(series, timeRangeFor(series.name, timeRanges, axisAssignments))
                //     series.data.map(datum => [datum.time, datum.value]) as TimeSeries
                // ]))
                const boundedSeries = dataRef.current.filter(series => series.name.match(seriesFilter))

                mainGElem
                    .selectAll<SVGGElement, Series>('g')
                    .data<Series>(boundedSeries)
                    .enter()
                    .append('g')
                    .attr('class', 'spikes-series')
                    .attr('id', series => `${series.name}-${chartId}`)
                    .attr('transform', `translate(${margin.left}, ${margin.top})`);

                // set up panning
                // todo set up panning

                // set up zoom
                // todo set up zoom

                // define the clip-path so that the series lines don't go beyond the plot area
                const clipPathId = setClipPath(chartId, svg, plotDimensions, margin)

                // liveDataRef.current.forEach((data, name) => {
                //     // grab the x and y axes assigned to the series, and if either of both axes
                //     // aren't found, then give up and return
                //     const [xAxisLinear, yAxisCategory] = axesFor(name, axisAssignments, xAxesState.axisFor, yAxesState.axisFor)
                //     if (xAxisLinear === undefined || yAxisCategory === undefined) return
                //
                //     // grab the style for the series
                //     const {color, lineWidth} = seriesStyles.get(name) || {
                //         ...defaultLineStyle,
                //         highlightColor: defaultLineStyle.color
                //     }
                //
                //
                //  })
            }
        },
        []
    )

    // need to keep the function references for use by the subscription, which forms a closure
    // on them. without the references, the closures become stale, and resizing during streaming
    // doesn't work properly
    const updatePlotRef = useRef(updatePlot)
    useEffect(
        () => {
            updatePlotRef.current = updatePlot
        },
        [updatePlot]
    )
    const onUpdateTimeRef = useRef(onUpdateTime)
    useEffect(
        () => {
            onUpdateTimeRef.current = onUpdateTime
        },
        [onUpdateTime]
    )

    // updates the timing using the onUpdateTime and updatePlot references. This and the references
    // defined above allow the axes' times to be update properly by avoid stale reference to these
    // functions.
    const updateTimingAndPlot = useCallback(
        /**
         * Updates the time and plot with the new time-ranges
         * @param ranges The new time-ranges
         */
        (ranges: Map<string, ContinuousAxisRange>): void => {
            if (mainG !== null) {
                onUpdateTimeRef.current(ranges)
                updatePlotRef.current(ranges, mainG)
            }
        },
        [mainG]
    )

    const subscribe = useCallback(
        () => {
            if (seriesObservable === undefined || mainG === null) return undefined
        },
        [mainG, seriesObservable]
    )

    const timeRangesRef = useRef<Map<string, ContinuousAxisRange>>(new Map())
    useEffect(
        () => {
            if (container && mainG) {
                // so this gets a bit complicated. the time-ranges need to be updated whenever the time-ranges
                // change. for example, as data is streamed in, the times change, and then we need to update the
                // time-range. however, we want to keep the time-ranges to reflect their original scale so that
                // we can zoom properly (so the updates can't fuck with the scale). At the same time, when the
                // interpolation changes, then the update plot changes, and the time-ranges must maintain their
                // original scale as well.
                // const ranges = timeRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)
                if (timeRangesRef.current.size === 0) {
                    // when no time-ranges have yet been created, then create them and hold on to a mutable
                    // reference to them
                    timeRangesRef.current = timeRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)
                } else {
                    // when the time-ranges already exist, then we want to update the time-ranges for each
                    // existing time-range in a way that maintains the original scale.
                    const intervals = timeIntervals(xAxesState.axes as Map<string, ContinuousNumericAxis>)
                    timeRangesRef.current
                        .forEach((range, id, rangesMap) => {
                            const [start, end] = intervals.get(id) || [NaN, NaN]
                            if (!isNaN(start) && !isNaN(end)) {
                                // update the reference map with the new (start, end) portion of the range,
                                // while keeping the original scale intact
                                rangesMap.set(id, range.update(start, end))
                            }
                        })
                }
                updatePlot(timeRangesRef.current, mainG)
            }
        },
        [chartId, color, container, mainG, plotDimensions, updatePlot, xAxesState]
    )

    // subscribe/unsubscribe to the observable chart data. when the `shouldSubscribe`
    // is changed to `true` and we haven't subscribed yet, then subscribe. when the
    // `shouldSubscribe` is `false` and we had subscribed, then unsubscribe. otherwise,
    // do nothing.
    const subscriptionRef = useRef<Subscription>()
    useEffect(
        () => {
            if (shouldSubscribe && subscriptionRef.current === undefined) {
                subscriptionRef.current = subscribe()
            } else if (!shouldSubscribe && subscriptionRef.current !== undefined) {
                subscriptionRef.current?.unsubscribe()
                subscriptionRef.current = undefined
            }
        },
        [shouldSubscribe, subscribe]
    )

    return null
}

/**
 * Calculates the time-ranges for each of the axes in the map
 * @param xAxes The map containing the axes and their associated IDs
 * @return a map associating the axis IDs to their time-range
 */
function timeRanges(xAxes: Map<string, ContinuousNumericAxis>): Map<string, ContinuousAxisRange> {
    return new Map(Array.from(xAxes.entries())
        .map(([id, axis]) => {
            const [start, end] = axis.scale.domain()
            return [id, continuousAxisRangeFor(start, end)]
        }))
}

/**
 * Calculates the time-intervals (start, end) for each of the x-axis
 * @param xAxes The x-axes representing the time
 * @return A map associating each x-axis with a (start, end) interval
 */
function timeIntervals(xAxes: Map<string, ContinuousNumericAxis>): Map<string, [start: number, end: number]> {
    return new Map(Array.from(xAxes.entries())
        .map(([id, axis]) => [id, axis.scale.domain()] as [string, [number, number]]))
}

/**
 * Attempts to locate the x- and y-axes for the specified series. If no axis is found for the
 * series name, then uses the default returned by the useChart() hook
 * @param seriesName Name of the series for which to retrieve the axis
 * @param axisAssignments A map holding the series name and the associated x- and y-axes assigned
 * to that series. Note that the series in the axis-assignment map is merely a subset of the set
 * of series names.
 * @param xAxisFor The function that accepts an axis ID and returns the corresponding x-axis
 * @param yAxisFor The function that accepts an axis ID and returns the corresponding y-axis
 */
function axesFor(
    seriesName: string,
    axisAssignments: Map<string, AxesAssignment>,
    xAxisFor: (id: string) => BaseAxis | undefined,
    yAxisFor: (id: string) => BaseAxis | undefined,
): [xAxis: ContinuousNumericAxis, yAxis: CategoryAxis] {
    const axes = axisAssignments.get(seriesName)
    const xAxis = xAxisFor(axes?.xAxis || "")
    const xAxisLinear = xAxis as ContinuousNumericAxis
    const yAxis = yAxisFor(axes?.yAxis || "")
    const yAxisCategory = yAxis as CategoryAxis
    if (xAxis && !xAxisLinear) {
        throw Error("Scatter plot requires that x-axis be of type LinearAxis")
    }
    if (yAxis && !yAxisCategory) {
        throw Error("Scatter plot requires that y-axis be of type LinearAxis")
    }
    return [xAxisLinear, yAxisCategory]
}
