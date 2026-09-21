/**
 * Margin information
 */
export interface Margin {
    top: number
    right: number
    bottom: number
    left: number
}

export function noMargins(): Margin {
    return {top: 0, bottom: 0, left: 0, right: 0}
}

export interface Dimensions {
    readonly width: number
    readonly height: number
}

/**
 * Given the dimensions of the plot (width, height) based on the container's width and height,
 * and the plot's margins. Calculates the dimensions of the actual plot by subtracting the margins.
 * @param containerWidth The overall width of the container (plot and margins)
 * @param containerHeight The overall height of the container (plot and margins)
 * @param plotMargins The margins around the plot (top, bottom, left, right)
 * @return The dimensions of the actual plots adjusted for the margins
 * from the overall dimensions
 * @see containerDimensionsFrom
 */
export function plotDimensionsFrom(containerWidth: number, containerHeight: number, plotMargins: Margin): Dimensions {
    // floor at zero -- margins larger than the container would otherwise produce negative
    // width/height, which propagates into D3 scale ranges, tracker/tooltip clamping math, and
    // canvas draw coordinates as silent garbage. Mirrors the same Math.max(0, ...) convention
    // already used defensively at some (but not all) points of use, e.g. plot.ts's
    // resizeCanvasTo/clipToArea -- clamping here makes Dimensions a non-negative invariant for
    // every downstream consumer instead of relying on each one to remember to clamp itself.
    return {
        width: Math.max(0, containerWidth - plotMargins.left - plotMargins.right),
        height: Math.max(0, containerHeight - plotMargins.top - plotMargins.bottom)
    }
}

/**
 * Calculates the container's dimensions from the plot dimensions and the plot margin. The container
 * dimensions are the plot dimensions plus the margins.
 * @param plotDimensions The (width, height) of the plot
 * @param plotMargin The margins around the plot
 * @return The container dimensions.
 * @see plotDimensionsFrom
 */
export function containerDimensionsFrom(plotDimensions: Dimensions, plotMargin: Margin): Dimensions {
    return {
        width: plotDimensions.width + plotMargin.left + plotMargin.right,
        height: plotDimensions.height + plotMargin.top + plotMargin.bottom
    }
}

export function dimensionsEqual(dimension1: Dimensions, dimension2: Dimensions) {
    return dimension1.height === dimension2.height && dimension1.width === dimension2.width
}

export function dimensionsNotEqual(dimension1: Dimensions, dimension2: Dimensions) {
    return !dimensionsEqual(dimension1, dimension2)
}
