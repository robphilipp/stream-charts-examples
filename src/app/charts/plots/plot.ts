import type {Dimensions} from "../styling/margins";
import type {CanvasContext, DrawFn, DrawHandle} from "../d3types";
import type {FastShiftArray} from "fast-shift-array";
import type {BaseAxisRange} from "../axes/BaseAxisRange";
import type {AxisInterval} from "../axes/AxisInterval";

export type Series<D> = Array<D> | FastShiftArray<D>

interface RegisteredDraw {
    draw: DrawFn
    zIndex: number
}

/**
 * Creates the {@link CanvasContext} for the chart -- the drawing context plus the redraw
 * registration/scheduling API that axes, plots, and the tracker use to (re)paint themselves.
 * Replaces the old `createPlotContainer`, which appended the root SVG `<g>`.
 * @param chartId A unique value identifying the chart.
 * @param canvas The `<canvas>` DOM element backing the chart.
 * immediately after this with the actual container dimensions).
 * @param color The default `color` used for text/strokes when nothing more specific is set.
 */
export function createCanvasContext(
    chartId: number,
    canvas: HTMLCanvasElement,
    color: string
): CanvasContext {
    const ctx = canvas.getContext('2d')
    if (!ctx) {
        throw new Error(`Unable to acquire a 2D rendering context for chart ${chartId}`)
    }

    const dpr = window.devicePixelRatio || 1
    ctx.textBaseline = 'alphabetic'
    ctx.strokeStyle = color
    ctx.fillStyle = color

    const drawFns = new Map<DrawHandle, RegisteredDraw>()
    let animationFrameId: number | null = null

    const redrawNow = (): void => {
        animationFrameId = null

        // clear the full backing-store (not just the CSS-pixel size, since the backing store is
        // scaled by devicePixelRatio and the current transform includes that scale)
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.restore()

        Array.from(drawFns.values())
            .sort((a, b) => a.zIndex - b.zIndex)
            .forEach(({draw}) => draw(canvasContext))

        // // TEMPORARY INSTRUMENTATION -- times each registered draw handle individually so we can
        // // see which one is actually consuming the frame budget, rather than just the total.
        // // Remove once the culprit is identified.
        // const __perHandleMs: Record<string, number> = {}
        // Array.from(drawFns.entries())
        //     .sort(([, a], [, b]) => a.zIndex - b.zIndex)
        //     .forEach(([handle, {draw}]) => {
        //         const __t0 = performance.now()
        //         draw(canvasContext)
        //         __perHandleMs[handle] = (__perHandleMs[handle] ?? 0) + (performance.now() - __t0)
        //     })
        //
        // const w = window as unknown as {
        //     __redrawStats?: {count: number, perHandleTotals: Record<string, number>}
        // }
        // if (!w.__redrawStats) w.__redrawStats = {count: 0, perHandleTotals: {}}
        // w.__redrawStats.count++
        // for (const [handle, ms] of Object.entries(__perHandleMs)) {
        //     w.__redrawStats.perHandleTotals[handle] = (w.__redrawStats.perHandleTotals[handle] ?? 0) + ms
        // }
        // if (w.__redrawStats.count % 50 === 0) {
        //     const totals = w.__redrawStats.perHandleTotals
        //     const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a)
        //     console.log(`--- redraw breakdown after ${w.__redrawStats.count} frames (avg ms/frame per handle) ---`)
        //     sorted.forEach(([handle, totalMs]) => {
        //         console.log(`  ${handle}: ${(totalMs / w.__redrawStats!.count).toFixed(3)}ms`)
        //     })
        //     // reset so the next block reflects the next 50 frames, not a growing cumulative average
        //     w.__redrawStats = {count: 0, perHandleTotals: {}}
        // }
    }

    const canvasContext: CanvasContext = {
        chartId,
        canvas,
        context2D: ctx,
        dpr,
        register: (id, draw, zIndex = 0) => {
            drawFns.set(id, {draw, zIndex})
            canvasContext.requestRedraw()
        },
        unregister: (id) => {
            drawFns.delete(id)
            canvasContext.requestRedraw()
        },
        requestRedraw: () => {
            if (animationFrameId === null) {
                animationFrameId = window.requestAnimationFrame(redrawNow)
            }
        }
    }

    return canvasContext
}

/**
 * Resizes the canvas's backing store to match `dimensions` at the current devicePixelRatio, so
 * that drawing stays crisp on high-DPI displays, and re-applies the dpr scale to the drawing
 * context so that one drawing-unit equals one CSS pixel. Replaces the old SVG `width`/`height`
 * attribute updates. Call this whenever the container's pixel dimensions change, before the next
 * redraw.
 * @param cc The canvas context
 * @param dimensions The new overall (plot + margin) dimensions, in CSS pixels
 */
export function resizeCanvasTo(cc: CanvasContext, dimensions: Dimensions): void {
    const {canvas, context2D, dpr} = cc
    const width = Math.max(0, dimensions.width)
    const height = Math.max(0, dimensions.height)

    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)

    context2D.setTransform(dpr, 0, 0, dpr, 0, 0)
}

/**
 * Clips subsequent drawing to a rectangular area. Replaces the old SVG `<clipPath>`/
 * `setClipPathG`/`setClipPath`. Canvas clip regions are stack-based: callers must `ctx.save()`
 * before calling this and `ctx.restore()` once the clipped drawing is done, or the clip will leak
 * into unrelated draw calls later in the same frame.
 * @param cc The canvas context
 * @param dimensions The dimensions of the area to clip to
 * @param origin The top-left corner of the clip area, in canvas drawing coordinates (defaults to
 * `(0, 0)`; pass the margin's `(left, top)` when clipping to the plot area, which is offset from
 * the canvas origin)
 */
export function clipToArea(
    cc: CanvasContext,
    dimensions: Dimensions,
    origin: {x: number, y: number} = {x: 0, y: 0}
): void {
    cc.context2D.beginPath()
    cc.context2D.rect(origin.x, origin.y, Math.max(0, dimensions.width), Math.max(0, dimensions.height))
    cc.context2D.clip()
}

/**
 * Represents the assignment of an x-axis and y-axis to a series. Plots (see, for example,
 * {@link ScatterPlot} and {@link RasterPlot}) use this interface to manage the assignment
 * of axes to series
 */
export interface AxesAssignment {
    xAxis: string
    yAxis: string
}

/**
 * Factory function for the assignment of axes to series
 * @param xAxis The ID of the x-axis
 * @param yAxis The ID of the y-axis
 * @return An {@link AxesAssignment}
 */
export const assignAxes = (xAxis: string, yAxis: string): AxesAssignment => ({xAxis, yAxis})

/**
 * Converts a map holding the axes' ranges into a map holding the axes' current intervals. Used
 * when reporting the axes' bounds to the code using the chart (see the plots' `onUpdateAxesInterval`).
 * @param ranges A map associating an axis ID with that axis' range
 * @return A map associating an axis ID with that axis' current interval
 */
export function currentIntervalsFrom(ranges: Map<string, BaseAxisRange>): Map<string, AxisInterval> {
    const intervals = new Map<string, AxisInterval>()
    ranges.forEach((range, axisId) => intervals.set(axisId, range.current))
    return intervals
}