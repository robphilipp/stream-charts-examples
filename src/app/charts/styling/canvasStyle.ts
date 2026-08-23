// Canvas equivalents of the stroke/fill helpers that used to live in svgStyle.ts. The old versions
// mutated a *persistent* SVG element's CSS style (`selection.style('stroke', ...)`), so it stuck
// around until changed again. Canvas has no persistent elements -- `ctx.strokeStyle`/`ctx.fillStyle`
// /`ctx.lineWidth` are transient 2D-context state that only affects the *next* stroke()/fill() call,
// so these must be (re-)applied immediately before every draw, every frame.
//
// IMPORTANT DIFFERENCE FROM SVG: canvas has a single `ctx.globalAlpha` shared between stroke and
// fill, unlike SVG's independent `stroke-opacity`/`fill-opacity`. If a shape needs different
// stroke and fill opacity in the same draw call, bake the opacity into the color string with
// `withAlpha(...)` instead of relying on `globalAlpha` for one of them.

export interface CanvasStrokeStyle {
    readonly color: string
    readonly width: number
    readonly opacity: number
}

export function updateStrokeColor(current: CanvasStrokeStyle, color: string): CanvasStrokeStyle {
    return {...current, color}
}

export function updateStrokeWidth(current: CanvasStrokeStyle, width: number): CanvasStrokeStyle {
    return {...current, width}
}

export function updateStrokeOpacity(current: CanvasStrokeStyle, opacity: number): CanvasStrokeStyle {
    return {...current, opacity}
}

/**
 * Applies a stroke style to the canvas context. Call this immediately before `ctx.stroke()` --
 * unlike the old SVG version, the effect is not persistent.
 * @param context The canvas 2D context to apply the style to
 * @param style The (partial) stroke style to apply; unset fields are left untouched on `ctx`
 * @return `ctx`, for chaining
 */
export function applyStrokeStyle(context: CanvasRenderingContext2D, style: Partial<CanvasStrokeStyle>): CanvasRenderingContext2D {
    if (style.color !== undefined) context.strokeStyle = style.color
    if (style.width !== undefined) context.lineWidth = style.width
    if (style.opacity !== undefined) context.globalAlpha = style.opacity
    return context
}

export interface CanvasFillStyle {
    readonly color: string
    readonly opacity: number
}

export function updateFillColor(current: CanvasFillStyle, color: string): CanvasFillStyle {
    return {...current, color}
}

export function updateFillOpacity(current: CanvasFillStyle, opacity: number): CanvasFillStyle {
    return {...current, opacity}
}

/**
 * Applies a fill style to the canvas context. Call this immediately before `ctx.fill()`/
 * `ctx.fillText()`/`ctx.fillRect()` -- unlike the old SVG version, the effect is not persistent.
 * @param context The canvas 2D context to apply the style to
 * @param style The (partial) fill style to apply; unset fields are left untouched on `ctx`
 * @return `ctx`, for chaining
 */
export function applyFillStyle(context: CanvasRenderingContext2D, style: Partial<CanvasFillStyle>): CanvasRenderingContext2D {
    if (style.color !== undefined) context.fillStyle = style.color
    if (style.opacity !== undefined) context.globalAlpha = style.opacity
    return context
}

// lazily-created 1x1 offscreen context used only to resolve named/hex colors to rgb components
let colorProbeContext: CanvasRenderingContext2D | null = null

/**
 * Bakes an opacity into a color string by resolving it to `rgba(...)`. Needed because canvas has
 * a single `globalAlpha` shared between stroke and fill (see the module-level note above); when a
 * shape needs independent stroke and fill opacity, use this to bake opacity into the color passed
 * to {@link applyStrokeStyle}/{@link applyFillStyle} instead of setting `opacity` on both.
 * @param color Any valid CSS color string (named, hex, rgb, rgba, hsl, etc)
 * @param opacity The opacity to bake in, from 0 (transparent) to 1 (opaque)
 * @return An `rgba(...)` string equivalent to `color` at the given `opacity`
 */
export function withAlpha(color: string, opacity: number): string {
    if (!colorProbeContext) {
        colorProbeContext = document.createElement('canvas').getContext('2d')
    }
    if (!colorProbeContext) {
        // extremely unlikely (no canvas 2d support at all); fall back to the original color
        return color
    }
    colorProbeContext.fillStyle = color
    // the browser normalizes whatever we assigned to either "#rrggbb" or "rgba(r, g, b, a)"
    const resolved = colorProbeContext.fillStyle as string
    if (resolved.startsWith('#')) {
        const r = parseInt(resolved.slice(1, 3), 16)
        const g = parseInt(resolved.slice(3, 5), 16)
        const b = parseInt(resolved.slice(5, 7), 16)
        return `rgba(${r}, ${g}, ${b}, ${opacity})`
    }
    const match = resolved.match(/rgba?\(([^)]+)\)/)
    if (match) {
        const [r, g, b] = match[1].split(',').map(part => part.trim())
        return `rgba(${r}, ${g}, ${b}, ${opacity})`
    }
    return resolved
}
