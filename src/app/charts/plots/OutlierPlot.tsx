import {useCallback, useEffect, useMemo, useRef} from 'react'
import * as d3 from "d3"
import {type D3ZoomEvent, ZoomTransform} from "d3"
import {Observable, Subscription} from "rxjs"
import {Optional} from "result-fn"

import {useChart} from "../hooks/useChart"
import {useDataObservable} from "../hooks/useDataObservable"
import {useInitialData} from "../hooks/useInitialData"
import {usePlotDimensions} from "../hooks/usePlotDimensions"
import {type AxesAssignment, setClipPathG} from "./plot"
import type {GSelection} from "../d3types"
import {makeIdSafeForCss, noop} from "../utils"
import type {Dimensions} from "../styling/margins"
import {ContinuousAxisRange} from "../axes/ContinuousAxisRange"
import {AxisInterval} from "../axes/AxisInterval"
import {
    axesForSeriesGen,
    type BaseAxis,
    continuousAxisIntervals,
    continuousAxisRanges,
    continuousAxisZoomHandler,
    type ContinuousNumericAxis,
    defaultLineStyle,
    panHandler,
    type SeriesLineStyle
} from "../axes/axes"
import {subscriptionOutlierFor, TimeWindowBehavior} from "../subscriptions/subscriptions"
import type {OutlierChartData} from "../observables/outliers"
import type {OutlierDatum, OutlierSeries} from "../series/outlierSeries"
import {FastShiftArray} from "fast-shift-array";

type OutlierDatumColor<M extends readonly number[]> = { datum: OutlierDatum<M>, color: string }

export interface Props {
    /**
     * Holds the mapping between a series and the axis it uses (is assigned). The
     * map's key holds the series name, and the value is an {@link AxesAssignment}
     * object holding the ID of the assigned x-axis and y-axis.
     */
    axisAssignments?: Map<string, AxesAssignment>
    /**
     * The line interpolation curve factory. See the d3 documentation for curves at
     * {@link https://github.com/d3/d3-shape#curves} for information on available interpolations.
     */
    interpolation?: d3.CurveFactory
    /**
     * Number of milliseconds of data to hold in memory before dropping it. Defaults to infinity.
     */
    dropDataAfter?: number
    /**
     * Whether to enable panning and zooming. Defaults to false.
     */
    panEnabled?: boolean
    /**
     * Whether to enable zooming. Defaults to false.
     */
    zoomEnabled?: boolean
    /**
     * Whether to require the shift or ctrl key to be held down when zooming. Defaults to true.
     */
    zoomKeyModifiersRequired?: boolean
    /**
     * Behavior for time windowing. Defaults to TimeWindowBehavior.FIXED.
     */
    timeWindowBehavior?: TimeWindowBehavior
    /**
     * Base fill-opacity for the outermost (widest) outlier band. Inner (narrower / more
     * confident) bands are rendered with progressively higher opacity, capped at 1.
     */
    bandOpacity?: number
    /**
     * Optional per-band opacity step added for each more-confident (lower-index) band.
     */
    bandOpacityStep?: number
    /**
     * Radius (px) of the circle marker drawn at each datum on the central line. Defaults to 4.
     */
    markerRadius?: number
    /**
     * Colors for the outlier marker drawn on any point that falls outside one or more bounds.
     * The array is indexed by bound (i.e. by measure), so `outlierMarkerColors[i]` is used when
     * the point is outside `bounds[i]`. When a point is outside multiple bounds, the color
     * associated with the largest exceeded bound wins. When omitted, outlier markers fall back
     * to red.
     */
    outlierMarkerColors?: ReadonlyArray<string>
}

/**
 * Metadata carried through the tooltip system when the user hovers over an outlier band.
 */
export interface OutlierBandTooltipMetadata<M extends readonly number[] = readonly number[]> {
    /**
     * The outlier datum
     */
    datum?: OutlierDatum<M>
    /**
     * The measure (confidence level) associated with the hovered band.
     */
    upperMeasure?: number
    /**
     * The measure (confidence level) associated with the band below the hovered band.
     */
    lowerMeasure?: number
    /**
     * The index of the hovered band (0 = tightest / most confident).
     */
    bandIndex: number
    /**
     * Number of visible points whose y-value falls within the band bounds.
     */
    pointsInBand: number
}

/**
 * Renders a streaming outlier plot. Each series consists of {@link OutlierDatum} points, where every
 * datum carries an (x, y) value plus a set of (lower, upper) bounds — one per measure. The plot
 * draws the central y-line for the series and a translucent band per measure, filled between
 * the corresponding lower and upper bounds. The x-axis scrolls as new points arrive past the
 * end of the visible window, in the same fashion as {@link ScatterPlot}.
 */
export function OutlierPlot<M extends readonly number[] = readonly number[]>(props: Props): null {
    const {
        chartId,
        container,
        mainG,
        axes,
        seriesStyles,
        seriesFilter,
        hoveredSeriesName,
        mouse,
    } = useChart<OutlierDatum<M>, SeriesLineStyle, OutlierBandTooltipMetadata<M>, ContinuousAxisRange, ContinuousNumericAxis>()

    const {mouseOverHandlerFor, mouseLeaveHandlerFor} = mouse

    const {initialData} = useInitialData<OutlierChartData<M>, OutlierDatum<M>>()

    const {
        xAxesState,
        yAxesState,
        setAxisIntervalFor,
        updateAxisRanges = noop,
        onUpdateAxesInterval,
        axesRanges,
    } = axes

    const {plotDimensions, margin} = usePlotDimensions()

    const {
        seriesObservable,
        windowingTime = 100,
        shouldSubscribe,
        onSubscribe = noop,
        onUpdateData,
    } = useDataObservable<OutlierChartData<M>, OutlierDatum<M>>()

    const {
        axisAssignments = new Map<string, AxesAssignment>(),
        interpolation = d3.curveLinear,
        dropDataAfter = Infinity,
        panEnabled = false,
        zoomEnabled = false,
        zoomKeyModifiersRequired = true,
        timeWindowBehavior = TimeWindowBehavior.SCROLL,
        bandOpacity = 0.15,
        bandOpacityStep = 0.12,
        markerRadius,
        outlierMarkerColors,
    } = props

    const initialTimes = useMemo(
        () => new Map<string, number>(
            Array.from<[string, ContinuousAxisRange]>(axesRanges().entries())
                .map(([axisId, range]) => ([axisId, range.original.start]))
        ),
        [axesRanges]
    )

    // seriesRef is the single source of truth for what to render. It starts from the initial
    // data and grows as the subscription emits new series. updatePlot iterates this directly
    // (rather than a parallel dataRef array) so dynamically-arriving series get rendered.
    const seriesRef = useRef<Map<string, OutlierSeries<M>>>(
        new Map(initialData.map(series => [series.name, series as OutlierSeries<M>]))
    )
    const currentTimeRef = useRef<Map<string, number>>(new Map())

    const subscriptionRef = useRef<Subscription>(undefined)

    useEffect(
        () => {
            currentTimeRef.current = new Map(Array.from<string>(xAxesState.axes.keys()).map(id => [id, 0]))
        },
        [xAxesState]
    )

    const axesForSeries = useMemo(
        (): Array<string> => axesForSeriesGen<OutlierDatum<M>, ContinuousNumericAxis>(
            initialData, axisAssignments, xAxesState
        ),
        [initialData, axisAssignments, xAxesState]
    )

    const updateTimingAndPlot = useCallback((ranges: Map<string, ContinuousAxisRange>): void => {
        if (mainG !== null) {
            onUpdateTimeRef.current(ranges)
            updatePlotRef.current(ranges, mainG)
            if (onUpdateAxesInterval) {
                setTimeout(() => {
                    const times = new Map<string, AxisInterval>()
                    ranges.forEach((range, name) => times.set(name, range.current))
                    onUpdateAxesInterval(times)
                }, 0)
            }
        }
    }, [mainG, onUpdateAxesInterval])

    useEffect(
        () => {
            seriesRef.current = new Map(initialData.map(series => [series.name, series as OutlierSeries<M>]))
            currentTimeRef.current = new Map(Array.from<string>(xAxesState.axes.keys()).map(id => [id, 0]))
            updateTimingAndPlot(
                new Map(
                    Array.from(continuousAxisRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>).entries())
                        .map(([id, range]) => {
                            const [start, end] = range.original.asTuple()
                            const minTime = (initialData as Array<OutlierSeries<M>>)
                                .filter(srs => axisAssignments.get(srs.name)?.xAxis === id)
                                .reduce(
                                    (tMin, series) =>
                                        Math.min(tMin, !series.isEmpty() ? series.data[0].datum.x : tMin),
                                    Infinity
                                )
                            const startTime = minTime === Infinity ? 0 : minTime
                            return [id, ContinuousAxisRange.from(startTime, startTime + end - start)]
                        })
                )
            )
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [initialData]
    )

    const onPan = useCallback(
        (x: number, dim: Dimensions, ranges: Map<string, ContinuousAxisRange>) =>
            panHandler(axesForSeries, margin, setAxisIntervalFor, xAxesState)(x, dim, ranges),
        [axesForSeries, margin, setAxisIntervalFor, xAxesState]
    )

    const onZoom = useCallback(
        (transform: ZoomTransform, x: number, dim: Dimensions, ranges: Map<string, ContinuousAxisRange>) =>
            continuousAxisZoomHandler(axesForSeries, margin, setAxisIntervalFor, xAxesState)(transform, x, dim, ranges),
        [axesForSeries, margin, setAxisIntervalFor, xAxesState]
    )

    const updatePlot = useCallback(
        (timeRanges: Map<string, ContinuousAxisRange>, mainGElem: GSelection) => {
            if (!container) return

            const svg = d3.select<SVGSVGElement, OutlierDatum<M>>(container)

            if (panEnabled) {
                const drag = d3.drag<SVGSVGElement, OutlierDatum<M>>()
                    .on("start", () => d3.select(container).style("cursor", "move"))
                    .on("drag", event => {
                        onPan(event.dx, plotDimensions, timeRanges)
                        updatePlotRef.current(timeRanges, mainGElem)
                    })
                    .on("end", () => d3.select(container).style("cursor", "auto"))
                svg.call(drag)
            }

            if (zoomEnabled) {
                const zoom = d3.zoom<SVGSVGElement, OutlierDatum<M>>()
                    .filter(event => !zoomKeyModifiersRequired || event.shiftKey || event.ctrlKey)
                    .scaleExtent([0, 10])
                    .translateExtent([[margin.left, margin.top], [plotDimensions.width, plotDimensions.height]])
                    .on("zoom", (event: D3ZoomEvent<SVGSVGElement, OutlierDatum<M>>) => {
                        onZoom(
                            event.transform,
                            event.sourceEvent.offsetX - margin.left,
                            plotDimensions,
                            timeRanges,
                        )
                        updatePlotRef.current(timeRanges, mainGElem)
                    })
                svg.call(zoom)
            }

            const clipPathId = setClipPathG(chartId, mainGElem, plotDimensions)

            seriesRef.current.forEach(series => {
                const [xAxis, yAxis] = axesFor(
                    series.name,
                    axisAssignments,
                    id => xAxesState.axisFor(id).getOrUndefined(),
                    id => yAxesState.axisFor(id).getOrUndefined()
                )
                if (xAxis === undefined || yAxis === undefined) return

                const style = seriesStyles.get(series.name) ?? defaultLineStyle()
                const plotData = series.name.match(seriesFilter) ? series.data : FastShiftArray.empty<OutlierDatum<M>>()
                const numBands = plotData.length > 0 ? plotData[0].bounds.length : 0
                // Spaces are not valid in XML IDs, and break CSS `#id` selectors; replace them.
                const seriesId = makeIdSafeForCss(series.name)

                // render the widest (highest-index) band first so the narrower, more-confident
                // bands stack on top with darker opacity
                for (let bandIndex = numBands - 1; bandIndex >= 0; bandIndex--) {
                    const opacity = Math.min(1, bandOpacity + (numBands - 1 - bandIndex) * bandOpacityStep)
                    const areaId = `${seriesId}-${chartId}-outlier-band-${bandIndex}`
                    const areaGen = d3.area<OutlierDatum<M>>()
                        .x(d => xAxis.scale(d.datum.x) || 0)
                        .y0(d => yAxis.scale(d.bounds[bandIndex].lower) || 0)
                        .y1(d => yAxis.scale(d.bounds[bandIndex].upper) || 0)
                        .curve(interpolation)
                    const upperMeasure = series.measures[bandIndex]
                    const lowerMeasure = bandIndex > 0 ? series.measures[bandIndex - 1] : undefined
                    // const measureDescription = series.measureDescriptions?.[bandIndex]

                    mainGElem
                        .selectAll<SVGPathElement, Array<OutlierDatum<M>>>(`#${areaId}`)
                        .data([plotData], () => `${series.name}-${bandIndex}`)
                        .join(
                            enter => enter
                                .append("path")
                                .attr("class", "outlier-band")
                                .attr("id", areaId)
                                .attr("data-series-name", series.name)
                                .attr("fill", style.color)
                                .attr("fill-opacity", opacity)
                                .attr("stroke", "none")
                                .attr("transform", `translate(${margin.left}, ${margin.top})`)
                                .attr("clip-path", `url(#${clipPathId})`)
                                .attr("d", areaGen)
                                .on("mouseover", (event: MouseEvent) => {
                                    if (upperMeasure == null || !container) return
                                    const [x, y] = d3.pointer(event, container)
                                    const pointsInBand = calcPointsInBand(plotData, bandIndex)
                                    const handleMouseOver = mouseOverHandlerFor(`tooltip-${chartId}`)
                                    if (handleMouseOver) {
                                        handleMouseOver(
                                            series.name,
                                            bandIndex,
                                            {
                                                series: series.data,
                                                metadata: {
                                                    upperMeasure,
                                                    lowerMeasure,
                                                    bandIndex,
                                                    pointsInBand,
                                                }
                                            },
                                            [x, y]
                                        )
                                    }
                                })
                                .on("mouseleave", () => {
                                    const handleMouseLeave = mouseLeaveHandlerFor(`tooltip-${chartId}`)
                                    if (handleMouseLeave) {
                                        handleMouseLeave(series.name)
                                    }
                                }),
                            update => update
                                .attr("fill", style.color)
                                .attr("fill-opacity", opacity)
                                .attr("d", areaGen),
                            exit => exit.remove()
                        )
                }

                // central line for the series y-value
                const lineId = `${seriesId}-${chartId}-outlier-line`
                const isHovered = hoveredSeriesName === series.name
                const stroke = isHovered ? style.highlightColor : style.color
                const strokeWidth = isHovered ? style.highlightWidth : style.lineWidth
                const lineGen = d3.line<OutlierDatum<M>>()
                    .x(d => xAxis.scale(d.datum.x) || 0)
                    .y(d => yAxis.scale(d.datum.y) || 0)
                    .curve(interpolation)

                mainGElem
                    .selectAll<SVGPathElement, Array<OutlierDatum<M>>>(`#${lineId}`)
                    .data([plotData], () => series.name)
                    .join(
                        enter => enter
                            .append("path")
                            .attr("class", "outlier-line")
                            .attr("id", lineId)
                            .attr("data-series-name", series.name)
                            .attr("fill", "none")
                            .attr("stroke", stroke)
                            .attr("stroke-width", strokeWidth)
                            .attr("transform", `translate(${margin.left}, ${margin.top})`)
                            .attr("clip-path", `url(#${clipPathId})`)
                            .attr("d", lineGen),
                        update => update
                            .attr("stroke", stroke)
                            .attr("stroke-width", strokeWidth)
                            .attr("d", lineGen),
                        exit => exit.remove()
                    )

                // for the markers, we split the data into two categories: regular and outlier
                const {regular, outlier} = categorizePoints(plotData, outlierMarkerColors)

                // point markers (one circle per datum)
                if (markerRadius != null && markerRadius >= 0 && !shouldSubscribe) {
                    const radius = markerRadius
                    const markerGroupId = `${seriesId}-${chartId}-outlier-markers`
                    const markerGroup = mainGElem
                        .selectAll<SVGGElement, Array<OutlierDatum<M>>>(`#${markerGroupId}`)
                        .data([regular], () => `${series.name}-markers`)
                        .join(
                            enter => enter
                                .append("g")
                                .attr("id", markerGroupId)
                                .attr("class", "outlier-markers")
                                .attr("data-series-name", series.name)
                                .attr("transform", `translate(${margin.left}, ${margin.top})`)
                                .attr("clip-path", `url(#${clipPathId})`),
                            update => update,
                            exit => exit.remove()
                        )

                    markerGroup
                        .selectAll<SVGCircleElement, OutlierDatum<M>>("circle")
                        .data(regular)
                        .join(
                            enter => enter
                                .append("circle")
                                .attr("r", radius)
                                .attr("fill", stroke)
                                .attr("stroke", "none")
                                .attr("cx", d => xAxis.scale(d.datum.x) || 0)
                                .attr("cy", d => yAxis.scale(d.datum.y) || 0),
                            update => update
                                .attr("r", radius)
                                .attr("fill", stroke)
                                .attr("cx", d => xAxis.scale(d.datum.x) || 0)
                                .attr("cy", d => yAxis.scale(d.datum.y) || 0),
                            exit => exit.remove()
                        )
                } else {
                    mainGElem.selectAll(`#${seriesId}-${chartId}-outlier-markers`).remove()
                }

                const outlierGroupId = `${seriesId}-${chartId}-outlier-points`
                const outlierGroup = mainGElem
                    .selectAll<SVGGElement, Array<OutlierDatumColor<M>>>(`#${outlierGroupId}`)
                    .data([outlier], () => `${series.name}-outlier-points`)
                    .join(
                        enter => enter
                            .append("g")
                            .attr("id", outlierGroupId)
                            .attr("class", "outlier-points")
                            .attr("data-series-name", series.name)
                            .attr("transform", `translate(${margin.left}, ${margin.top})`)
                            .attr("clip-path", `url(#${clipPathId})`),
                        update => update,
                        exit => exit.remove()
                    )

                outlierGroup
                    .selectAll<SVGCircleElement, OutlierDatumColor<M>>("circle")
                    .data(outlier)
                    .join(
                        enter => enter
                            .append("circle")
                            .attr("r", 4)
                            .attr("fill", outlier => outlier.color)
                            .attr("stroke", "none")
                            .attr("cx", outlier => xAxis.scale(outlier.datum.datum.x) || 0)
                            .attr("cy", o => yAxis.scale(o.datum.datum.y) || 0)
                            .on("mouseover", (event: MouseEvent, datum) => {
                                const [x, y] = d3.pointer(event, container)
                                // grab the x-value (chart) associate with the x-value (screen)
                                const outlierDatum = datum.datum
                                const bandIndex = largestExceededBoundIndex(outlierDatum) + 1
                                const upperMeasure = bandIndex < series.measures.length ? series.measures[bandIndex] : undefined
                                const lowerMeasure = bandIndex > 0 ? series.measures[bandIndex - 1] : undefined
                                const pointsInBand = calcPointsInBand(plotData, bandIndex)
                                mouseOverHandlerFor(`tooltip-${chartId}`)?.(
                                    series.name,
                                    outlierDatum.datum.x,
                                    {
                                        series: series.data,
                                        metadata: {
                                            datum: outlierDatum,
                                            upperMeasure,
                                            lowerMeasure,
                                            bandIndex,
                                            pointsInBand,
                                        }
                                    },
                                    [x, y]
                                )
                            })
                            .on("mouseleave", () => {
                                mouseLeaveHandlerFor(`tooltip-${chartId}`)?.(series.name)
                            })
                        ,
                        update => update
                            .attr("r", 4)
                            .attr("fill", outlier => outlier.color)
                            .attr("cx", outlier => xAxis.scale(outlier.datum.datum.x) || 0)
                            .attr("cy", outlier => yAxis.scale(outlier.datum.datum.y) || 0),
                        exit => exit.remove()
                    )
            })
        },
        [
            container, panEnabled, zoomEnabled, chartId, plotDimensions, margin, onPan,
            zoomKeyModifiersRequired, onZoom, axisAssignments,
            xAxesState, yAxesState,
            seriesStyles, seriesFilter, interpolation,
            bandOpacity, bandOpacityStep, markerRadius, outlierMarkerColors, hoveredSeriesName,
            mouseOverHandlerFor, mouseLeaveHandlerFor, shouldSubscribe
        ]
    )

    const updatePlotRef = useRef<(ranges: Map<string, ContinuousAxisRange>, g: GSelection) => void>(noop)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/immutability
        updatePlotRef.current = updatePlot
    }, [updatePlot])

    const onUpdateTimeRef = useRef(updateAxisRanges)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/immutability
        onUpdateTimeRef.current = updateAxisRanges
    }, [updateAxisRanges])

    const subscribe = useCallback(() => {
        if (seriesObservable === undefined || mainG === null) return undefined
        return subscriptionOutlierFor<M>(
            seriesObservable as Observable<OutlierChartData<M>>,
            onSubscribe,
            windowingTime,
            axisAssignments, xAxesState,
            onUpdateData,
            dropDataAfter,
            updateTimingAndPlot,
            seriesRef.current,
            (axisId, end) => currentTimeRef.current.set(axisId, end),
            timeWindowBehavior,
            initialTimes,
        )
    }, [
        axisAssignments, dropDataAfter, mainG,
        onSubscribe, onUpdateData,
        seriesObservable, updateTimingAndPlot, windowingTime, xAxesState,
        initialTimes, timeWindowBehavior
    ])

    const timeRangesRef = useRef<Map<string, ContinuousAxisRange>>(new Map())
    useEffect(() => {
        if (container && mainG) {
            if (timeRangesRef.current.size === 0) {
                timeRangesRef.current = continuousAxisRanges(xAxesState.axes as Map<string, ContinuousNumericAxis>)
            } else {
                const intervals = continuousAxisIntervals(xAxesState.axes)
                timeRangesRef.current.forEach((range, id, m) => {
                    const [start, end] = Optional.ofNullable(intervals.get(id))
                        .map(interval => interval.asTuple())
                        .getOrThrow(() => new Error(`Unable to retrieve interval for axis; axis_id: ${id}`))
                    if (!isNaN(start) && !isNaN(end)) {
                        m.set(id, range.update(start, end))
                    }
                })
            }
            updatePlot(timeRangesRef.current, mainG)
        }
    }, [chartId, container, mainG, plotDimensions, updatePlot, xAxesState])

    useEffect(() => {
        if (shouldSubscribe && subscriptionRef.current === undefined) {
            subscriptionRef.current = subscribe()
        } else if (!shouldSubscribe && subscriptionRef.current !== undefined) {
            subscriptionRef.current?.unsubscribe()
            subscriptionRef.current = undefined
        }
    }, [shouldSubscribe, subscribe])

    return null
}

/**
 * Returns the index of the largest bound the datum's y-value is outside of, or -1 if the value
 * is inside every bound. Bounds are expected to be ordered from tightest (index 0) to widest
 * (highest index), so the highest-index match identifies the most severe outlier tier.
 */
function largestExceededBoundIndex<M extends readonly number[]>(datum: OutlierDatum<M>): number {
    for (let i = datum.bounds.length - 1; i >= 0; i--) {
        const {lower, upper} = datum.bounds[i]
        if (datum.datum.y < lower || datum.datum.y > upper) return i
    }

    return -1
}

function axesFor(
    seriesName: string,
    axisAssignments: Map<string, AxesAssignment>,
    xAxisFor: (id: string) => BaseAxis | undefined,
    yAxisFor: (id: string) => BaseAxis | undefined,
): [xAxis: ContinuousNumericAxis | undefined, yAxis: ContinuousNumericAxis | undefined] {
    const assigned = axisAssignments.get(seriesName)
    const xAxis = xAxisFor(assigned?.xAxis || "") as ContinuousNumericAxis | undefined
    const yAxis = yAxisFor(assigned?.yAxis || "") as ContinuousNumericAxis | undefined
    if (xAxisFor(assigned?.xAxis || "") && !xAxis) {
        throw Error("Outlier plot requires that x-axis be of type ContinuousNumericAxis")
    }
    if (yAxisFor(assigned?.yAxis || "") && !yAxis) {
        throw Error("Outlier plot requires that y-axis be of type ContinuousNumericAxis")
    }
    return [xAxis, yAxis]
}

/**
 * Calculate the number of points within a specific outlier band.
 * @param plotData The array of outlier data points.
 * @param bandIndex The index of the outlier band to calculate points for.
 * @param [subtractLowerBandCount=true] Whether to subtract the count of points in the lower band. Defaults to true.
 * @returns The number of points within the specified outlier band.
 */
function calcPointsInBand<M extends readonly number[]>(
    plotData: Array<OutlierDatum<M>> | FastShiftArray<OutlierDatum<M>>,
    bandIndex: number,
    subtractLowerBandCount: boolean = true
): number {
    // function to count the points in a specific outlier band
    const countPointsInBand = (bandIndex: number) =>
        plotData
            .filter(datum => {
                    if (bandIndex < datum.bounds.length) {
                        return datum.datum.y >= datum.bounds[bandIndex].lower && datum.datum.y <= datum.bounds[bandIndex].upper
                    }
                    return true
                }
            ).length

    const pointsInBand = countPointsInBand(bandIndex)
    // we need to subtract the points in the lower band. recall that each band has ALL the points
    // in the band's range, not what we may think of visually
    if (bandIndex > 0 && subtractLowerBandCount) {
        return pointsInBand - countPointsInBand(bandIndex - 1)
    }
    return pointsInBand
}

type CategorizedData<M extends readonly number[]> = {
    regular: Array<OutlierDatum<M>>,
    outlier: Array<OutlierDatumColor<M>>
}

/**
 * Categorizes outlier data into regular and outlier points based on provided marker colors.
 * @param data Array of outlier data to categorize
 * @param outlierMarkerColors Array of colors to use for outlier markers
 * @returns Object with regular and outlier data arrays
 * @template M Type of the measure
 */
function categorizePoints<M extends readonly number[]>(
    data: FastShiftArray<OutlierDatum<M>>,
    outlierMarkerColors: ReadonlyArray<string> = []
): CategorizedData<M> {
    return data.reduce<CategorizedData<M>>(
        (accum, datum) => {
            const bandIndex = largestExceededBoundIndex(datum)
            if (bandIndex < 0) {
                accum.regular.push(datum)
            } else {
                accum.outlier.push({datum, color: outlierMarkerColors[bandIndex] ?? "red"})
            }
            return accum
        },
        {regular: [], outlier: []} as CategorizedData<M>
    )
}
