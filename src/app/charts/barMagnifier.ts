import {BarMagnifierSelection, GSelection, LineSelection, MagnifierTextSelection, SvgSelection} from "./d3types";
import * as d3 from "d3";
import {TooltipStyle} from "./TooltipStyle";
import {AxesLabelFont, AxesLineStyle, LinearAxis} from "./axes";
import {Margin} from "./margins";
import {Datum} from "./datumSeries";
import {ScaleLinear} from "d3";
import {PlotDimensions} from "stream-charts/dist/src/app/charts/margins";
import {textWidthOf} from "./utils";
import {SpikesStyle} from "./RasterChart";

/**
 * Properties for rendering the line-magnifier lens
 */
export interface BarMagnifierStyle {
    visible: boolean;
    width: number;
    magnification: number;
    color: string;
    lineWidth: number;
    axisOpacity?: number;
}


/**
 * The lens transformation information
 */
export interface LensTransformation {
    // transformed location of the x-coordinate
    xPrime: number;

    // the amount by which the spike is magnified at that location
    magnification: number;
}

export interface MagnifiedDatum extends Datum {
    lens: LensTransformation
}

/**
 * Bar magnifier contract.
 */
export interface BarMagnifier {
    /**
     * Function to transform the x-coordinate to simulate magnification depending on the power and where in the
     * lens the x-coordinate is.
     * @param {number} x The x-coordinate to be transformed
     * @return {LensTransformation} The transformed x-coordinate and the amount by which is has been magnified
     */
    magnify: (x: number) => LensTransformation;

    /**
     * Function to transform the x-coordinate to itself as the identity
     * @param {number} x The x-coordinate to be transformed
     * @return {LensTransformation} The original x-coordinate and a magnification of 1
     */
    identity: (x: number) => LensTransformation;

    // the radius of the lens
    radius: number;

    // the magnification power of the lens
    power: number;

    // the center of the lens
    center: number;
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
 * @param {number} power The optical magnification of the lens (i.e. ratio of magnified size to "true" size)
 * @param {number} center The center of the lens
 * @return {BarMagnifier} A bar-magnifier type for transforming the x-coordinates to make it appear as though
 * the x-coord has been magnified by a bar magnifier
 */
export function barMagnifierWith(radius: number, power: number, center: number): BarMagnifier {

    if (power < 1) {
        throw Error('bar magnifier power must be greater than or equal to 1');
    }

    if (radius <= 0) {
        throw Error('bar magnifier radius (width) must be greater than or equal to 0');
    }

    /**
     * Recalculates the magnification parameters
     * @return {(x: number) => number} A function that takes an x-value and transforms it to the value that
     * would appear under such a bar magnifier lens
     */
    function rescale(): BarMagnifier {
        const expPower = Math.exp(power);
        const k0 = expPower / (expPower - 1) * radius;
        const k1 = power / radius;

        /**
         * Transforms the x-value to where it would appear under a bar lens
         * @param {number} x The x-value of the point
         * @return {number} The transformed value with the point's magnification
         */
        function magnifier(x: number): LensTransformation {
            // when the x value is on the center, then just return the x value and the
            // maximum magnification
            if (x === center) return {xPrime: x, magnification: power};

            // calculate the distance from the center of the lens
            const dx = x - center;
            const dd = Math.abs(dx);

            // when the distance is further than the radius, the point is outside of the
            // lens and so there is no magnification
            if (dd >= radius) return {xPrime: x, magnification: 1};

            const magnification = 0.25 + 0.75 * k0 * (1 - Math.exp(-dd * k1)) / dd;
            return {xPrime: center + dx * magnification, magnification: magnification};
        }

        /**
         * An identity magnification
         * @param {number} x The x-value of the point
         * @return {LensTransformation} The original value with a magnification of 1
         */
        function identity(x: number): LensTransformation {
            return {xPrime: x, magnification: 1};
        }

        return {
            magnify: magnifier,
            identity: identity,
            radius: radius,
            power: power,
            center: center
        }
    }

    return rescale();
}

/**
 * Creates the svg node for a magnifier lens axis (either x or y) ticks and binds the ticks to the nodes
 * @param className The node's class name for selection
 * @param {Array<number>} ticks The ticks represented as an array of integers. An integer of 0 places the
 * tick on the center of the lens. An integer of ± array_length / 2 - 1 places the tick on the lens boundary.
 * @param selection The svg g node holding these axis ticks
 * @return A line selection these ticks
 */
export function magnifierLensAxisTicks(
    className: string,
    ticks: Array<number>,
    selection: GSelection,
    // tooltipStyle: TooltipStyle
    magnifierStyle: BarMagnifierStyle
): LineSelection {
    return selection
        .selectAll('line')
        .data(ticks)
        .enter()
        .append('line')
        .attr('class', className)
        .attr('stroke', magnifierStyle.color)
        .attr('stroke-width', 0.75)
        .attr('opacity', 0)
        ;
}

/**
 * Creates the svg text nodes for the magnifier lens axis (either x or y) tick labels and binds the text nodes
 * to the tick data.
 * @param ticks An array of indexes defining where the ticks are to be place. The indexes refer
 * to the ticks handed to the `magnifierLensAxis` and have the same meaning visa-vie their locations
 * @param selection The selection of the svg g node holding the axis ticks and these labels
 * @return The selection of these tick labels
 */
export function magnifierLensAxisLabels(
    ticks: Array<number>,
    selection: GSelection,
    axisLabelFont: AxesLabelFont
): MagnifierTextSelection {
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
        ;
}

export interface BarLensSelections {
    magnifierSelection: BarMagnifierSelection
    axesSelections: BarLensAxesSelections
}

export interface BarLensAxesSelections {
    magnifierXAxis: LineSelection
    magnifierXAxisLabel: MagnifierTextSelection
}

/**
 * Creates the SVG elements for displaying a bar magnifier lens on the data
 * @param svg The SVG selection
 * @param height The height of the magnifier lens
 * @return The magnifier selection if visible; otherwise undefined
 */
export function createMagnifierLens(
    chartId: number,
    svg: SvgSelection,
    magnifierStyle: BarMagnifierStyle,
    margin: Margin,
    height: number,
    axisLabelFont: AxesLabelFont
): BarLensSelections {
    const linearGradient = svg
        .append<SVGDefsElement>('defs')
        .append<SVGLinearGradientElement>('linearGradient')
        .attr('id', `bar-magnifier-gradient-${chartId}`)
        .attr('x1', '0%')
        .attr('x2', '100%')
        .attr('y1', '0%')
        .attr('y2', '0%')
    ;

    const borderColor = d3.rgb(magnifierStyle.color).brighter(3.5).hex();
    linearGradient
        .append<SVGStopElement>('stop')
        .attr('offset', '0%')
        .attr('stop-color', borderColor)
    ;

    linearGradient
        .append<SVGStopElement>('stop')
        .attr('offset', '30%')
        .attr('stop-color', magnifierStyle.color)
        .attr('stop-opacity', 0)
    ;

    linearGradient
        .append<SVGStopElement>('stop')
        .attr('offset', '70%')
        .attr('stop-color', magnifierStyle.color)
        .attr('stop-opacity', 0)
    ;

    linearGradient
        .append<SVGStopElement>('stop')
        .attr('offset', '100%')
        .attr('stop-color', borderColor)
    ;

    const magnifierSelection = svg
        .append<SVGRectElement>('rect')
        .attr('class', 'bar-magnifier')
        .attr('y', margin.top)
        .attr('height', height)
        .style('fill', `url(#bar-magnifier-gradient-${chartId})`)
    ;

    svg
        .append<SVGLineElement>('line')
        .attr('id', `magnifier-line-${chartId}`)
        .attr('y1', margin.top)
        .attr('y2', height + margin.top)
        .attr('stroke', magnifierStyle.color)
        .attr('stroke-width', magnifierStyle.lineWidth)
        .attr('opacity', 0)
    ;

    // create the text element holding the tracker time
    svg
        .append<SVGTextElement>('text')
        .attr('id', `magnifier-line-time-${chartId}`)
        .attr('y', Math.max(0, margin.top - 3))
        .attr('fill', axisLabelFont.color)
        .attr('font-family', axisLabelFont.family)
        .attr('font-size', axisLabelFont.size)
        .attr('font-weight', axisLabelFont.weight)
        .attr('opacity', 0)
        .text(() => '')

    const lensTickIndexes = d3.range(-5, 6, 1);
    const lensLabelIndexes = [-5, -1, 1, 5];

    const xLensAxisTicks = svg.append('g').attr('id', `x-lens-axis-ticks-raster-${chartId}`);
    const axisSelection = magnifierLensAxisTicks('x-lens-ticks', lensTickIndexes, xLensAxisTicks, magnifierStyle);
    const axisLabelSelection = magnifierLensAxisLabels(lensLabelIndexes, xLensAxisTicks, axisLabelFont);

    return {
        magnifierSelection, axesSelections: {magnifierXAxis: axisSelection, magnifierXAxisLabel: axisLabelSelection}
    };
}

/**
 * Determines whether specified datum is in the time interval centered around the current
 * mouse position
 * @param datum The datum
 * @param x The x-coordinate of the current mouse position
 * @param xInterval The pixel interval for which transformations are applied
 * @param xAxis The x-axis
 * @param margin The plot margins
 * @return `true` if the datum is in the interval; `false` otherwise
 */
export function inMagnifier(datum: Datum, x: number, xInterval: number, xAxis: LinearAxis, margin: Margin): boolean {
    const scale = xAxis.generator.scale<ScaleLinear<number, number>>();
    const datumX = scale(datum.time) + margin.left;
    return datumX > x - xInterval && datumX < x + xInterval;
}

/**
 * Converts the datum into the x-coordinate corresponding to its time
 * @param datum The datum
 * @param xAxis The x-axis
 * @return The x-coordinate corresponding to its time
 */
export function xFrom(datum: Datum, xAxis: LinearAxis): number {
    const scale = xAxis.generator.scale<ScaleLinear<number, number>>();
    return scale(datum.time);
}

export function showMagnifierLens(
    chartId: number,
    svg: SvgSelection,
    magnifier: BarMagnifierStyle,
    magnifierAxes: BarLensAxesSelections,
    margin: Margin,
    mouseCoord: [number, number],
    xAxis: LinearAxis,
    plotDim: PlotDimensions,
    zoomFactor: number,
    spikesStyle: SpikesStyle
): number {
    const deltaX = magnifier.width / 2;
    const path = d3.select('.bar-magnifier')
    const [mx, my] = mouseCoord
    path
        .attr('x', mx - deltaX)
        .attr('width', 2 * deltaX)
        .attr('opacity', 1)

    // add the magnifier axes and label
    d3.select(`#magnifier-line-${chartId}`)
        .attr('x1', mx)
        .attr('x2', mx)
        .attr('opacity', magnifier.axisOpacity || 0.35)

    const label = d3.select<SVGTextElement, any>(`#magnifier-line-time-${chartId}`)
        .attr('opacity', 1)
        .text(() => `${d3.format(",.0f")(xAxis.scale.invert(mx - margin.left))} ms`)
    label.attr('x', Math.min(plotDim.width + margin.left - textWidthOf(label), mx))

    const axesMagnifier: BarMagnifier = barMagnifierWith(deltaX, magnifier.magnification, mx)
    magnifierAxes.magnifierXAxis
        .attr('opacity', 1)
        .attr('stroke', magnifier.color)
        .attr('stroke-width', 0.75)
        .attr('x1', datum => axesMagnifier.magnify(mx + datum * deltaX / 5).xPrime)
        .attr('x2', datum => axesMagnifier.magnify(mx + datum * deltaX / 5).xPrime)
        .attr('y1', my - 10)
        .attr('y2', my)

    magnifierAxes.magnifierXAxisLabel
        .attr('opacity', 1)
        .attr('x', datum => axesMagnifier.magnify(mx + datum * deltaX / 5).xPrime - 12)
        .attr('y', _ => my + 20)
        .text(datum => Math.round(xAxis.scale.invert(mx - margin.left + datum * deltaX / 5)))

    const barMagnifier: BarMagnifier = barMagnifierWith(deltaX, 3 * zoomFactor, mx - margin.left)
    svg
        // select all the spikes and keep only those that are within ±4∆t of the x-position of the mouse
        .selectAll<SVGSVGElement, MagnifiedDatum>('.spikes-lines')
        .filter(datum => inMagnifier(datum, mx, 4 * deltaX, xAxis, margin))
        // supplement the datum with lens transformation information (new x and scale)
        .each(datum => datum.lens = barMagnifier.magnify(xFrom(datum, xAxis)))
        // update each spikes line with it's new x-coordinate and the magnified line-width
        .attr('x1', datum => datum.lens.xPrime)
        .attr('x2', datum => datum.lens.xPrime)
        .attr('stroke-width', datum => spikesStyle.lineWidth * Math.min(2, Math.max(datum.lens.magnification, 1)))
        .attr('shape-rendering', 'crispEdges')

    return mx
}

export function hideMagnifierLens(
    chartId: number,
    svg: SvgSelection,
    magnifier: BarMagnifierStyle,
    magnifierAxes: BarLensAxesSelections,
    margin: Margin,
    mouseCoord: [number, number],
    xAxis: LinearAxis,
    plotDim: PlotDimensions,
    spikesStyle: SpikesStyle
): number {
    const deltaX = magnifier.width / 2;
    const path = d3.select('.bar-magnifier')
    const [mx, my] = mouseCoord
    path
        .attr('x', mx - deltaX)
        .attr('width', 2 * deltaX)
        .attr('opacity', 0)

    // add the magnifier axes and label
    d3.select(`#magnifier-line-${chartId}`)
        .attr('x1', mx)
        .attr('x2', mx)
        .attr('opacity', 0)

    const label = d3.select<SVGTextElement, any>(`#magnifier-line-time-${chartId}`)
        .attr('opacity', 0)
        .text(() => `${d3.format(",.0f")(xAxis.scale.invert(mx - margin.left))} ms`)
    label.attr('x', Math.min(plotDim.width + margin.left - textWidthOf(label), mx))

    const axesMagnifier: BarMagnifier = barMagnifierWith(deltaX, magnifier.magnification, mx)
    magnifierAxes.magnifierXAxis
        .attr('opacity', 0)
        .attr('stroke', magnifier.color)
        .attr('stroke-width', 0.75)
        .attr('x1', datum => axesMagnifier.magnify(mx + datum * deltaX / 5).xPrime)
        .attr('x2', datum => axesMagnifier.magnify(mx + datum * deltaX / 5).xPrime)
        .attr('y1', my - 10)
        .attr('y2', my)

    magnifierAxes.magnifierXAxisLabel
        .attr('opacity', 0)
        .attr('x', datum => axesMagnifier.magnify(mx + datum * deltaX / 5).xPrime - 12)
        .attr('y', _ => my + 20)
        .text(datum => Math.round(xAxis.scale.invert(mx - margin.left + datum * deltaX / 5)))

    svg
        .selectAll<SVGSVGElement, Datum>('.spikes-lines')
        .attr('x1', datum => xFrom(datum, xAxis))
        .attr('x2', datum => xFrom(datum, xAxis))
        .attr('stroke-width', spikesStyle.lineWidth)

    path
        .attr('x', margin.left)
        .attr('width', 0)

    return 0
}
