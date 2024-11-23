import {Dimensions, Margin} from "./margins";
import {ContinuousAxisRange, continuousAxisRangeFor} from "./continuousAxisRangeFor";
import * as d3 from "d3";
import {Axis, ScaleBand, ScaleContinuousNumeric, ScaleLinear, ZoomTransform} from "d3";
import {AxisElementSelection, SvgSelection} from "./d3types";
import {addContinuousNumericXAxis, addContinuousNumericYAxis} from "./ContinuousAxis";
import {noop} from "./utils";
import {AxesState} from "./hooks/AxesState";
import {AxesAssignment} from "./plot";
import {BaseSeries} from "./baseSeries";

export interface AxesLabelFont {
    size: number
    color: string
    family: string
    weight: number
}

export const defaultAxesLabelFont: AxesLabelFont = {
    size: 12,
    color: '#d2933f',
    weight: 300,
    family: 'sans-serif'
}

export interface SeriesLineStyle {
    color: string
    lineWidth: number
    highlightColor: string
    highlightWidth: number
    margin?: number
}

export const defaultLineStyle: SeriesLineStyle = {
    color: '#008aad',
    lineWidth: 1,
    highlightColor: '#008aad',
    highlightWidth: 3,
}

export interface Axes<X extends BaseAxis, Y extends BaseAxis> {
    xAxis: X
    yAxis: Y
}

export interface BaseAxis {
    axisId: string
    location: AxisLocation
    selection: AxisElementSelection
}

export interface ContinuousNumericAxis extends BaseAxis {
    scale: ScaleContinuousNumeric<number, number>
    generator: Axis<number | { valueOf(): number }>
    update: (domain: [startValue: number, endValue: number], plotDimensions: Dimensions, margin: Margin) => void
}

export interface CategoryAxis extends BaseAxis {
    scale: ScaleBand<string>
    generator: Axis<string>
    categorySize: number
    update: (categoryNames: Array<string>, unfilteredSize: number, plotDimensions: Dimensions, margin: Margin) => number
}

export enum AxisLocation {
    Left,
    Right,
    Bottom,
    Top
}

export function addLinearAxis(
    chartId: number,
    axisId: string,
    svg: SvgSelection,
    location: AxisLocation,
    plotDimensions: Dimensions,
    domain: [minValue: number, maxValue: number],
    axesLabelFont: AxesLabelFont,
    margin: Margin,
    axisLabel: string,
): ContinuousNumericAxis {
    switch (location) {
        // y-axis
        case AxisLocation.Left:
        case AxisLocation.Right:
            return addContinuousNumericYAxis(
                chartId,
                axisId,
                svg,
                plotDimensions,
                location,
                d3.scaleLinear(),
                domain,
                axesLabelFont,
                margin,
                axisLabel,
                noop,
            )

        // x-axis
        case AxisLocation.Bottom:
        case AxisLocation.Top:
            return addContinuousNumericXAxis(chartId, "", svg, plotDimensions, location, d3.scaleLinear(), domain, axesLabelFont, margin, axisLabel, noop)
    }
}

export function addCategoryAxis(
    chartId: number,
    axisId: string,
    svg: SvgSelection,
    location: AxisLocation,
    plotDimensions: Dimensions,
    categories: Array<string>,
    axesLabelFont: AxesLabelFont,
    margin: Margin,
    axisLabel: string,
): CategoryAxis {
    switch (location) {
        case AxisLocation.Left:
        case AxisLocation.Right:
            return addCategoryYAxis(chartId, axisId, svg, plotDimensions, categories, axesLabelFont, margin, axisLabel, location)

        case AxisLocation.Bottom:
        case AxisLocation.Top:
            //todo should be the x axis
            return addCategoryYAxis(chartId, axisId, svg, plotDimensions, categories, axesLabelFont, margin, axisLabel, location)
    }
}

function addCategoryYAxis(
    chartId: number,
    axisId: string,
    svg: SvgSelection,
    plotDimensions: Dimensions,
    categories: Array<string>,
    axesLabelFont: AxesLabelFont,
    margin: Margin,
    axisLabel: string,
    location: AxisLocation,
): CategoryAxis {
    const categorySize = (plotDimensions.height - margin.top) / categories.length;
    const scale = d3.scaleBand()
        .domain(categories)
        .range([0, categorySize * categories.length]);

    // create and add the axes
    const generator = d3.axisLeft(scale);

    const selection = svg
        .append<SVGGElement>('g')
        .attr('id', `y-axis-selection-${chartId}`)
        .attr('class', 'y-axis')
        .attr('transform', `translate(${margin.left}, ${margin.top})`)
        .call(generator);

    svg
        .append<SVGTextElement>('text')
        .attr('id', `stream-chart-y-axis-label-${chartId}`)
        .attr('text-anchor', 'middle')
        .attr('font-size', axesLabelFont.size)
        .attr('fill', axesLabelFont.color)
        .attr('font-family', axesLabelFont.family)
        .attr('font-weight', axesLabelFont.weight)
        .attr('transform', `translate(${axesLabelFont.size}, ${margin.top + (plotDimensions.height - margin.top - margin.bottom) / 2}) rotate(-90)`)
        .text(axisLabel)

    const axis = {axisId, selection, location, scale, generator, categorySize, update: () => categorySize}

    return {
        ...axis,
        update: (categoryNames, unfilteredSize, plotDimensions) => updateCategoryYAxis(chartId, svg, axis, plotDimensions, unfilteredSize, categoryNames, axesLabelFont, margin)
    }
}

function updateCategoryYAxis(
    chartId: number,
    svg: SvgSelection,
    axis: CategoryAxis,
    plotDimensions: Dimensions,
    unfilteredSize: number,
    names: Array<string>,
    axesLabelFont: AxesLabelFont,
    margin: Margin,
): number {
    const categorySize = (plotDimensions.height - margin.top) / unfilteredSize
    axis.scale
        .domain(names)
        .range([0, categorySize * names.length])
    axis.selection.call(axis.generator)

    svg
        .select(`#stream-chart-y-axis-label-${chartId}`)
        .attr('transform', `translate(${axesLabelFont.size}, ${margin.top + (plotDimensions.height - margin.top - margin.bottom) / 2}) rotate(-90)`)

    return categorySize
}

/**
 * The result of a zoom action
 */
export interface ZoomResult {
    range: ContinuousAxisRange
    zoomFactor: number
}

/**
 * todo this can be generalized to any continuous numeric axis, replace x with value
 * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
 * at the location of the mouse when the scroll wheel or gesture was applied.
 * @param transform The d3 zoom transformation information
 * @param x The x-position of the mouse when the scroll wheel or gesture is used
 * @param axis The axis being zoomed
 * @param range The current range for the axis being zoomed
 * @return The updated range and the new zoom factor
 */
export function calculateZoomFor(
    transform: ZoomTransform,
    x: number,
    axis: ContinuousNumericAxis,
    range: ContinuousAxisRange,
): ZoomResult {
    const time = axis.generator.scale<ScaleLinear<number, number>>().invert(x);
    return {
        range: range.scale(transform.k, time),
        zoomFactor: transform.k
    };
}

/**
 * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
 * at the location of the mouse when the scroll wheel or gesture was applied, while ensure that
 * the range (start, end) is contained within the constraint (min, max).
 * @param transform The d3 zoom transformation information
 * @param x The x-position of the mouse when the scroll wheel or gesture is used
 * @param axis The axis being zoomed
 * @param range The current range for the axis being zoomed
 * @param constraint The minimum and maximum value the scaled range can have
 * @return The updated range and the new zoom factor
 */
export function calculateConstrainedZoomFor(
    transform: ZoomTransform,
    x: number,
    axis: ContinuousNumericAxis,
    range: ContinuousAxisRange,
    constraint: [min: number, max: number],
): ZoomResult {
    const time = axis.generator.scale<ScaleLinear<number, number>>().invert(x);
    return {
        range: range.constrainedScale(transform.k, time, constraint),
        zoomFactor: transform.k
    }
}

/**
 * Adjusts the range and updates the plot when the plot is dragged to the left or right
 * @param deltaX The amount that the plot is dragged
 * @param axis The axis being zoomed
 * @param range The current range for the axis being zoomed
 * @param [constainToOriginalRange=false] When set to `true` then the pan requires that the axis
 * range remains a subset of the origin axis range; when `false` the pan allows and range
 * @return The updated range
 */
export function calculatePanFor(
    deltaX: number,
    axis: ContinuousNumericAxis,
    range: ContinuousAxisRange,
    constainToOriginalRange: boolean = false
): ContinuousAxisRange {
    const scale = axis.generator.scale<ScaleLinear<number, number>>()
    const currentTime = range.start
    const x = scale(currentTime)
    if (x !== undefined) {
        const deltaTime = scale.invert(x + deltaX) - currentTime
        const constraint: [start: number, end: number] = constainToOriginalRange ? range.original : [-Infinity, Infinity]
        return range.translate(-deltaTime, constraint)
    }
    return range
}

/**
 * Accepts the series, the assignment of the series to axes, and the current x-axes state, and
 * returns a an array of the distinct axis IDs that cover all the series in the plot.
 *
 * @param series The array of series
 * @param axisAssignments A map association a series name with its axis assignments
 * @param axesState The current axis state
 * @return an array of the distinct axes that cover all the series in the plot
 */
export function axesForSeriesGen<D>(
    series: Array<BaseSeries<D>>,
    axisAssignments: Map<string, AxesAssignment>,
    axesState: AxesState
): Array<string> {
    return series.map(srs => srs.name)
        // grab the x-axis assigned to the series, or use the default x-axis if not
        // assignment has been made
        .map(name => axisAssignments.get(name)?.xAxis || axesState.axisDefaultId())
        // de-dup the array of axis IDs so that we don't end up applying the pan or zoom
        // transformation more than once
        .reduce((accum: Array<string>, axisId: string) => {
            if (!accum.find(id => id === axisId)) {
                accum.push(axisId)
            }
            return accum
        }, [])
}

/**
 * Higher-order function that generates a handler for pan events, given the distinct series IDs that cover all
 * the axes in the chart, the margin, time-range update function, and the current state of the x-axes. This
 * function returns a handler function. And this handler function adjusts the time-range when the plot is dragged
 * to the left or right. After calling the handler function, the plot needs to be updated as well, and this is
 * left for the caller.
 *
 * Please note that the function generated by this function has side effects -- it updates the axes ranges.
 *
 * @param axesForSeries The distinct axes that cover all the series
 * @param margin The plot margin
 * @param setTimeRangeFor Function for setting the new time-range for a specific axis
 * @param xAxesState The current state of the x-axes
 * @return A handler function for pan events
 */
export function panHandler(
    axesForSeries: Array<string>,
    margin: Margin,
    setTimeRangeFor: (axisId: string, timeRange: [start: number, end: number]) => void,
    xAxesState: AxesState
): (
    x: number,
    plotDimensions: Dimensions,
    series: Array<string>,
    ranges: Map<string, ContinuousAxisRange>,
) => void {
    /**
     * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
     * @param deltaX The amount that the plot is dragged
     * @param plotDimensions The dimensions of the plot
     * @param series An array of series names
     * @param ranges A map holding the axis ID and its associated time range
     */
    return (deltaX, plotDimensions, series, ranges) => {
        // run through the axis IDs, adjust their domain, and update the time-range set for that axis
        axesForSeries
            .forEach(axisId => {
                const xAxis = xAxesState.axisFor(axisId) as ContinuousNumericAxis
                const timeRange = ranges.get(axisId)
                if (timeRange) {
                    // calculate the change in the time-range based on the pixel change from the drag event
                    const range = calculatePanFor(deltaX, xAxis, timeRange)
                    if (Math.abs(range.start - timeRange.start) < 2) return

                    // update the time-range for the axis
                    ranges.set(axisId, range)

                    const {start, end} = range
                    setTimeRangeFor(axisId, [start, end])

                    // update the axis' time-range
                    xAxis.update([start, end], plotDimensions, margin)
                }
            })
        // hey, don't forget to update the plot with the new time-ranges in the code calling this... :)
    }
}

/**
 * Higher-order function that generates a handler for pan events, given the distinct series IDs that cover all
 * the axes in the chart, the margin, time-range update function, and the current state of the x-axes. This
 * function returns a handler function. And this handler function adjusts the time-range when the plot is dragged
 * to the left or right. After calling the handler function, the plot needs to be updated as well, and this is
 * left for the caller.
 *
 * Please note that the function generated by this function has side effects -- it updates the axes ranges.
 *
 * @param xAxesForSeries The distinct x-axes that cover all the series
 * @param yAxesForSeries The distinct y-axes that cover all the series
 * @param margin The plot margin
 * @param setAxisRange Function for setting the new time-range for a specific axis
 * @param xAxesState The current state of the x-axes
 * @param yAxesState The current state of the y-axes
 * @param [constrainToOriginalRange=true] Optional argument, that when set to `true`, constrains the
 * axis range to remain in the origin axis range; when `false` the axis range is unconstrained
 * @return A handler function for pan events
 */
export function panHandler2D(
    xAxesForSeries: Array<string>,
    yAxesForSeries: Array<string>,
    margin: Margin,
    setAxisRange: (axisId: string, timeRange: [start: number, end: number]) => void,
    xAxesState: AxesState,
    yAxesState: AxesState,
    constrainToOriginalRange: boolean = true
): (
    x: number,
    y: number,
    plotDimensions: Dimensions,
    series: Array<string>,
    xRanges: Map<string, ContinuousAxisRange>,
    yRanges: Map<string, ContinuousAxisRange>,
) => void {

    /**
     *
     * @param delta The pan amount in the axis specified for the series
     * @param axesForSeries The names of the axes of a dimension (x or y)
     * @param axesState The state for the axes of a dimension
     * @param ranges The current ranges for the axes of a dimension
     * @param plotDimensions The current plot dimensions (width, height)
     */
    function panAxes(delta: number, axesForSeries: Array<string>, axesState: AxesState, ranges: Map<string, ContinuousAxisRange>, plotDimensions: Dimensions): void {
        axesForSeries
            .forEach(axisId => {
                const axis = axesState.axisFor(axisId) as ContinuousNumericAxis
                const currentRange = ranges.get(axisId)
                if (currentRange) {
                    // calculate the change in the time-range based on the pixel change from the drag event
                    const range = calculatePanFor(delta, axis, currentRange, constrainToOriginalRange)

                    // update the time-range for the axis
                    ranges.set(axisId, range)

                    const {start, end} = range
                    setAxisRange(axisId, [start, end])

                    // update the axis' time-range
                    axis.update([start, end], plotDimensions, margin)
                }
            })

    }

    /**
     * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
     * @param deltaX The amount that the plot is dragged
     * @param plotDimensions The dimensions of the plot
     * @param series An array of series names
     * @param ranges A map holding the axis ID and its associated time range
     */
    return (deltaX, deltaY, plotDimensions, series, xRanges, yRanges) => {
        // run through the x- and y-axes and update them by delta, within the original bounds
        panAxes(deltaX, xAxesForSeries, xAxesState, xRanges, plotDimensions)
        panAxes(deltaY, yAxesForSeries, yAxesState, yRanges, plotDimensions)
        // hey, don't forget to update the plot with the new time-ranges in the code calling this... :)
    }
}

/**
 * Higher-order function that generates a handler for zoom events, given the distinct series IDs that cover all
 * the axes in the chart, the margin, range update function, and the current state of the x- or y-axes. This
 * function returns a handler function. And this handler function adjusts the range when the plot is zoomed.
 * After calling the handler function, the plot needs to be updated as well, and this is left for the caller.
 *
 * Please note that the function generated by this function has side effects -- it updates the axes ranges.
 *
 * @param axesForSeries The distinct axes that cover all the series
 * @param margin The plot margin
 * @param setRangeFor Function for setting the new time-range for a specific axis
 * @param axesState The current state of the x- or y-axes
 * @param scaleExtent The minimum and maximum allowed scale factors
 * @return A handler function for pan events
 */
export function axisZoomHandler(
    axesForSeries: Array<string>,
    margin: Margin,
    setRangeFor: (axisId: string, range: [start: number, end: number]) => void,
    axesState: AxesState,
    scaleExtent: [min: number, max: number] = [-Infinity, Infinity],
): (
    transform: ZoomTransform,
    x: number,
    plotDimensions: Dimensions,
    ranges: Map<string, ContinuousAxisRange>,
) => void {

    const [, zoomMax] = scaleExtent

    /**
     * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
     * at the location of the mouse when the scroll wheel or gesture was applied.
     * @param transform The d3 zoom transformation information
     * @param x The x-position of the mouse when the scroll wheel or gesture is used
     * @param plotDimensions The dimensions of the plot
     * @param ranges A map holding the axis ID and its associated time-range
     */
    return (transform, x, plotDimensions, ranges) => {
        // run through the axis IDs, adjust their domain, and update the time-range set for that axis
        axesForSeries
            .forEach(axisId => {
                const axis = axesState.axisFor(axisId) as ContinuousNumericAxis
                const range = ranges.get(axisId)
                if (range) {
                    // calculate the constraint for the zoom
                    const [originalStart, originalEnd] = range.original
                    const constraint: [number, number] = isFinite(zoomMax) ?
                        [originalStart * zoomMax, originalEnd * zoomMax] :
                        [-Infinity, Infinity]

                    const zoom = calculateConstrainedZoomFor(transform, x, axis, range, constraint)
                    // const zoom = calculateZoomFor(transform, x, axis, range)

                    // update the axis range
                    ranges.set(axisId, zoom.range)

                    setRangeFor(axisId, [zoom.range.start, zoom.range.end])

                    // update the axis' time-range
                    axis.update([zoom.range.start, zoom.range.end], plotDimensions, margin)
                }
            })
        // hey, don't forget to update the plot with the new time-ranges in the code calling this... :)
    }
}

/**
 * Higher-order function that generates a handler for zoom events, given the distinct series IDs that cover all
 * the axes in the chart, the margin, range update function, and the current state of the x- or y-axes. This
 * function returns a handler function. And this handler function adjusts the time-range when the plot is zoomed.
 * After calling the handler function, the plot needs to be updated as well, and this is left for the caller.
 *
 * Please note that the function generated by this function has side effects -- it updates the axes ranges.
 *
 * @param xAxesForSeries The distinct x-axes that cover all the series
 * @param yAxesForSeries The distinct y-axes that cover all the series
 * @param margin The plot margin
 * @param setRangeFor Function for setting the new time-range for a specific axis
 * @param xAxesState The current state of the x-axes
 * @param yAxesState The current state of the y-axes
 * @param scaleExtent The smallest and largest scale factors allowed
 * @return A handler function for pan events
 */
export function axesZoomHandler(
    xAxesForSeries: Array<string>,
    yAxesForSeries: Array<string>,
    margin: Margin,
    setRangeFor: (axisId: string, range: [start: number, end: number]) => void,
    xAxesState: AxesState,
    yAxesState: AxesState,
    scaleExtent: [min: number, max: number],
): (
    transform: ZoomTransform,
    mousePosition: [x: number, y: number],
    plotDimensions: Dimensions,
    xRanges: Map<string, ContinuousAxisRange>,
    yRanges: Map<string, ContinuousAxisRange>,
) => void {

    const [, zoomMax] = scaleExtent

    /**
     * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
     * at the location of the mouse when the scroll wheel or gesture was applied.
     * @param transform The d3 zoom transformation information
     * @param mousePosistion The position of the mouse when the scroll wheel or gesture is used
     * @param plotDimensions The dimensions of the plot
     * @param ranges A map holding the axis ID and its associated time-range
     */
    return (transform, mousePosition, plotDimensions, xRanges, yRanges) => {

        /**
         * Calculates the zoom for the specified axis and updates the axis and the axis ranges
         * @param value The x- or y-coordinate of the mouse
         * @param axisId
         * @param axesState
         * @param ranges A map associating axis IDs with axis ranges
         */
        function calcZoomAndUpdate(value: number, axisId: string, axesState: AxesState, ranges: Map<string, ContinuousAxisRange>): void {
            const range = ranges.get(axisId)
            if (range) {
                const axis = axesState.axisFor(axisId) as ContinuousNumericAxis

                // calculate the constraint for the zoom
                const [originalStart, originalEnd] = range.original
                const constraint: [number, number] = [originalStart * zoomMax, originalEnd * zoomMax]

                const zoom = calculateConstrainedZoomFor(transform, value, axis, range, constraint)

                // update the axis range
                ranges.set(axisId, zoom.range)

                setRangeFor(axisId, [zoom.range.start, zoom.range.end])

                // update the axis' range
                axis.update([zoom.range.start, zoom.range.end], plotDimensions, margin)
            }
        }

        // run through the axis IDs, adjust their domain, and update the time-range set for that axis
        const [x, y] = mousePosition
        xAxesForSeries.forEach(id => calcZoomAndUpdate(x, id, xAxesState, xRanges))
        yAxesForSeries.forEach(id => calcZoomAndUpdate(y, id, yAxesState, yRanges))
        // hey, don't forget to update the plot with the new time-ranges in the code calling this... :)
    }
}

/**
 * Calculates the time-ranges for each of the axes in the map
 * @param xAxes The map containing the axes and their associated IDs
 * @return a map associating the axis IDs to their time-range
 */
export function timeRanges(xAxes: Map<string, ContinuousNumericAxis>): Map<string, ContinuousAxisRange> {
    return continuousRange(xAxes)
}

/**
 * Calculates the time-intervals (start, end) for each of the x-axis
 * @param xAxes The x-axes representing the time
 * @return A map associating each x-axis with a (start, end) interval
 */
export function timeIntervals(xAxes: Map<string, ContinuousNumericAxis>): Map<string, [start: number, end: number]> {
    return new Map(Array.from(xAxes.entries())
        .map(([id, axis]) => [id, axis.scale.domain()] as [string, [number, number]]))
}

/**
 * Returns the bounds on the specified continuous numeric axes
 * @param axes A map associating an axis ID with a {@link ContinuousNumericAxis}
 * @return A map associating each specified axis ID with the interval covered (bounds) by the axis
 */
export function continuousRange(axes: Map<string, ContinuousNumericAxis>): Map<string, ContinuousAxisRange> {
    return new Map(Array.from(axes.entries())
        .map(([id, axis]) => {
            const [start, end] = axis.scale.domain()
            return [id, continuousAxisRangeFor(start, end)]
        }))
}

export function continuousRangeForDefaultAxis(axis: ContinuousNumericAxis): ContinuousAxisRange {
    const [start, end] = axis.scale.domain()
    return continuousAxisRangeFor(start, end)
}