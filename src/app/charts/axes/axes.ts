import type {Dimensions, Margin} from "../styling/margins";
import {ContinuousAxisRange} from "./ContinuousAxisRange";
import * as d3 from "d3";
import {type ScaleBand, type ScaleContinuousNumeric, type ScaleLinear, ZoomTransform} from "d3";
import type {CanvasContext, DrawHandle} from "../d3types";
import {AxesState} from "./AxesState";
import type {AxesAssignment} from "../plots/plot";
import {clipToArea} from "../plots/plot";
import type {BaseSeries} from "../series/baseSeries";
import {fontStringFor} from "../utils";
import {OrdinalAxisRange} from "./OrdinalAxisRange";
import {BaseAxisRange} from "./BaseAxisRange";
import {AxisInterval} from "./AxisInterval";

/** Default tick length, in pixels, matching d3-axis's default `tickSize`. */
const TICK_SIZE = 6
/** Default gap between the end of a tick and its label, matching d3-axis's default `tickPadding`. */
const TICK_PADDING = 3

/**
 * Holds the style for the axis tick labels
 */
export type AxisTickStyle = {
    font: AxesFont
    // the rotation of the tick labels in degrees
    rotation: number
    // whether to automatically rotate tick labels to fit within the axis space
    useAutoRotation: boolean
}

/**
 * Factory function to create a default AxisTickStyle with the default font,
 * no rotation, and no autorotation.
 */
export function defaultAxisTickStyle(): AxisTickStyle {
    return {
        font: defaultAxesFont(),
        rotation: 0,
        useAutoRotation: false
    }
}

/**
 * Holds the font information for the axis labels
 */
export interface AxesFont {
    size: number
    color: string
    family: string
    weight: number
}

/**
 * Factory function to create a default AxesFont with the default font size, color,
 * family, and weight.
 */
export function defaultAxesFont(): AxesFont {
    return {
        size: 12,
        color: '#d2933f',
        weight: 300,
        family: 'sans-serif'
    }
}

/**
 * Holds the style information for a series in a chart
 */
export interface SeriesStyle {
    color: string
    highlightColor: string
    margin?: number
}

/**
 * Holds the style information for a series line-style in a chart.
 */
export interface SeriesLineStyle extends SeriesStyle {
    lineWidth: number
    highlightWidth: number
}

/**
 * Factory function to create a default SeriesLineStyle with the default color, line width,
 * highlight color, and highlight width.
 */
export function defaultLineStyle(): SeriesLineStyle {
    return {
        color: '#008aad',
        lineWidth: 1,
        highlightColor: '#008aad',
        highlightWidth: 3,
    }
}

/**
 * The base interface that all Axes must implement. Each axis must have a unique ID and a location
 * (top, bottom, left, right). Under the old SVG-backed implementation this also carried a
 * `selection`; that's gone now that axes draw onto a shared canvas instead of owning their own DOM
 * elements.
 */
export interface BaseAxis {
    axisId: string
    location: AxisLocation
    /**
     * True for a placeholder axis added via {@link addEmptyXAxis}/{@link addEmptyYAxis} (just a
     * line, with no real data domain behind it). Consumers that report a value for the mouse
     * position -- e.g., the tracker's axis labels -- should skip axes marked this way, since their
     * scale doesn't reflect anything meaningful.
     */
    isEmpty?: boolean
}

/**
 * Represents a continuous numeric axis. Draws itself by registering a draw function with the
 * chart's {@link CanvasContext} (see `create*`, below) rather than owning an SVG element.
 */
export interface ContinuousNumericAxis extends BaseAxis {
    /**
     * A d3 scale for a continuous numeric axis.
     */
    scale: ScaleContinuousNumeric<number, number>
    /**
     * Updates the axis based on the specified domain and plot dimensions and requests the plot
     * to be redrawn.
     * @param domain The interval representing the domain of the axis.
     * @param plotDimensions The dimensions of the plot (without the margins).
     * @param margin The margins for the plot
     */
    update: (domain: AxisInterval, plotDimensions: Dimensions, margin: Margin) => void
    /**
     * Updates the font (color, size, family, weight) used for ticks and the axis label, without
     * recreating the axis or touching its domain. Used to keep the label color in sync with the
     * chart's `color` prop (e.g., on a theme change) between full axis updates.
     */
    updateFont: (font: AxesFont) => void
    /**
     * Highlights (or un-highlights) this axis -- used, for example, to indicate which axis a
     * currently-hovered series is plotted against. When `highlighted` is true, the axis' domain
     * line, ticks, and labels are drawn in `color` at `lineWidth` instead of the normal font color
     * and 1px line; `color`/`lineWidth` are remembered across calls, so a later `setHighlighted(true)`
     * without them reuses whatever was last passed (or the built-in default on the first call).
     * @param highlighted Whether the axis should be drawn highlighted
     * @param color The highlight color
     * @param lineWidth The highlight line width
     */
    setHighlighted: (highlighted: boolean, color?: string, lineWidth?: number) => void
}

/**
 * Represents an ordinal string axis. Draws itself by registering a draw function with the chart's
 * {@link CanvasContext} rather than owning an SVG element.
 */
export interface OrdinalStringAxis extends BaseAxis {
    /**
     * A d3 scale for an ordinal string axis.
     */
    scale: ScaleBand<string>
    /**
     * The size of each category on the axis.
     */
    categorySize: number
    /**
     * Updates the axis based on the specified range and plot dimensions and requests the plot to be redrawn.
     * @param range An interval representing the range of the axis.
     * @param originalRange An interval representing the original range of the axis (before zooming or panning).
     * @param plotDimensions The dimensions of the plot (without the margins).
     * @param margin The margins for the plot
     * @return The number of pixels for each category on the axis.
     */
    update: (range: AxisInterval, originalRange: AxisInterval, plotDimensions: Dimensions, margin: Margin) => number
    /**
     * Updates the font used for the axis label without recreating the axis. Tick label color is
     * intentionally not touched by this -- it stays fixed at whatever the tick style's font was
     * set to when the axis was created.
     */
    updateFont: (font: AxesFont) => void
}

/**
 * The possible locations of an axis.
 * Note: replaces enums to support `erasableSyntaxOnly`
 *  TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
 */
export const AxisLocation = {
    // y-axes
    Left : "Left",
    Right: "Right",
    // x-axes
    Bottom: "Bottom",
    Top: "Top"
} as const

export type AxisLocation = (typeof AxisLocation)[keyof typeof AxisLocation];

/*
        category (ordinal) axes
 */

/**
 * Adds a category axis to the specified location, registering its draw function with the canvas
 * context. When the location is top or bottom, the category axis represents the x-axis; when the
 * location is left or right, it represents the y-axis.
 * @param cc The canvas context to register the axis' draw function with
 * @param axisId A unique ID for the axis
 * @param location The location of the axis
 * @param categories The category names (fixed for the lifetime of this axis -- changing categories
 * requires recreating the axis)
 * @param axisLabel The axis label
 * @param axesLabelFont The font for the axis label
 * @param axisTickStyle Styling information for the ticks (font, rotation, etc.)
 * @param plotDimensions The dimensions of the plot
 * @param margin The plot margin
 * @param setAxisRangeFor Callback that sets the axis range for the specified axis
 * @param setOriginalAxisRangeFor Callback that sets the original axis range for the specified axis
 * @return An {@link OrdinalStringAxis}
 */
export function addOrdinalStringAxis(
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
): OrdinalStringAxis {
    switch (location) {
        case AxisLocation.Top:
        case AxisLocation.Bottom:
            return addOrdinalStringXAxis(
                cc, axisId, location, categories, axisLabel, axesLabelFont, axisTickStyle,
                plotDimensions, margin, setAxisRangeFor, setOriginalAxisRangeFor
            )
        case AxisLocation.Left:
        case AxisLocation.Right:
            return addOrdinalStringYAxis(
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
function addOrdinalStringXAxis(
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
): OrdinalStringAxis {
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
        update: (range, originalRange, plotDimensions, margin) => {
            const updatedRange = AxisInterval.from(
                Math.min(range.start, 0),
                Math.max(range.end, plotDimensions.width)
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
            // dynamically (via svg.select('#label').attr('fill', color)); tick color stays fixed
            // at whatever axisTickStyle.font was set to at creation
            currentFont = font
            cc.requestRedraw()
        }
    }
}

function addOrdinalStringYAxis(
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
): OrdinalStringAxis {
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
        // the boundary that abuts the domain line (x=0) is nudged 1px past it (into the plot side),
        // so the line's 1px-wide stroke -- centered on x=0, spanning -0.5 to +0.5 -- isn't clipped
        // in half; mirrors the same -1 fudge used for the bottom x-axis's domain line
        clipToArea(context, {width: clipWidth, height: currentDimensions.height}, {x: location === AxisLocation.Left ? -clipWidth + 1 : -1, y: 0})

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
        const tickDirection = location === AxisLocation.Left ? -1 : 1
        // offset the label past the tick mark plus a little padding, rather than flush against
        // the axis line -- this was previously just `0` (Left) / `scale.bandwidth()` (Right),
        // which put the label's text-anchor edge right on top of the axis line with no gap
        const xTick = (TICK_SIZE + TICK_PADDING) * tickDirection

        categories.forEach(category => {
            const y = (scale(category) ?? 0) + scale.bandwidth() / 2
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
    continuous numeric axes
 */

/**
 * Adds a new, empty x-axis (a line with no ticks or label) to the canvas context. An empty axis
 * is just a line where the axis would be, without any ticks or labels.
 * @param canvasContext The canvas context to register the axis' draw function with
 * @param axisId The ID of the axis
 * @param plotDimensions The dimensions of the plot
 * @param location The location of the axis
 * @param scaleGenerator The d3 scale to use for the axis
 * @param margin The plot margins for the border of main SVG group
 * @param setAxisRangeFor A callback used to set the axis range
 * @param color The color of the axis line
 * @param domain The axis range (start, end)
 * @return A {@link ContinuousNumericAxis} based on the arguments to this function
 */
export function addEmptyXAxis(
    canvasContext: CanvasContext,
    axisId: string,
    plotDimensions: Dimensions,
    location: typeof AxisLocation.Bottom | typeof AxisLocation.Top,
    scaleGenerator: ScaleContinuousNumeric<number, number>,
    margin: Margin,
    setAxisRangeFor: (axisId: string, timeRange: AxisInterval) => void,
    color: string,
    domain: [minValue: number, maxValue: number] = [0, 1],
): ContinuousNumericAxis {
    const scale = scaleGenerator.domain(domain).range([0, plotDimensions.width])

    let currentDimensions = plotDimensions
    let currentMargin = margin
    // NOTE: previously this read `ctx.fillStyle` directly, assuming it reflected "the chart's
    // current color". But `ctx` is shared across every draw function registered on the canvas
    // (all axes, all plots, the tracker). Whichever one last set `fillStyle` before this one
    // ran left that value behind. It had nothing to do with this axis' actual color and never
    // updated when the chart's `color`/theme changed, since nothing here ever assigned a new
    // value in response to that. The `currentColor` is now explicit, passed in and refreshable via
    // `updateFont` below.
    let currentColor = color
    let highlighted = false
    let highlightColor = defaultLineStyle().highlightColor
    let highlightLineWidth = defaultLineStyle().highlightWidth

    const drawHandle: DrawHandle = `x-axis-empty-${canvasContext.chartId}-${axisId}`

    const draw = (context: CanvasContext) => {
        const {context2D} = context
        context2D.save()
        context2D.translate(currentMargin.left, yTranslation(location, currentDimensions, currentMargin))
        context2D.strokeStyle = highlighted ? highlightColor : currentColor
        context2D.lineWidth = highlighted ? highlightLineWidth : 1
        context2D.beginPath()
        context2D.moveTo(0, 0)
        context2D.lineTo(currentDimensions.width, 0)
        context2D.stroke()
        context2D.restore()
    }

    canvasContext.register(drawHandle, draw, 0)

    return {
        axisId,
        location,
        isEmpty: true,
        scale,
        update: (domain, plotDimensions, margin) => {
            scale.domain(domain.asTuple()).range([0, plotDimensions.width])
            currentDimensions = plotDimensions
            currentMargin = margin
            setAxisRangeFor(axisId, domain)
            canvasContext.requestRedraw()
        },
        // an empty axis has no ticks or label text but does have a colored line -- reuse
        // updateFont's color field to keep that line in sync with the chart's color (e.g., on a
        // theme change), matching the pattern used by the other axis types
        updateFont: (font) => {
            currentColor = font.color
            canvasContext.requestRedraw()
        },
        setHighlighted: (isHighlighted, color, lineWidth) => {
            highlighted = isHighlighted
            if (color !== undefined) highlightColor = color
            if (lineWidth !== undefined) highlightLineWidth = lineWidth
            canvasContext.requestRedraw()
        }
    }
}

/**
 * Adds a new, empty y-axis (a line with no ticks or label) to the canvas context.
 * @param cc The canvas context to register the axis' draw function with
 * @param axisId The ID of the axis
 * @param plotDimensions The dimensions of the plot
 * @param location The location of the axis
 * @param scaleGenerator The d3 scale to use for the axis
 * @param margin The plot margins for the border of main SVG group
 * @param setAxisRangeFor A callback used to set the axis range
 * @param color The color of the axis line
 * @param domain The axis range (start, end)
 * @return A {@link ContinuousNumericAxis} based on the arguments to this function
 */
export function addEmptyYAxis(
    cc: CanvasContext,
    axisId: string,
    plotDimensions: Dimensions,
    location: typeof AxisLocation.Left | typeof AxisLocation.Right,
    scaleGenerator: ScaleContinuousNumeric<number, number>,
    margin: Margin,
    setAxisRangeFor: (axisId: string, timeRange: AxisInterval) => void,
    color: string,
    domain: [minValue: number, maxValue: number] = [0, 1],
): ContinuousNumericAxis {
    const scale = scaleGenerator.domain(domain).range([plotDimensions.height, 0])

    let currentDimensions = plotDimensions
    let currentMargin = margin
    let currentColor = color
    let highlighted = false
    let highlightColor = defaultLineStyle().highlightColor
    let highlightLineWidth = defaultLineStyle().highlightWidth

    const drawHandle: DrawHandle = `y-axis-empty-${cc.chartId}-${axisId}`

    const draw = (context: CanvasContext) => {
        const {context2D} = context
        context2D.save()
        context2D.translate(xTranslation(location, currentDimensions, currentMargin), currentMargin.top)
        context2D.strokeStyle = highlighted ? highlightColor : currentColor
        context2D.lineWidth = highlighted ? highlightLineWidth : 1
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
        isEmpty: true,
        scale,
        update: (domain, plotDimensions, margin) => {
            scale.domain(domain.asTuple()).range([plotDimensions.height, 0])
            currentDimensions = plotDimensions
            currentMargin = margin
            setAxisRangeFor(axisId, domain)
            cc.requestRedraw()
        },
        // an empty axis has no ticks or label text but does have a colored line -- reuse
        // updateFont's color field to keep that line in sync with the chart's color (e.g., on a
        // theme change), matching the pattern used by the other axis types
        updateFont: (font) => {
            currentColor = font.color
            cc.requestRedraw()
        },
        setHighlighted: (isHighlighted, color, lineWidth) => {
            highlighted = isHighlighted
            if (color !== undefined) highlightColor = color
            if (lineWidth !== undefined) highlightLineWidth = lineWidth
            cc.requestRedraw()
        }
    }
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
 * @return A {@link ContinuousNumericAxis}
 */
export function addContinuousNumericXAxis(
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
): ContinuousNumericAxis {
    const scale = scaleGenerator.domain(domain).range([0, plotDimensions.width])

    let currentDimensions = plotDimensions
    let currentMargin = margin
    const currentLabel = axisLabel
    let currentFont = axesLabelFont
    let highlighted = false
    let highlightColor = defaultLineStyle().highlightColor
    let highlightLineWidth = defaultLineStyle().highlightWidth

    const drawHandle: DrawHandle = `x-axis-${cc.chartId}-${axisId}`

    const draw = (context: CanvasContext) => {
        const {context2D} = context
        context2D.save()
        context2D.translate(currentMargin.left, yTranslation(location, currentDimensions, currentMargin))

        // NOTE: the original SVG version never applied a clip-path to the continuous numeric
        // axes (only the ordinal/category axes clip), which let the first/last tick labels
        // overflow into the margin without being cut off. Clipping to exactly the plot width
        // here would chop those end labels in half, so ticks/labels are intentionally unclipped.
        const axisColor = highlighted ? highlightColor : currentFont.color
        context2D.strokeStyle = axisColor
        context2D.fillStyle = axisColor
        context2D.lineWidth = highlighted ? highlightLineWidth : 1
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

        // axis label (not clipped, matches the old behavior)
        context2D.fillStyle = axisColor
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
        },
        setHighlighted: (isHighlighted, color, lineWidth) => {
            highlighted = isHighlighted
            if (color !== undefined) highlightColor = color
            if (lineWidth !== undefined) highlightLineWidth = lineWidth
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
 * @return A {@link ContinuousNumericAxis}
 */
export function addContinuousNumericYAxis(
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
): ContinuousNumericAxis {
    const scale = scaleGenerator
        .domain(domain)
        .range([Math.max(margin.bottom, plotDimensions.height), 0])

    let currentDimensions = plotDimensions
    let currentMargin = margin
    const currentLabel = axisLabel
    let currentFont = axesLabelFont
    let highlighted = false
    let highlightColor = defaultLineStyle().highlightColor
    let highlightLineWidth = defaultLineStyle().highlightWidth

    const drawHandle: DrawHandle = `y-axis-${cc.chartId}-${axisId}`

    const draw = (context: CanvasContext) => {
        const {context2D} = context
        context2D.save()
        context2D.translate(xTranslation(location, currentDimensions, currentMargin), currentMargin.top)

        // NOTE: unclipped, matching the old SVG version's continuous numeric axes (only the
        // ordinal/category axes clipped there) -- clipping to exactly the plot height would cut
        // off the top- and bottom-most tick labels, which straddle y=0 and y=height.
        const axisColor = highlighted ? highlightColor : currentFont.color
        context2D.strokeStyle = axisColor
        context2D.fillStyle = axisColor
        context2D.lineWidth = highlighted ? highlightLineWidth : 1
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

        // axis label, rotated -90deg, matching the old SVG version
        context2D.save()
        const labelX = continuousLabelXTranslation(location, currentDimensions, currentMargin, currentFont) - xTranslation(location, currentDimensions, currentMargin)
        context2D.translate(labelX, currentDimensions.height / 2)
        context2D.rotate(-Math.PI / 2)
        context2D.fillStyle = axisColor
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
        },
        setHighlighted: (isHighlighted, color, lineWidth) => {
            highlighted = isHighlighted
            if (color !== undefined) highlightColor = color
            if (lineWidth !== undefined) highlightLineWidth = lineWidth
            cc.requestRedraw()
        }
    }
}

/**
 * Removes an axis' draw function from the canvas context (called on "unmount" to avoid leaking a
 * draw registration for an axis that's no longer part of the chart).
 */
export function removeContinuousXAxis(cc: CanvasContext, axisId: string): void {
    cc.unregister(`x-axis-${cc.chartId}-${axisId}`)
}

export function removeContinuousYAxis(cc: CanvasContext, axisId: string): void {
    cc.unregister(`y-axis-${cc.chartId}-${axisId}`)
}

/*
    common axis functions
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

/*
    zooming
 */

/**
 * The result of a zoom action
 */
export interface ZoomResult<AR extends BaseAxisRange> {
    range: AR
    zoomFactor: number
}

/**
 * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
 * at the location of the mouse when the scroll wheel or gesture was applied, while ensuring that
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
): ZoomResult<ContinuousAxisRange> {
    // was: axis.generator.scale<ScaleLinear<number, number>>().invert(x) -- the old d3 axis
    // generator's underlying scale. Canvas axes expose `scale` directly, so we can invert it
    // without going through a generator.
    const domainValue = (axis.scale as ScaleLinear<number, number>).invert(x);
    return {
        range: range.constrainedScale(transform.k, domainValue, constraint),
        zoomFactor: transform.k
    } as ZoomResult<ContinuousAxisRange>
}

/**
 * Calculates the zoom for an ordinal axis.
 * @param transform The d3 zoom transformation information
 * @param x The x-position of the mouse when the scroll wheel or gesture is used
 * @param range The current range for the axis being zoomed
 * @param constraint The minimum and maximum value the scaled range can have
 * @return A ZoomResult holding the updated range and the new zoom factor
 */
export function calculateOrdinalConstrainedZoomFor(
    transform: ZoomTransform,
    x: number,
    range: OrdinalAxisRange,
    constraint: [min: number, max: number],
): ZoomResult<OrdinalAxisRange> {
    const updatedRange = range.constrainedScale(transform.k, x, constraint) as OrdinalAxisRange
    const k = range.original.equals(updatedRange.original)  ? 1 : transform.k
    return {
        range: updatedRange,
        zoomFactor: k
    } as ZoomResult<OrdinalAxisRange>
}

/*
    panning
 */

/**
 * Adjusts the range and updates the plot when the plot is dragged to the left or right
 * @param delta The amount that the plot is dragged
 * @param axis The axis being zoomed
 * @param range The current range for the axis being zoomed
 * @param [constrainToOriginalRange=false] When set to `true` then the pan requires that the axis
 * range remains a subset of the origin axis range; when `false` the pan allows and range
 * @return The updated range
 */
export function calculatePanFor(
    delta: number,
    axis: ContinuousNumericAxis,
    range: ContinuousAxisRange,
    constrainToOriginalRange: boolean = false
): ContinuousAxisRange {
    // was: axis.generator.scale<ScaleLinear<number, number>>() -- see note in
    // calculateConstrainedZoomFor above
    const scale = axis.scale as ScaleLinear<number, number>
    const value = scale(range.current.start)
    if (value !== undefined) {
        const deltaValue = scale.invert(value + delta) - range.current.start
        const constraint: [start: number, end: number] = constrainToOriginalRange ?
            range.original.asTuple() :
            [-Infinity, Infinity]
        return range.translate(-deltaValue, constraint)
    }
    return range
}

export function calculateOrdinalPanFor(
    delta: number,
    range: OrdinalAxisRange,
    plotDimensions: Dimensions,
    constrainToOriginalRange: boolean = false
): OrdinalAxisRange {
    const constraint: [start: number, end: number] = constrainToOriginalRange ?
        range.original.asTuple() :
        [-Infinity, Infinity]
    // only allow panning if the plot dimensions (i.e. [0, width]) is in the current axis range
    // todo deal with the fact that this could be a pan of the y-axis
    if (range.current.start + delta > 0 || range.current.end + delta < plotDimensions.width) {
        return range
    }
    return range.translate(delta, constraint) as OrdinalAxisRange
}

/**
 * Accepts the series, the assignment of the series to axes, and the current x-axes state, and
 * returns an array of the distinct axis IDs that cover all the series in the plot.
 *
 * @param series The array of series
 * @param axisAssignments A map association a series name with its axis assignments
 * @param axesState The current axis state
 * @return an array of the distinct axes that cover all the series in the plot
 */
export function axesForSeriesGen<D, A extends BaseAxis>(
    series: Array<BaseSeries<D>>,
    axisAssignments: Map<string, AxesAssignment>,
    axesState: AxesState<A>
): Array<string> {
    return series.map(srs => srs.name)
        // grab the x-axis assigned to the series or use the default x-axis if not
        // assignment has been made
        .map(name => axisAssignments.get(name)?.xAxis || axesState.axisDefaultId().getOrElse(""))
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
 * Pans the axis range by the specified amount.
 * @param delta The pan amount in the axis specified for the series
 * @param axesForSeries The names of the axes of a dimension (x or y)
 * @param axesState The state for the axes of a dimension
 * @param ranges The current ranges for the axes of a dimension
 * @param setAxisRange Function for setting the new time-range for a specific axis
 * @param plotDimensions The current plot dimensions (width, height)
 * @param margin The plot margin
 * @param [constrainToOriginalRange=true] Optional argument, that when set to `true`, constrains the
 * axis range to remain in the origin axis range; when `false` the axis range is unconstrained
 */
function panAxes(
    delta: number,
    axesForSeries: Array<string>,
    axesState: AxesState<ContinuousNumericAxis>,
    ranges: Map<string, ContinuousAxisRange>,
    setAxisRange: (axisId: string, axisRange: AxisInterval) => void,
    plotDimensions: Dimensions,
    margin: Margin,
    constrainToOriginalRange: boolean = true
): void {
    axesForSeries.forEach(axisId => {
        axesState.axisFor(axisId).ifPresent((axis) => {
            const currentRange = ranges.get(axisId)
            if (currentRange) {
                // calculate the change in the axis-range based on the pixel change from the drag event
                const range = calculatePanFor(delta, axis, currentRange, constrainToOriginalRange)

                // update the time-range for the axis
                ranges.set(axisId, range)

                setAxisRange(axisId, range.current)

                // update the axis' time-range
                axis.update(range.current.copy(), plotDimensions, margin)
            }
        })
    })
}

/**
 * Pans the axis range by the specified amount.
 * @param delta The pan amount in the axis specified for the series
 * @param axesForSeries The names of the axes of a dimension (x or y)
 * @param axesState The state for the axes of a dimension
 * @param ranges The current ranges for the axes of a dimension
 * @param setAxisRange Function for setting the new time-range for a specific axis
 * @param plotDimensions The current plot dimensions (width, height)
 * @param margin The plot margin
 * @param [constrainToOriginalRange=false] Optional argument, that when set to `true`, constrains the
 * axis range to remain in the origin axis range; when `false` the axis range is unconstrained
 */
function ordinalPanAxes(
    delta: number,
    axesForSeries: Array<string>,
    axesState: AxesState<OrdinalStringAxis>,
    ranges: Map<string, OrdinalAxisRange>,
    setAxisRange: (axisId: string, axisRange: AxisInterval) => void,
    plotDimensions: Dimensions,
    margin: Margin,
    constrainToOriginalRange: boolean = false
): void {
    axesForSeries.forEach(axisId => {
        axesState.axisFor(axisId).ifPresent(axis => {
            const currentRange = ranges.get(axisId)
            if (currentRange && axis) {
                // calculate the change in the axis-range based on the pixel change from the drag event
                const range = calculateOrdinalPanFor(delta, currentRange, plotDimensions, constrainToOriginalRange)

                // update the time-range for the axis
                ranges.set(axisId, range)

                setAxisRange(axisId, range.current)

                // update the axis' time-range
                axis.update(range.current, range.original, plotDimensions, margin)
            }
        })
    })
}

/**
 * Higher-order function that generates a handler for pan events, given the distinct series IDs that cover all
 * the axes in the chart, the margin, axis-range update function, and the current state of the x-axes. This
 * function returns a handler function. And this handler function adjusts the time-range when the plot is dragged
 * to the left or right. After calling the handler function, the plot needs to be updated as well, and this is
 * left for the caller.
 *
 * Please note that the function generated by this function has side effects -- it updates the axis ranges.
 *
 * @param axesForSeries The distinct axes that cover all the series
 * @param margin The plot margin
 * @param setAxisRangeFor Function for setting the new axis-range for a specific axis
 * @param axesState The current state of the x-axes or y-axes
 * @param [constrainToOriginalRange=false] Optional argument, that when set to `true`, constrains the
 * axis range to remain in the origin axis range; when `false` the axis range is unconstrained
 * @return A handler function for pan events
 */
export function panHandler(
    axesForSeries: Array<string>,
    margin: Margin,
    setAxisRangeFor: (axisId: string, axisRange: AxisInterval) => void,
    axesState: AxesState<ContinuousNumericAxis>,
    constrainToOriginalRange: boolean = false
): (
    x: number,
    plotDimensions: Dimensions,
    ranges: Map<string, ContinuousAxisRange>,
) => void {
    /**
     * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
     * @param delta The amount that the plot is dragged
     * @param plotDimensions The dimensions of the plot
     * @param ranges A map holding the axis ID and its associated time range
     */
    return (delta: number, plotDimensions: Dimensions, ranges: Map<string, ContinuousAxisRange>) => {
        // run through the axis IDs, adjust their domain, and update the time-range set for that axis
        panAxes(delta, axesForSeries, axesState, ranges, setAxisRangeFor, plotDimensions, margin, constrainToOriginalRange)
        // hey, don't forget to update the plot with the new time-ranges in the code calling this... :)
    }
}

/**
 * Higher-order function that generates a handler for pan events, given the distinct series IDs that cover all
 * the axes in the chart, the margin, axis-range update function, and the current state of the x-axes. This
 * function returns a handler function. And this handler function adjusts the time-range when the plot is dragged
 * to the left or right. After calling the handler function, the plot needs to be updated as well, and this is
 * left for the caller.
 *
 * Please note that the function generated by this function has side effects -- it updates the axes' ranges.
 *
 * @param axesForSeries The distinct axes that cover all the series
 * @param margin The plot margin
 * @param setAxisRangeFor Function for setting the new axis-range for a specific axis
 * @param axesState The current state of the x-axes or y-axes
 * @param [constrainToOriginalRange=false] Optional argument, that when set to `true`, constrains the
 * axis range to remain in the origin axis range; when `false` the axis range is unconstrained
 * @return A handler function for pan events
 */
export function ordinalPanHandler(
    axesForSeries: Array<string>,
    margin: Margin,
    setAxisRangeFor: (axisId: string, axisRange: AxisInterval) => void,
    axesState: AxesState<OrdinalStringAxis>,
    constrainToOriginalRange: boolean = false
): (
    x: number,
    plotDimensions: Dimensions,
    series: Array<string>,
    ranges: Map<string, OrdinalAxisRange>,
) => void {
    /**
     * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
     * @param delta The amount that the plot is dragged
     * @param plotDimensions The dimensions of the plot
     * @param _series An array of series names
     * @param ranges A map holding the axis ID and its associated time range
     */
    return (delta: number, plotDimensions: Dimensions, _series: Array<string>, ranges: Map<string, OrdinalAxisRange>) => {
        // run through the axis IDs, adjust their domain, and update the time-range set for that axis
        ordinalPanAxes(delta, axesForSeries, axesState, ranges, setAxisRangeFor, plotDimensions, margin, constrainToOriginalRange)
        // hey, don't forget to update the plot with the new ranges in the code calling this... :)
    }
}

/**
 * Higher-order function that generates a handler for pan events, given the distinct series IDs that cover all
 * the axes in the chart, the margin, time-range update function, and the current state of the x-axes. This
 * function returns a handler function. And this handler function adjusts the time-range when the plot is dragged
 * to the left or right. After calling the handler function, the plot needs to be updated as well, and this is
 * left for the caller.
 *
 * Please note that the function generated by this function has side effects -- it updates the axes' ranges.
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
    setAxisRange: (axisId: string, axisRange: AxisInterval) => void,
    xAxesState: AxesState<ContinuousNumericAxis>,
    yAxesState: AxesState<ContinuousNumericAxis>,
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
     * Adjusts the time-range and updates the plot when the plot is dragged to the left or right
     * @param deltaX The amount that the plot is dragged in x
     * @param deltaY The amount that the plot is dragged in y
     * @param plotDimensions The dimensions of the plot
     * @param _series An array of series names
     * @param xRanges A map holding the x-axis ID and its associated time range
     * @param yRanges A map holding the y-axis ID and its associated time range
     */
    return (deltaX, deltaY, plotDimensions, _series, xRanges, yRanges) => {
        // run through the x- and y-axes and update them by delta, within the original bounds
        panAxes(deltaX, xAxesForSeries, xAxesState, xRanges, setAxisRange, plotDimensions, margin, constrainToOriginalRange)
        panAxes(deltaY, yAxesForSeries, yAxesState, yRanges, setAxisRange, plotDimensions, margin, constrainToOriginalRange)
        // hey, don't forget to update the plot with the new time-ranges in the code calling this... :)
    }
}

/**
 * Calculates the zoom for the specified axis and updates the axis and the axis ranges
 * @param value The x- or y-coordinate of the mouse
 * @param axisId The id of the axis to zoom
 * @param margin The plot margin
 * @param setRangeFor Function for setting the new time-range for a specific axis
 * @param axesState The current state of the x- or y-axes
 * @param ranges A map associating axis IDs with axis ranges
 * @param scaleExtent The smallest and largest scale factors allowed
 * @param transform The d3 zoom transformation information
 * @param plotDimensions The dimensions of the plot
 */
function calcZoomAndUpdate(
    value: number,
    axisId: string,
    margin: Margin,
    setRangeFor: (axisId: string, range: AxisInterval) => void,
    axesState: AxesState<ContinuousNumericAxis>,
    ranges: Map<string, ContinuousAxisRange>,
    scaleExtent: [min: number, max: number],
    transform: ZoomTransform,
    plotDimensions: Dimensions,
): void {
    const [, zoomMax] = scaleExtent

    axesState.axisFor(axisId).ifPresent(axis => {
        const range = ranges.get(axisId)
        if (range && axis) {

            // calculate the constraint for the zoom
            const constraint: [number, number] = isFinite(zoomMax) ?
                [range.original.start * zoomMax, range.original.end * zoomMax] :
                [0, Infinity]

            const zoom = calculateConstrainedZoomFor(transform, value, axis, range, constraint)

            // update the axis range
            ranges.set(axisId, zoom.range)

            setRangeFor(axisId, zoom.range.current)

            // update the axis' range
            axis.update(zoom.range.current, plotDimensions, margin)
        }
    })
}

function calcOrdinalZoomAndUpdate(
    value: number,
    axisId: string,
    margin: Margin,
    setRangeFor: (axisId: string, range: AxisInterval) => void,
    setOriginalRangeFor: (axisId: string, range: AxisInterval) => void,
    axesState: AxesState<OrdinalStringAxis>,
    ranges: Map<string, OrdinalAxisRange>,
    scaleExtent: [min: number, max: number],
    transform: ZoomTransform,
    plotDimensions: Dimensions,
): void {
    const [, zoomMax] = scaleExtent

    axesState.axisFor(axisId).ifPresent(axis => {
        const range = ranges.get(axisId)
        if (range && axis) {
            // calculate the constraint for the zoom
            const constraint: [number, number] = isFinite(zoomMax) ?
                [range.original.start * zoomMax, range.original.end * zoomMax] :
                [range.original.start, range.original.end]

            const zoom = calculateOrdinalConstrainedZoomFor(transform, value, range, constraint)

            // update the axis range
            ranges.set(axisId, zoom.range)

            setRangeFor(axisId, zoom.range.current)
            const origRange = AxisInterval.from(0, plotDimensions.width)
            setOriginalRangeFor(axisId, origRange)

            // update the axis' range
            axis.update(zoom.range.current, origRange, plotDimensions, margin)
        }
    })
}

/**
 * Higher-order function that generates a handler for zoom events, given the distinct series IDs that cover all
 * the axes in the chart, the margin, range update function, and the current state of the x- or y-axes. This
 * function returns a handler function. And this handler function adjusts the range when the plot is zoomed.
 * After calling the handler function, the plot needs to be updated as well, and this is left for the caller.
 *
 * Please note that the function generated by this function has side effects -- it updates the axes' ranges.
 *
 * @param axesForSeries The distinct axes that cover all the series
 * @param margin The plot margin
 * @param setRangeFor Function for setting the new time-range for a specific axis
 * @param axesState The current state of the x- or y-axes
 * @param scaleExtent The minimum and maximum allowed scale factors
 * @return A handler function for pan events
 */
export function continuousAxisZoomHandler(
    axesForSeries: Array<string>,
    margin: Margin,
    setRangeFor: (axisId: string, range: AxisInterval) => void,
    axesState: AxesState<ContinuousNumericAxis>,
    scaleExtent: [min: number, max: number] = [0, Infinity],
): (
    transform: ZoomTransform,
    x: number,
    plotDimensions: Dimensions,
    ranges: Map<string, ContinuousAxisRange>,
) => void {

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
        axesForSeries.forEach(axisId =>
            calcZoomAndUpdate(x, axisId, margin, setRangeFor, axesState, ranges, scaleExtent, transform, plotDimensions)
        )
        // hey, don't forget to update the plot with the new time-ranges in the code calling this... :)
    }
}

/**
 * Higher-order function that generates a handler for zoom events, given the distinct series IDs that cover all
 * the axes in the chart, the margin, range update function, and the current state of the x- or y-axes. This
 * function returns a handler function. And this handler function adjusts the range when the plot is zoomed.
 * After calling the handler function, the plot needs to be updated as well, and this is left for the caller.
 *
 * Please note that the function generated by this function has side effects -- it updates the axes' ranges.
 *
 * @param axesForSeries The distinct axes that cover all the series
 * @param margin The plot margin
 * @param setRangeFor Function for setting the new time-range for a specific axis
 * @param setOriginalRangeFor Function for setting the new original range for a specific axis
 * @param axesState The current state of the x- or y-axes
 * @param scaleExtent The minimum and maximum allowed scale factors
 * @return A handler function for pan events
 */
export function ordinalAxisZoomHandler(
    axesForSeries: Array<string>,
    margin: Margin,
    setRangeFor: (axisId: string, range: AxisInterval) => void,
    setOriginalRangeFor: (axisId: string, range: AxisInterval) => void,
    axesState: AxesState<OrdinalStringAxis>,
    scaleExtent: [min: number, max: number] = [0, Infinity],
): (
    transform: ZoomTransform,
    x: number,
    plotDimensions: Dimensions,
    ranges: Map<string, OrdinalAxisRange>,
) => void {

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
        axesForSeries.forEach(axisId =>
            calcOrdinalZoomAndUpdate(x, axisId, margin, setRangeFor, setOriginalRangeFor, axesState, ranges, scaleExtent, transform, plotDimensions)
        )
        // hey, don't forget to update the plot with the new time-ranges in the code calling this... :)
    }
}

/**
 * Higher-order function that generates a handler for zoom events, given the distinct series IDs that cover all
 * the axes in the chart, the margin, range update function, and the current state of the x- or y-axes. This
 * function returns a handler function. And this handler function adjusts the time-range when the plot is zoomed.
 * After calling the handler function, the plot needs to be updated as well, and this is left for the caller.
 *
 * Please note that the function generated by this function has side effects -- it updates the axes' ranges.
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
    setRangeFor: (axisId: string, range: AxisInterval) => void,
    xAxesState: AxesState<ContinuousNumericAxis>,
    yAxesState: AxesState<ContinuousNumericAxis>,
    scaleExtent: [min: number, max: number],
): (
    transform: ZoomTransform,
    mousePosition: [x: number, y: number],
    plotDimensions: Dimensions,
    xRanges: Map<string, ContinuousAxisRange>,
    yRanges: Map<string, ContinuousAxisRange>,
) => void {

    /**
     * Called when the user uses the scroll wheel (or scroll gesture) to zoom in or out. Zooms in/out
     * at the location of the mouse when the scroll wheel or gesture was applied.
     * @param transform The d3 zoom transformation information
     * @param mousePosition The position of the mouse when the scroll wheel or gesture is used
     * @param plotDimensions The dimensions of the plot
     * @param xRanges A map holding the x-axis ID and its associated time-range
     * @param yRanges A map holding the y-axis ID and its associated time-range
     */
    return (transform, mousePosition, plotDimensions, xRanges, yRanges) => {
        // run through the axis IDs, adjust their domain, and update the time-range set for that axis
        const [x, y] = mousePosition
        xAxesForSeries.forEach(id =>
            calcZoomAndUpdate(x, id, margin, setRangeFor, xAxesState, xRanges, scaleExtent, transform, plotDimensions)
        )
        yAxesForSeries.forEach(id =>
            calcZoomAndUpdate(y, id, margin, setRangeFor, yAxesState, yRanges, scaleExtent, transform, plotDimensions)
        )
        // hey, don't forget to update the plot with the new time-ranges in the code calling this... :)
    }
}

/**
 * Calculates the axis-ranges for each of the continuous numeric axes in the map
 * @param axes The map containing the axes and their associated IDs
 * @return a map associating the axis IDs with their continuous axis-range
 */
export function continuousAxisRanges(axes: Map<string, ContinuousNumericAxis>): Map<string, ContinuousAxisRange> {
    return continuousRange(axes)
}

/**
 * Calculates the axis-ranges for each of the ordinal axes in the map
 * @param axes The map containing the axes and their associated IDs
 * @param originalRange The original range of the axis
 * @return a map associating the axis IDs with their ordinal axis-range
 */
export function ordinalAxisRanges(axes: Map<string, OrdinalStringAxis>, originalRange: AxisInterval): Map<string, OrdinalAxisRange> {
    return ordinalRange(axes, originalRange)
}

/**
 * Calculates the axis interval (start, end) for each of the axis
 * @param axes The axes representing the time
 * @return A map associating each axis with a (start, end) interval
 */
export function continuousAxisIntervals(axes: Map<string, ContinuousNumericAxis>): Map<string, AxisInterval> {
    return new Map(Array.from(axes.entries())
        .map(([id, axis]) => {
            const [start, end] = axis.scale.domain()
            return [id, AxisInterval.from(start, end)] as [string, AxisInterval]
        }))
}

/**
 * Calculates the axis interval (start, end) for each of the axis
 * @param axes The axes representing the time
 * @return A map associating each axis with a (start, end) interval
 */
export function ordinalAxisIntervals(axes: Map<string, OrdinalStringAxis>): Map<string, {interval: AxisInterval, categories: Array<string>}> {
    return new Map(Array.from(axes.entries())
        .map(([id, axis]) => {
            const [start, end] = axis.scale.range()
            return [id, {interval: AxisInterval.from(start, end), categories: axis.scale.domain()}]
        }))
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
            return [id, ContinuousAxisRange.from(start, end)]
        }))
}

/**
 * Returns the bounds on the specified continuous numeric axes
 * @param axes A map associating an axis ID with a {@link OrdinalStringAxis}
 * @param originalRange The original range of the axis
 * @return A map associating each specified axis ID with the interval covered (bounds) by the axis
 */
export function ordinalRange(axes: Map<string, OrdinalStringAxis>, originalRange: AxisInterval): Map<string, OrdinalAxisRange> {
    return new Map(Array.from(axes.entries())
        .map(([id, ]) =>
            [id, OrdinalAxisRange.from(originalRange.start, originalRange.end)]
        )
    )
}