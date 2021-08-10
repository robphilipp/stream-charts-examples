import * as d3 from 'd3'
import {ScaleLinear, Selection} from "d3";
import {Margin} from "./margins";
import {GSelection, LineSelection, MagnifierTextSelection, RadialMagnifierSelection, SvgSelection} from "./d3types";
import {Axes, AxesLabelFont, ContinuousNumericAxis} from "./axes";
import {TooltipStyle} from "./TooltipStyle";
import {formatValue} from "./utils";
import {TimeSeries} from "./plot";

/**
 * The lens transformation information
 */
export interface LensTransformation2d {
    // transformed location of the x-coordinate
    xPrime: number;

    // transformed location of the x-coordinate
    yPrime: number;

    // the amount by which the spike is magnified at that location
    magnification: number;
}

/**
 * Properties for rendering the radial-magnifier lens
 */
export interface RadialMagnifierStyle {
    visible: boolean
    radius: number
    magnification: number
    color: string,
    lineWidth: number,
}


/**
 * Circle magnifier contract.
 */
export interface RadialMagnifier {
    /**
     * Function to transform the (x, y)-coordinates to simulate magnification depending on the power and where in the
     * lens the point is.
     * @param {number} x The x-coordinate of the point to be transformed
     * @param {number} y The y-coordinate of the point to be transformed
     * @return {LensTransformation} The transformed x-coordinate and the amount by which is has been magnified
     */
    magnify: (x: number, y: number) => LensTransformation2d;

    /**
     * Function to transform the (x, y)-coordinates to itself as the identity
     * @param {number} x The x-coordinate of the point to be transformed
     * @param {number} y The y-coordinate of the point to be transformed
     * @return {LensTransformation} The original x-coordinate and a magnification of 1
     */
    identity: (x: number, y: number) => LensTransformation2d;

    // the radius of the lens
    radius: number;

    // the magnification power of the lens
    power: number;

    // the center of the lens
    center: [number, number];
}

/**
 * Vertical bar magnifier transformation function generator. For example, given a 2-dimensional
 * Cartesian coordinate system, transforms the x-values as if a vertical bar lens were placed over
 * the data. The lens, in this example, would sit on the x-y plane with its center value at x = center,
 * and its outer edges at x = center ± radius.
 * <p>
 * Modified for bar lens from the <a href="https://github.com/d3/d3-plugins/blob/master/fisheye/fisheye.js">d3 fisheye plugin</a>,
 * which also references <a href="http://dl.acm.org/citation.cfm?id=142763">Based on Sarkar and Brown’s Graphical
 * Fisheye Views of Graphs (CHI '92)</a>.
 * @param {number} radius The radius of the lens.
 * @param {number} power The optical magnification of the lens (i.e. ratio of magnified size to "true" size) and must
 * be greater than 1.
 * @param {[number, number]} center The center of the lens
 * @return {RadialMagnifier} A bar-magnifier type for transforming the x-coordinates to make it appear as though
 * the x-coord has been magnified by a bar magnifier
 */
export function radialMagnifierWith(radius: number, power: number, center: [number, number]): RadialMagnifier {

    if (power < 1) {
        throw Error('radial magnifier power must be greater than or equal to 1');
    }

    if (radius <= 0) {
        throw Error('radial magnifier radius must be greater than or equal to 0');
    }

    /**
     * Recalculates the magnification parameters
     * @return {(x: number) => number} A function that takes an x-value and transforms it to the value that
     * would appear under such a bar magnifier lens
     */
    function rescale(): RadialMagnifier {
        const expPower = Math.exp(Math.max(1, power));
        const k0 = radius * expPower / (expPower - 1);
        const k1 = power / radius;

        /**
         * Transforms the x-value to where it would appear under a bar lens
         * @param {number} x The x-value of the point
         * @param {number} y The y-value of the point
         * @return {number} The transformed value with the point's magnification
         */
        function magnifier(x: number, y: number): LensTransformation2d {
            const [cx, cy] = center;

            // calculate the distance from the center of the lens
            const dx = x - cx;
            const dy = y - cy;
            const dd = Math.sqrt(dx * dx + dy * dy);

            // when the distance is further than the radius, the point is outside of the
            // lens and so there is no magnification
            if (dd >= radius) return {
                xPrime: x,
                yPrime: y,
                magnification: 1
            };

            if (dd < 1e-6) return {
                xPrime: x,
                yPrime: y,
                // set the magnification to the value in the limit as dd -> 0
                magnification: 0.25 + 0.75 * expPower / (expPower - 1)
            };

            const magnification = 0.25 + 0.75 * k0 * (1 - Math.exp(-dd * k1)) / dd;
            return {
                xPrime: cx + dx * magnification,
                yPrime: cy + dy * magnification,
                magnification: magnification
            };
        }

        /**
         * An identity magnification
         * @param {number} x The x-value of the point
         * @param {number} y The y-value of the point
         * @return {LensTransformation2d} The original value with a magnification of 1
         */
        function identity(x: number, y: number): LensTransformation2d {
            return {xPrime: x, yPrime: y, magnification: 1};
        }

        return {
            magnify: magnifier,
            identity: identity,
            radius: radius,
            power: Math.max(1, power),
            center: center
        }
    }

    return rescale();
}

export function showMagnifierLens(
    chartId: number,
    mainG: GSelection,
    svg: SvgSelection,
    mouseCoord: [number, number],
    magnifierStyle: RadialMagnifierStyle,
    margin: Margin,
    xScale: ScaleLinear<number, number>,
    yScale: ScaleLinear<number, number>,
    magnifierAxes: RadialLensAxesSelections
) {
    const [mx, my] = mouseCoord
    svg
        .select('.magnifier')
        .attr('r', magnifierStyle.radius)
        .attr('cx', mx)
        .attr('cy', my)
        .attr('opacity', () => 1)

    // create the radial magnifier
    const radialMagnifier: RadialMagnifier = radialMagnifierWith(
        magnifierStyle.radius,
        magnifierStyle.magnification,
        [mx - margin.left, my - margin.top]
    )

    // transform svg elements underneath the magnifier
    mainG
        .selectAll<SVGSVGElement, Array<[number, number]>>('.time-series-lines')
        .attr("d", data => {
            const magnified = magnifyAll(
                data,
                [mx, my],
                magnifierStyle.radius,
                radialMagnifier,
                margin,
                xScale,
                yScale
            )
            return d3.line()(magnified)
        })

    svg
        .select(`#x-lens-axis-${chartId}`)
        .attr('x1', mx - magnifierStyle.radius)
        .attr('x2', mx + magnifierStyle.radius)
        .attr('y1', my)
        .attr('y2', my)
        .attr('opacity', 0.3)

    svg
        .select(`#y-lens-axis-${chartId}`)
        .attr('x1', mx)
        .attr('x2', mx)
        .attr('y1', my - magnifierStyle.radius)
        .attr('y2', my + magnifierStyle.radius)
        .attr('opacity', 0.3)

    const axesMagnifier: RadialMagnifier = radialMagnifierWith(
        magnifierStyle.radius,
        magnifierStyle.magnification,
        [mx, my]
    )

    magnifierAxes.magnifierXAxis
        .attr('stroke', magnifierStyle.color)
        .attr('stroke-width', magnifierStyle.lineWidth)
        .attr('opacity', 0.75)
        .attr('x1', datum => axesMagnifier.magnify(mx + datum * magnifierStyle.radius / 5, my).xPrime)
        .attr('x2', datum => axesMagnifier.magnify(mx + datum * magnifierStyle.radius / 5, my).xPrime)
        .attr('y1', my)
        .attr('y2', datum => axesMagnifier.magnify(mx, my + magnifierStyle.radius * (1 - Math.abs(datum / 5)) / 40).yPrime + 5)


    magnifierAxes.magnifierXAxisLabel
        .attr('x', datum => axesMagnifier.magnify(mx + datum * magnifierStyle.radius / 5, my).xPrime - 12)
        .attr('y', datum => axesMagnifier.magnify(mx, my + magnifierStyle.radius * (1 - Math.abs(datum / 5)) / 30).yPrime + 20)
        .text(datum => Math.round(xScale.invert(mx - margin.left + datum * magnifierStyle.radius / 5)))


    magnifierAxes.magnifierYAxis
        .attr('stroke', magnifierStyle.color)
        .attr('stroke-width', magnifierStyle.lineWidth)
        .attr('opacity', 0.75)
        .attr('x1', datum => axesMagnifier.magnify(mx - magnifierStyle.radius * (1 - Math.abs(datum / 5)) / 40, my).xPrime - 2)
        .attr('x2', datum => axesMagnifier.magnify(mx + magnifierStyle.radius * (1 - Math.abs(datum / 5)) / 40, my).xPrime + 2)
        .attr('y1', datum => axesMagnifier.magnify(mx, my + datum * magnifierStyle.radius / 5).yPrime)
        .attr('y2', datum => axesMagnifier.magnify(mx, my + datum * magnifierStyle.radius / 5).yPrime)


    magnifierAxes.magnifierYAxisLabel
        .attr('x', datum => axesMagnifier.magnify(mx + magnifierStyle.radius * (1 - Math.abs(datum / 5)) / 40, my).xPrime + 10)
        .attr('y', datum => axesMagnifier.magnify(mx, my + datum * magnifierStyle.radius / 5).yPrime - 2)
        .text(datum => formatValue(yScale.invert(my - margin.top + datum * magnifierStyle.radius / 5)))
}

export function hideMagnifierLens(
    chartId: number,
    mainG: GSelection,
    svg: SvgSelection,
    xScale: ScaleLinear<number, number>,
    yScale: ScaleLinear<number, number>,
    magnifierAxes: RadialLensAxesSelections,
    mouseCoord: [number, number],
    magnifierStyle: RadialMagnifierStyle
) {
    const [mx, my] = mouseCoord
    svg
        .select('.magnifier')
        .attr('r', magnifierStyle.radius)
        .attr('cx', mx)
        .attr('cy', my)
        .attr('opacity', () => 0)

    mainG
        .selectAll<SVGSVGElement, Array<[number, number]>>('.time-series-lines')
        .attr("d", data => {
            const magnified: TimeSeries = data
                .map(([x, y]) => [xScale(x), yScale(y)])
            return d3.line()(magnified)
        })

    svg.select(`#x-lens-axis-${chartId}`).attr('opacity', 0)
    svg.select(`#y-lens-axis-${chartId}`).attr('opacity', 0)
    magnifierAxes.magnifierXAxis.attr('opacity', 0)
    magnifierAxes.magnifierXAxisLabel.text(() => '')
    magnifierAxes.magnifierYAxis.attr('opacity', 0)
    magnifierAxes.magnifierYAxisLabel.text(() => '')
}

/**
 * @param datum The (x, y) pair in the data coordinates
 * @param xScale The xScale to convert from data coordinates to screen coordinates
 * @param yScale The yScale to convert from data coordinates to screen coordinates
 */
export function toScreenCoordinates(
    datum: [number, number],
    xScale: ScaleLinear<number, number>,
    yScale: ScaleLinear<number, number>
): [number, number] {
    return [xScale(datum[0]), yScale(datum[1])]
}

/**
 * Calculates the transformation of the (x, y) screen coordinates to represent
 * the magnification of the point. When the (x, y) point is outside of the
 * lens, then returns the original point
 * @param datum The (x, y) pair in screen coordinates
 * @param mouse The mouse cursor position
 * @param radius The extent of the magnifier lens
 * @param magnifier The bar magnifier function
 * @param margin The plot margin (i.e. the space between the actual plot and its
 * container).
 * @return The datum's screen coordinates transformed to represent the magnification
 */
export function magnify(
    datum: [number, number],
    mouse: [number, number],
    radius: number,
    magnifier: RadialMagnifier,
    margin: Margin
): [number, number] {
    const [datumX, datumY] = datum
    if (inMagnifier([datumX + margin.left, datumY + margin.top], mouse, radius)) {
        const transform = magnifier.magnify(datumX, datumY)
        return [transform.xPrime, transform.yPrime]
    }
    return datum
}

/**
 * Calculates the transformation of the (x, y) screen coordinates to represent
 * the magnification of the point. When the (x, y) point is outside of the
 * lens, then returns the original point
 * @param data The (x, y) pairs representing the data
 * @param mouse The mouse cursor position
 * @param radius The extent of the magnifier lens
 * @param magnifier The bar magnifier function
 * @param margin The plot margin (i.e. the space between the actual plot and its
 * container).
 * @param xScale The scale used to convert from data coordinates to screen coordinates
 * for the x-axis
 * @param yScale The scale used to convert from data coordinates to screen coordinates
 * for the y-axis
 * @return The datum's screen coordinates transformed to represent the magnification
 */
export function magnifyAll(
    data: Array<[number, number]>,
    mouse: [number, number],
    radius: number,
    magnifier: RadialMagnifier,
    margin: Margin,
    xScale: ScaleLinear<number, number>,
    yScale: ScaleLinear<number, number>,
): Array<[number, number]> {
    return data.map(([x, y]) => magnify(
        toScreenCoordinates([x, y], xScale, yScale), mouse, radius, magnifier, margin)
    )
}

/**
 * Determines whether specified datum is in the time interval centered around the current
 * mouse position
 * @param datum The datum represented in x-coordinates (i.e. screen rather than time)
 * @param mouse The (x, y)-coordinate of the current mouse position
 * @param radius The pixel interval for which transformations are applied
 * @return `true` if the datum is in the interval; `false` otherwise
 */
function inMagnifier(datum: [number, number], mouse: [number, number], radius: number): boolean {
    const [x, y] = datum
    const [mx, my] = mouse
    // do a quick check to see if the datum is in a box of size 2*radius centered at the mouse,
    // and if it is, do the more expensive distance calc, otherwise just return the coordinates
    // of the datum
    if (mx - radius < x && x < mx + radius && my - radius < y && y < my + radius) {
        return Math.sqrt((mx - x) * (mx - x) + (my - y) * (my - y)) < radius
    } else {
        return false
    }
}

export interface RadialLensSelections {
    magnifierSelection: RadialMagnifierSelection
    axesSelections: RadialLensAxesSelections
}

export interface RadialLensAxesSelections {
    magnifierXAxis: LineSelection
    magnifierXAxisLabel: MagnifierTextSelection
    magnifierYAxis: LineSelection
    magnifierYAxisLabel: MagnifierTextSelection
}

/**
 * Creates the SVG elements for displaying a radial magnifier lens on the data
 * @param svg The SVG selection
 * @param visible `true` if the lens is visible; `false` otherwise
 * @return The magnifier selection if visible; otherwise undefined
 */
export function createMagnifierLens(
    chartId: number,
    svg: SvgSelection,
    container: SVGSVGElement,
    margin: Margin,
    width: number,
    height: number,
    magnifierStyle: RadialMagnifierStyle,
    axes: Axes<ContinuousNumericAxis, ContinuousNumericAxis>,
    axesLabelFont: AxesLabelFont,
    mainG: GSelection,

    // magnifier: RadialMagnifier | undefined,
    tooltipStyle: TooltipStyle,
    borderColor: string,

): RadialLensSelections {
        const radialGradient = svg
            .append<SVGDefsElement>('defs')
            .append<SVGLinearGradientElement>('radialGradient')
            .attr('id', `radial-magnifier-gradient-${chartId}`)
            .attr('cx', '47%')
            .attr('cy', '47%')
            .attr('r', '53%')
            .attr('fx', '25%')
            .attr('fy', '25%')


        radialGradient
            .append<SVGStopElement>('stop')
            .attr('offset', '0%')
            .attr('stop-color', borderColor)

        radialGradient
            .append<SVGStopElement>('stop')
            .attr('offset', '30%')
            .attr('stop-color', tooltipStyle.backgroundColor)
            .attr('stop-opacity', 0)


        radialGradient
            .append<SVGStopElement>('stop')
            .attr('offset', '70%')
            .attr('stop-color', tooltipStyle.backgroundColor)
            .attr('stop-opacity', 0)


        radialGradient
            .append<SVGStopElement>('stop')
            .attr('offset', '100%')
            .attr('stop-color', borderColor)


        const magnifierSelection = svg
            .append<SVGCircleElement>('circle')
            .attr('class', 'magnifier')
            .style('fill', `url(#radial-magnifier-gradient-${chartId})`)


        // create the lens axes', ticks and tick labels. the labels hold the time and values of the
        // current mouse location
        createMagnifierLensAxisLine(`x-lens-axis-${chartId}`, svg, magnifierStyle)
        createMagnifierLensAxisLine(`y-lens-axis-${chartId}`, svg, magnifierStyle)

        const lensTickIndexes = d3.range(-5, 6, 1)
        const lensLabelIndexes = [-5, -1, 0, 1, 5]

        const xLensAxisTicks = svg.append('g').attr('id', `x-lens-axis-ticks-${chartId}`)
        const magnifierXAxis = magnifierLensAxisTicks('x-lens-ticks', lensTickIndexes, xLensAxisTicks, magnifierStyle)
        const magnifierXAxisLabel = magnifierLensAxisLabels(lensLabelIndexes, xLensAxisTicks, axesLabelFont)

        const yLensAxisTicks = svg.append('g').attr('id', `y-lens-axis-ticks-${chartId}`)
        const magnifierYAxis = magnifierLensAxisTicks('y-lens-ticks', lensTickIndexes, yLensAxisTicks, magnifierStyle)
        const magnifierYAxisLabel = magnifierLensAxisLabels(lensLabelIndexes, yLensAxisTicks, axesLabelFont)

        // svg.on('mousemove', () => handleShowMagnify(chartId, svg, container, margin, width, height, magnifierXAxis, magnifierXAxisLabel, magnifierYAxis, magnifierYAxisLabel, magnifierStyle, axes, mainG))

        return {
            magnifierSelection: magnifierSelection,
            axesSelections: {
                magnifierXAxis, magnifierXAxisLabel,
                magnifierYAxis, magnifierYAxisLabel
            }
        }
}

/**
 * Creates a magnifier lens axis svg node and appends it to the specified svg selection
 * @param className The class name of the svg line line
 * @param svg The svg selection to which to add the axis line
 */
function createMagnifierLensAxisLine(className: string, svg: SvgSelection, magnifierStyle: RadialMagnifierStyle): void {
    svg
        .append('line')
        .attr('id', className)
        .attr('stroke', magnifierStyle.color)
        .attr('stroke-width', magnifierStyle.lineWidth)
        .attr('opacity', 0)
}

/**
 * Creates the svg node for a magnifier lens axis (either x or y) ticks and binds the ticks to the nodes
 * @param className The node's class name for selection
 * @param ticks The ticks represented as an array of integers. An integer of 0 places the
 * tick on the center of the lens. An integer of ± array_length / 2 - 1 places the tick on the lens boundary.
 * @param selection The svg g node holding these axis ticks
 * @return A line selection these ticks
 */
function magnifierLensAxisTicks(className: string, ticks: Array<number>, selection: GSelection, magnifierStyle: RadialMagnifierStyle): LineSelection {
    return selection
        .selectAll('line')
        .data(ticks)
        .enter()
        .append('line')
        .attr('class', className)
        .attr('stroke', magnifierStyle.color)
        .attr('stroke-width', magnifierStyle.lineWidth)
        .attr('opacity', 0)

}

/**
 * Creates the svg text nodes for the magnifier lens axis (either x or y) tick labels and binds the text nodes
 * to the tick data.
 * @param ticks An array of indexes defining where the ticks are to be place. The indexes refer
 * to the ticks handed to the `magnifierLensAxis` and have the same meaning visa-vie their locations
 * @param selection The selection of the svg g node holding the axis ticks and these labels
 * @return {Selection<SVGTextElement, number, SVGGElement, any>} The selection of these tick labels
 */
function magnifierLensAxisLabels(ticks: Array<number>, selection: GSelection, axisLabelFont: AxesLabelFont): Selection<SVGTextElement, number, SVGGElement, any> {
    return selection
        .selectAll('text')
        .data(ticks)
        .enter()
        .append('text')
        .attr('fill', axisLabelFont.color)
        .attr('font-family', axisLabelFont.family)
        .attr('font-size', axisLabelFont.size)
        .attr('font-weight', axisLabelFont.weight)
        .text(() => '')

}
