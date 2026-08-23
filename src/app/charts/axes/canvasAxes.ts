// Canvas equivalents of the continuous-numeric, ordinal (category), and empty axis functions from
// axes.ts (`addContinuousNumericXAxis`/`YAxis`, `addOrdinalStringAxis`, `addEmptyXAxis`/`YAxis`, and
// their `update*` helpers). These draw ticks, the domain line, and the axis label directly onto the
// shared canvas context instead of appending/updating SVG `<g>`/`<text>` elements.
//
// NOTE: the zoom/pan handlers that remain in axes.ts (`continuousAxisZoomHandler`, `panHandler`,
// etc.) haven't been reviewed/converted yet -- they mostly operate on scales/ranges rather than
// SVG elements directly, so they may need little to no change, but that needs confirming against
// their actual bodies. Once that's done, the types and functions here will move into (and replace
// the corresponding parts of) axes.ts itself so there's a single, coherent axis module again.

import * as d3 from "d3";
import type {ScaleBand, ScaleContinuousNumeric} from "d3";
import type {CanvasContext, DrawHandle} from "./../d3types";
import type {Dimensions, Margin} from "../styling/margins";
import {clipToArea} from "../plots/plot";
import {fontStringFor} from "../utils";
import {AxisLocation, type AxesFont, type AxisTickStyle} from "./axes";
import {AxisInterval} from "./AxisInterval";

/** Default tick length, in pixels, matching d3-axis's default `tickSize`. */
const TICK_SIZE = 6
/** Default gap between the end of a tick and its label, matching d3-axis's default `tickPadding`. */
const TICK_PADDING = 3

/**
 * Canvas replacement for the old `ContinuousNumericAxis` (which carried an SVG `selection` and a
 * d3 `generator`). Instead of a selection, it carries a `draw` function that the caller registers
 * with the {@link CanvasContext}.
 */
export interface CanvasContinuousNumericAxis {
    axisId: string
    location: AxisLocation
    scale: ScaleContinuousNumeric<number, number>
    /** Updates the axis' domain/scale and requests a redraw. Mirrors the old `update`. */
    update: (domain: AxisInterval, plotDimensions: Dimensions, margin: Margin) => void
    /**
     * Updates the font (color, size, family, weight) used for ticks and the axis label, without
     * recreating the axis or touching its domain. Mirrors the old
     * `svg.select('#label').attr('fill', color)` one-liner that kept the label color in sync with
     * the chart's `color` prop (e.g. on a theme change) between full axis updates.
     */
    updateFont: (font: AxesFont) => void
}

/**
 * Adds a new x-axis, registering its draw function with the canvas context.
 * @param cc The canvas context to register the axis' draw function with
 * @param axisId A unique ID for the axis
 * @param plotDimensions The dimensions of the plot
 * @param location The location of the axis (top or bottom)
 * @param scaleGenerator The d3 scale to use for the axis (its domain/range get overwritten)
 * @param domain The axis range (start, end)
 * @param axesLabelFont The font for the axis label and ticks
 * @param margin The plot margins
 * @param axisLabel The label for the axis
 * @param setAxisRangeFor Callback used to report the axis' current range
 * @return A {@link CanvasContinuousNumericAxis}
 */
export function createContinuousNumericXAxis(
    cc: CanvasContext,
    axisId: string,
    plotDimensions: Dimensions,
    location: typeof AxisLocation.Bottom | typeof AxisLocation.Top,
    scaleGenerator: ScaleContinuousNumeric<number, number>,
    domain: [minValue: number, maxValue: number],
    axesLabelFont: AxesFont,
    margin: Margin,
    axisLabel: string,
    setAxisRangeFor: (axisId: string, timeRange: AxisInterval) => void,
): CanvasContinuousNumericAxis {
    const scale = scaleGenerator.domain(domain).range([0, plotDimensions.width])

    let currentDimensions = plotDimensions
    let currentMargin = margin
    const currentLabel = axisLabel
    let currentFont = axesLabelFont

    const drawHandle: DrawHandle = `x-axis-${cc.chartId}-${axisId}`

    const draw = (context: CanvasContext) => {
        const {context2D} = context
        context2D.save()
        context2D.translate(currentMargin.left, yTranslation(location, currentDimensions, currentMargin))

        // clip ticks/labels to the width of the plot (mirrors the old SVG clip-path)
        context2D.save()
        clipToArea(context, {width: currentDimensions.width, height: currentMargin.bottom}, {x: 0, y: location === AxisLocation.Bottom ? -1 : -currentMargin.top})

        context2D.strokeStyle = currentFont.color
        context2D.fillStyle = currentFont.color
        context2D.lineWidth = 1
        context2D.font = fontStringFor(currentFont.size, currentFont.family, currentFont.weight)
        context2D.textAlign = 'center'
        context2D.textBaseline = location === AxisLocation.Bottom ? 'top' : 'bottom'

        // domain line
        context2D.beginPath()
        context2D.moveTo(0, 0)
        context2D.lineTo(currentDimensions.width, 0)
        context2D.stroke()

        // ticks
        const tickDirection = location === AxisLocation.Bottom ? 1 : -1
        scale.ticks().forEach(tickValue => {
            const x = scale(tickValue)
            context2D.beginPath()
            context2D.moveTo(x, 0)
            context2D.lineTo(x, TICK_SIZE * tickDirection)
            context2D.stroke()
            context2D.fillText(
                scale.tickFormat()(tickValue),
                x,
                (TICK_SIZE + TICK_PADDING) * tickDirection
            )
        })

        context2D.restore() // pop the clip

        // axis label (not clipped, matches the old behavior)
        context2D.fillStyle = currentFont.color
        context2D.font = fontStringFor(currentFont.size, currentFont.family, currentFont.weight)
        context2D.textAlign = 'center'
        context2D.textBaseline = location === AxisLocation.Top ? 'hanging' : 'alphabetic'
        const labelY = continuousLabelYTranslation(location, currentDimensions, currentMargin) - yTranslation(location, currentDimensions, currentMargin)
        context2D.fillText(currentLabel, currentDimensions.width / 2, labelY)

        context2D.restore()
    }

    cc.register(drawHandle, draw, 0)

    return {
        axisId,
        location,
        scale,
        update: (domain, plotDimensions, margin) => {
            scale.domain(domain.asTuple()).range([0, plotDimensions.width])
            currentDimensions = plotDimensions
            currentMargin = margin
            setAxisRangeFor(axisId, domain)
            cc.requestRedraw()
        },
        updateFont: (font) => {
            currentFont = font
            cc.requestRedraw()
        }
    }
}

/**
 * Adds a new y-axis, registering its draw function with the canvas context.
 * @param cc The canvas context to register the axis' draw function with
 * @param axisId A unique ID for the axis
 * @param plotDimensions The dimensions of the plot
 * @param location The location of the axis (left or right)
 * @param scaleGenerator The d3 scale to use for the axis (its domain/range get overwritten)
 * @param domain The axis range (start, end)
 * @param axesLabelFont The font for the axis label and ticks
 * @param margin The plot margins
 * @param axisLabel The label for the axis
 * @param setAxisRangeFor Callback used to report the axis' current range
 * @return A {@link CanvasContinuousNumericAxis}
 */
export function createContinuousNumericYAxis(
    cc: CanvasContext,
    axisId: string,
    plotDimensions: Dimensions,
    location: typeof AxisLocation.Left | typeof AxisLocation.Right,
    scaleGenerator: ScaleContinuousNumeric<number, number>,
    domain: [minValue: number, maxValue: number],
    axesLabelFont: AxesFont,
    margin: Margin,
    axisLabel: string,
    setAxisRangeFor: (axisId: string, range: AxisInterval) => void,
): CanvasContinuousNumericAxis {
    const scale = scaleGenerator
        .domain(domain)
        .range([Math.max(margin.bottom, plotDimensions.height), 0])

    let currentDimensions = plotDimensions
    let currentMargin = margin
    const currentLabel = axisLabel
    let currentFont = axesLabelFont

    const drawHandle: DrawHandle = `y-axis-${cc.chartId}-${axisId}`

    const draw = (context: CanvasContext) => {
        const {context2D} = context
        context2D.save()
        context2D.translate(xTranslation(location, currentDimensions, currentMargin), currentMargin.top)

        context2D.save()
        const clipWidth = location === AxisLocation.Left ? currentMargin.left : currentMargin.right
        clipToArea(context, {width: clipWidth, height: currentDimensions.height}, {x: location === AxisLocation.Left ? -clipWidth : 0, y: 0})

        context2D.strokeStyle = currentFont.color
        context2D.fillStyle = currentFont.color
        context2D.lineWidth = 1
        context2D.font = fontStringFor(currentFont.size, currentFont.family, currentFont.weight)
        context2D.textBaseline = 'middle'
        context2D.textAlign = location === AxisLocation.Left ? 'right' : 'left'

        // domain line
        context2D.beginPath()
        context2D.moveTo(0, 0)
        context2D.lineTo(0, currentDimensions.height)
        context2D.stroke()

        // ticks
        const tickDirection = location === AxisLocation.Left ? -1 : 1
        scale.ticks().forEach(tickValue => {
            const y = scale(tickValue)
            context2D.beginPath()
            context2D.moveTo(0, y)
            context2D.lineTo(TICK_SIZE * tickDirection, y)
            context2D.stroke()
            context2D.fillText(
                scale.tickFormat()(tickValue),
                (TICK_SIZE + TICK_PADDING) * tickDirection,
                y
            )
        })

        context2D.restore() // pop the clip

        // axis label, rotated -90deg, matching the old SVG version
        context2D.save()
        const labelX = continuousLabelXTranslation(location, currentDimensions, currentMargin, currentFont) - xTranslation(location, currentDimensions, currentMargin)
        context2D.translate(labelX, currentDimensions.height / 2)
        context2D.rotate(-Math.PI / 2)
        context2D.fillStyle = currentFont.color
        context2D.font = fontStringFor(currentFont.size, currentFont.family, currentFont.weight)
        context2D.textAlign = 'center'
        context2D.textBaseline = 'alphabetic'
        context2D.fillText(currentLabel, 0, 0)
        context2D.restore()

        context2D.restore()
    }

    cc.register(drawHandle, draw, 0)

    return {
        axisId,
        location,
        scale,
        update: (domain, plotDimensions, margin) => {
            scale.domain(domain.asTuple()).range([Math.max(margin.bottom, plotDimensions.height), 0])
            currentDimensions = plotDimensions
            currentMargin = margin
            setAxisRangeFor(axisId, domain)
            cc.requestRedraw()
        },
        updateFont: (font) => {
            currentFont = font
            cc.requestRedraw()
        }
    }
}

/**
 * Adds a new, empty x-axis (a line with no ticks or label) to the canvas context.
 * @param cc The canvas context to register the axis' draw function with
 * @param axisId The ID of the axis
 * @param plotDimensions The dimensions of the plot
 * @param location The location of the axis
 * @param scaleGenerator The d3 scale to use for the axis
 * @param margin The plot margins
 * @param setAxisRangeFor A callback used to set the axis range
 * @param domain The axis range (start, end)
 * @return A {@link CanvasContinuousNumericAxis}
 */
export function createEmptyXAxis(
    cc: CanvasContext,
    axisId: string,
    plotDimensions: Dimensions,
    location: typeof AxisLocation.Bottom | typeof AxisLocation.Top,
    scaleGenerator: ScaleContinuousNumeric<number, number>,
    margin: Margin,
    setAxisRangeFor: (axisId: string, timeRange: AxisInterval) => void,
    domain: [minValue: number, maxValue: number] = [0, 1],
): CanvasContinuousNumericAxis {
    const scale = scaleGenerator.domain(domain).range([0, plotDimensions.width])

    let currentDimensions = plotDimensions
    let currentMargin = margin

    const drawHandle: DrawHandle = `x-axis-empty-${cc.chartId}-${axisId}`

    const draw = (context: CanvasContext) => {
        const {context2D} = context
        context2D.save()
        context2D.translate(currentMargin.left, yTranslation(location, currentDimensions, currentMargin))
        context2D.strokeStyle = context2D.fillStyle // "currentColor" equivalent: use whatever the chart's base fill color is
        context2D.beginPath()
        context2D.moveTo(0, 0)
        context2D.lineTo(currentDimensions.width, 0)
        context2D.stroke()
        context2D.restore()
    }

    cc.register(drawHandle, draw, 0)

    return {
        axisId,
        location,
        scale,
        update: (domain, plotDimensions, margin) => {
            scale.domain(domain.asTuple()).range([0, plotDimensions.width])
            currentDimensions = plotDimensions
            currentMargin = margin
            setAxisRangeFor(axisId, domain)
            cc.requestRedraw()
        },
        // an empty axis has no ticks or label to color, so there's nothing for updateFont to do
        updateFont: () => {}
    }
}

/**
 * Adds a new, empty y-axis (a line with no ticks or label) to the canvas context.
 * @param cc The canvas context to register the axis' draw function with
 * @param axisId The ID of the axis
 * @param plotDimensions The dimensions of the plot
 * @param location The location of the axis
 * @param scaleGenerator The d3 scale to use for the axis
 * @param margin The plot margins
 * @param setAxisRangeFor A callback used to set the axis range
 * @param domain The axis range (start, end)
 * @return A {@link CanvasContinuousNumericAxis}
 */
export function createEmptyYAxis(
    cc: CanvasContext,
    axisId: string,
    plotDimensions: Dimensions,
    location: typeof AxisLocation.Left | typeof AxisLocation.Right,
    scaleGenerator: ScaleContinuousNumeric<number, number>,
    margin: Margin,
    setAxisRangeFor: (axisId: string, timeRange: AxisInterval) => void,
    domain: [minValue: number, maxValue: number] = [0, 1],
): CanvasContinuousNumericAxis {
    const scale = scaleGenerator.domain(domain).range([plotDimensions.height, 0])

    let currentDimensions = plotDimensions
    let currentMargin = margin

    const drawHandle: DrawHandle = `y-axis-empty-${cc.chartId}-${axisId}`

    const draw = (context: CanvasContext) => {
        const {context2D} = context
        context2D.save()
        context2D.translate(xTranslation(location, currentDimensions, currentMargin), currentMargin.top)
        context2D.strokeStyle = context2D.fillStyle
        context2D.beginPath()
        context2D.moveTo(0, 0)
        context2D.lineTo(0, currentDimensions.height)
        context2D.stroke()
        context2D.restore()
    }

    cc.register(drawHandle, draw, 0)

    return {
        axisId,
        location,
        scale,
        update: (domain, plotDimensions, margin) => {
            scale.domain(domain.asTuple()).range([plotDimensions.height, 0])
            currentDimensions = plotDimensions
            currentMargin = margin
            setAxisRangeFor(axisId, domain)
            cc.requestRedraw()
        },
        // an empty axis has no ticks or label to color, so there's nothing for updateFont to do
        updateFont: () => {}
    }
}

/**
 * Canvas replacement for the old `OrdinalStringAxis` (which carried an SVG `selection`/`generator`).
 */
export interface CanvasOrdinalStringAxis {
    axisId: string
    location: AxisLocation
    scale: ScaleBand<string>
    categorySize: number
    /** Updates the axis' range and requests a redraw; returns the (possibly new) category size. */
    update: (range: AxisInterval, originalRange: AxisInterval, plotDimensions: Dimensions, margin: Margin) => number
    /** Updates the font used for ticks and the axis label, without recreating the axis. */
    updateFont: (font: AxesFont) => void
}

/**
 * Adds a category axis to the specified location, registering its draw function with the canvas
 * context. When the location is top or bottom, the category axis represents the x-axis; when the
 * location is left or right, it represents the y-axis. Canvas replacement for
 * `addOrdinalStringAxis`.
 * @param cc The canvas context to register the axis' draw function with
 * @param axisId A unique ID for the axis
 * @param location The location of the axis
 * @param categories The category names (fixed for the lifetime of this axis -- changing categories
 * requires recreating the axis, same as the original SVG version)
 * @param axisLabel The axis label
 * @param axesLabelFont The font for the axis label
 * @param axisTickStyle Styling information for the ticks (font, rotation, etc)
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margin
 * @param setAxisRangeFor Callback that sets the axis range for the specified axis
 * @param setOriginalAxisRangeFor Callback that sets the original axis range for the specified axis
 * @return A {@link CanvasOrdinalStringAxis}
 */
export function createOrdinalStringAxis(
    cc: CanvasContext,
    axisId: string,
    location: AxisLocation,
    categories: Array<string>,
    axisLabel: string,
    axesLabelFont: AxesFont,
    axisTickStyle: AxisTickStyle,
    plotDimensions: Dimensions,
    margin: Margin,
    setAxisRangeFor: (axisId: string, range: AxisInterval) => void,
    setOriginalAxisRangeFor: (axisId: string, range: AxisInterval) => void,
): CanvasOrdinalStringAxis {
    switch (location) {
        case AxisLocation.Top:
        case AxisLocation.Bottom:
            return createOrdinalStringXAxis(
                cc, axisId, location, categories, axisLabel, axesLabelFont, axisTickStyle,
                plotDimensions, margin, setAxisRangeFor, setOriginalAxisRangeFor
            )
        case AxisLocation.Left:
        case AxisLocation.Right:
            return createOrdinalStringYAxis(
                cc, axisId, location, categories, axisLabel, axesLabelFont, axisTickStyle,
                plotDimensions, margin, setAxisRangeFor, setOriginalAxisRangeFor
            )
    }
}

/**
 * NOTE ON FIDELITY: the original SVG version rotated tick labels using each label's own
 * `getBBox()` to compute a per-label rotation origin, which let long labels pivot around their own
 * visual center/corner. Canvas `measureText` has no bbox-offset equivalent, so this version rotates
 * every label about its anchor point at the tick instead. At `rotation: 0` (the common case) this
 * produces the same centered layout as before; at non-zero rotations the labels will be close but
 * not pixel-identical to the old SVG output -- worth a visual check if you use tick rotation.
 */
function createOrdinalStringXAxis(
    cc: CanvasContext,
    axisId: string,
    location: typeof AxisLocation.Bottom | typeof AxisLocation.Top,
    categories: Array<string>,
    axisLabel: string,
    axesLabelFont: AxesFont,
    axisTickStyle: AxisTickStyle,
    plotDimensions: Dimensions,
    margin: Margin,
    setAxisRangeFor: (axisId: string, range: AxisInterval) => void,
    setOriginalAxisRangeFor: (axisId: string, range: AxisInterval) => void,
): CanvasOrdinalStringAxis {
    const scale = d3.scaleBand<string>().domain(categories).range([0, plotDimensions.width])

    let currentDimensions = plotDimensions
    let currentMargin = margin
    let currentFont = axesLabelFont
    const currentTickStyle = axisTickStyle

    const drawHandle: DrawHandle = `x-axis-ordinal-${cc.chartId}-${axisId}`

    const draw = (context: CanvasContext) => {
        const {context2D} = context
        context2D.save()
        context2D.translate(currentMargin.left, yTranslation(location, currentDimensions, currentMargin))

        context2D.save()
        clipToArea(context, {width: currentDimensions.width, height: currentMargin.bottom}, {x: 0, y: location === AxisLocation.Bottom ? -1 : -currentMargin.top})

        context2D.strokeStyle = currentFont.color
        context2D.fillStyle = currentFont.color
        context2D.lineWidth = 1
        context2D.font = fontStringFor(currentTickStyle.font.size, currentTickStyle.font.family, currentTickStyle.font.weight)
        context2D.textBaseline = 'middle'

        // domain line
        context2D.beginPath()
        context2D.moveTo(0, 0)
        context2D.lineTo(currentDimensions.width, 0)
        context2D.stroke()

        const tickDirection = location === AxisLocation.Bottom ? 1 : -1
        const degrees = location === AxisLocation.Bottom ? -currentTickStyle.rotation : currentTickStyle.rotation
        const radians = degrees * Math.PI / 180

        categories.forEach(category => {
            const x = (scale(category) ?? 0) + scale.bandwidth() / 2
            context2D.beginPath()
            context2D.moveTo(x, 0)
            context2D.lineTo(x, TICK_SIZE * tickDirection)
            context2D.stroke()

            context2D.save()
            context2D.translate(x, (TICK_SIZE + TICK_PADDING) * tickDirection)
            context2D.rotate(radians)
            context2D.textAlign = radians === 0 ? 'center' : 'end'
            context2D.fillText(category, 0, 0)
            context2D.restore()
        })

        context2D.restore() // pop the clip

        // axis label (absolute position, not clipped, matches the old behavior)
        context2D.fillStyle = currentFont.color
        context2D.font = fontStringFor(currentFont.size, currentFont.family, currentFont.weight)
        context2D.textAlign = 'center'
        context2D.textBaseline = location === AxisLocation.Top ? 'hanging' : 'alphabetic'
        const labelX = ordinalLabelXTranslation(location, currentDimensions, currentMargin, currentFont) - currentMargin.left
        const labelY = ordinalLabelYTranslation(location, currentDimensions, currentMargin) - yTranslation(location, currentDimensions, currentMargin)
        context2D.fillText(axisLabel, labelX, labelY)

        context2D.restore()
    }

    cc.register(drawHandle, draw, 0)

    const categorySize = () => scale.bandwidth()

    return {
        axisId,
        location,
        scale,
        categorySize: categorySize(),
        update: (range, _originalRange, plotDimensions, margin) => {
            const updatedRange = AxisInterval.from(
                Math.min(range.start, 0),
                Math.max(range.end, plotDimensions.width)
            )
            scale.domain(categories).range(updatedRange.asTuple())
            currentDimensions = plotDimensions
            currentMargin = margin
            setAxisRangeFor(axisId, range)
            setOriginalAxisRangeFor(axisId, _originalRange)
            cc.requestRedraw()
            return categorySize()
        },
        updateFont: (font) => {
            // matches the original SVG version: only the axis *label's* fill was ever updated
            // dynamically (via svg.select('#label').attr('fill', color)); tick color stays fixed
            // at whatever axisTickStyle.font was set to at creation
            currentFont = font
            cc.requestRedraw()
        }
    }
}

function createOrdinalStringYAxis(
    cc: CanvasContext,
    axisId: string,
    location: typeof AxisLocation.Left | typeof AxisLocation.Right,
    categories: Array<string>,
    axisLabel: string,
    axesLabelFont: AxesFont,
    axisTickStyle: AxisTickStyle,
    plotDimensions: Dimensions,
    margin: Margin,
    setAxisRangeFor: (axisId: string, range: AxisInterval) => void,
    setOriginalAxisRangeFor: (axisId: string, range: AxisInterval) => void,
): CanvasOrdinalStringAxis {
    const scale = d3.scaleBand<string>().domain(categories).range([0, plotDimensions.height])

    let currentDimensions = plotDimensions
    let currentMargin = margin
    let currentFont = axesLabelFont
    const currentTickStyle = axisTickStyle

    const drawHandle: DrawHandle = `y-axis-ordinal-${cc.chartId}-${axisId}`

    const draw = (context: CanvasContext) => {
        const {context2D} = context
        context2D.save()
        context2D.translate(xTranslation(location, currentDimensions, currentMargin), currentMargin.top)

        context2D.save()
        const clipWidth = location === AxisLocation.Left ? currentMargin.left : currentMargin.right
        clipToArea(context, {width: clipWidth, height: currentDimensions.height}, {x: location === AxisLocation.Left ? -clipWidth : 0, y: 0})

        context2D.strokeStyle = currentFont.color
        context2D.fillStyle = currentFont.color
        context2D.lineWidth = 1
        context2D.font = fontStringFor(currentTickStyle.font.size, currentTickStyle.font.family, currentTickStyle.font.weight)
        // matches the old SVG version, which forced text-anchor "end" for ordinal ticks
        // regardless of Left/Right location
        context2D.textAlign = 'end' as CanvasTextAlign
        context2D.textBaseline = 'middle'

        // domain line
        context2D.beginPath()
        context2D.moveTo(0, 0)
        context2D.lineTo(0, currentDimensions.height)
        context2D.stroke()

        const degrees = location === AxisLocation.Left ? -currentTickStyle.rotation : currentTickStyle.rotation
        const radians = degrees * Math.PI / 180
        const xTick = location === AxisLocation.Left ? 0 : scale.bandwidth() // mirrors the old xTranslation offset

        categories.forEach(category => {
            const y = (scale(category) ?? 0) + scale.bandwidth() / 2
            const tickDirection = location === AxisLocation.Left ? -1 : 1
            context2D.beginPath()
            context2D.moveTo(0, y)
            context2D.lineTo(TICK_SIZE * tickDirection, y)
            context2D.stroke()

            context2D.save()
            context2D.translate(xTick, y)
            context2D.rotate(radians)
            context2D.fillText(category, 0, 0)
            context2D.restore()
        })

        context2D.restore() // pop the clip

        // axis label, rotated -90deg, matching the old SVG version
        context2D.save()
        const labelX = ordinalLabelXTranslation(location, currentDimensions, currentMargin, currentFont) - xTranslation(location, currentDimensions, currentMargin)
        const labelY = ordinalLabelYTranslation(location, currentDimensions, currentMargin) - currentMargin.top
        context2D.translate(labelX, labelY)
        context2D.rotate(-Math.PI / 2)
        context2D.fillStyle = currentFont.color
        context2D.font = fontStringFor(currentFont.size, currentFont.family, currentFont.weight)
        context2D.textAlign = 'center'
        context2D.textBaseline = 'alphabetic'
        context2D.fillText(axisLabel, 0, 0)
        context2D.restore()

        context2D.restore()
    }

    cc.register(drawHandle, draw, 0)

    const categorySize = () => scale.bandwidth()

    return {
        axisId,
        location,
        scale,
        categorySize: categorySize(),
        update: (range, originalRange, plotDimensions, margin) => {
            const updatedRange = AxisInterval.from(
                Math.min(range.start, 0),
                Math.max(range.end, plotDimensions.height)
            )
            scale.domain(categories).range(updatedRange.asTuple())
            currentDimensions = plotDimensions
            currentMargin = margin
            setAxisRangeFor(axisId, range)
            setOriginalAxisRangeFor(axisId, originalRange)
            cc.requestRedraw()
            return categorySize()
        },
        updateFont: (font) => {
            // matches the original SVG version: only the axis *label's* fill was ever updated
            // dynamically; tick color stays fixed at whatever axisTickStyle.font was at creation
            currentFont = font
            cc.requestRedraw()
        }
    }
}

export function removeOrdinalXAxis(cc: CanvasContext, axisId: string): void {
    cc.unregister(`x-axis-ordinal-${cc.chartId}-${axisId}`)
}

export function removeOrdinalYAxis(cc: CanvasContext, axisId: string): void {
    cc.unregister(`y-axis-ordinal-${cc.chartId}-${axisId}`)
}

/**
 * Removes an axis' draw function from the canvas context (call on unmount to avoid leaking a
 * draw registration for an axis that's no longer part of the chart).
 */
export function removeContinuousXAxis(cc: CanvasContext, axisId: string): void {
    cc.unregister(`x-axis-${cc.chartId}-${axisId}`)
}

export function removeContinuousYAxis(cc: CanvasContext, axisId: string): void {
    cc.unregister(`y-axis-${cc.chartId}-${axisId}`)
}

function ordinalLabelXTranslation(
    location: AxisLocation,
    plotDimensions: Dimensions,
    margin: Margin,
    axesLabelFont: AxesFont,
): number {
    switch (location) {
        case AxisLocation.Left:
        case AxisLocation.Right:
            return location === AxisLocation.Left ?
                axesLabelFont.size :
                margin.left + plotDimensions.width + margin.right - axesLabelFont.size
        case AxisLocation.Top:
        case AxisLocation.Bottom:
            return (plotDimensions.width + margin.left + margin.right) / 2
    }
}

function ordinalLabelYTranslation(
    location: AxisLocation,
    plotDimensions: Dimensions,
    margin: Margin
): number {
    switch (location) {
        case AxisLocation.Left:
        case AxisLocation.Right:
            return (margin.top + margin.bottom + plotDimensions.height) / 2
        case AxisLocation.Top:
            return 0
        case AxisLocation.Bottom:
            return margin.top + margin.bottom + plotDimensions.height
    }
}

/*
    common translation helpers (unchanged math from axes.ts, just moved here alongside their
    canvas-drawing call-sites)
 */

function xTranslation(location: typeof AxisLocation.Left | typeof AxisLocation.Right, plotDimensions: Dimensions, margin: Margin): number {
    return location === AxisLocation.Left ? margin.left : margin.left + plotDimensions.width
}

function yTranslation(location: typeof AxisLocation.Bottom | typeof AxisLocation.Top, plotDimensions: Dimensions, margin: Margin): number {
    return location === AxisLocation.Bottom ?
        plotDimensions.height + margin.top :
        margin.top
}

function continuousLabelYTranslation(location: typeof AxisLocation.Bottom | typeof AxisLocation.Top, plotDimensions: Dimensions, margin: Margin): number {
    return location === AxisLocation.Bottom ? plotDimensions.height + margin.top + margin.bottom : 0
}

function continuousLabelXTranslation(location: typeof AxisLocation.Left | typeof AxisLocation.Right, plotDimensions: Dimensions, margin: Margin, axesLabelFont: AxesFont): number {
    return location === AxisLocation.Left ?
        axesLabelFont.size :
        margin.left + plotDimensions.width + margin.right - axesLabelFont.size
}

// re-export so callers of this module don't also need to import d3 just to build a default scale
export const scaleLinear = d3.scaleLinear
