import {defaultTooltipStyle, TooltipStyle} from "./TooltipStyle";
import {useEffect, useMemo} from "react";
import {TooltipDimensions, tooltipX, tooltipY} from "./tooltipUtils";
import {Dimensions, Margin} from "./margins";
import * as d3 from "d3";
import {Datum} from "./datumSeries";
import {useChart} from "./useChart";

export interface Props {
    visible: boolean
    style?: Partial<TooltipStyle>
    // dimensions: TooltipDimensions
}

export function Tooltip(props: Props): null {
    const {
        chartId,
        container,
        margin,
        plotDimensions,
        registerMouseOverHandler,
        unregisterMouseOverHandler,
        tooltipContentProvider
    } = useChart()

    const {
        visible,
        style
    } = props

    const tooltipStyle = useMemo(() => ({...defaultTooltipStyle, ...style}), [style])

    useEffect(
        () => {
            if (visible && container) {
                const contentProvider = tooltipContentProvider()
                if (contentProvider) {
                    registerMouseOverHandler(
                        `tooltip-${chartId}`,
                        ((seriesName, time, series) => createTooltip(
                            `r${time}-${seriesName}-${chartId}`,
                            container,
                            margin,
                            tooltipStyle,
                            plotDimensions,
                            () => contentProvider(seriesName, time, series)
                        ))
                    )
                }
            }
            return () => unregisterMouseOverHandler(`tooltip-${chartId}`)
        },
        [
            chartId, container, margin, plotDimensions,
            registerMouseOverHandler, tooltipContentProvider, tooltipStyle,
            unregisterMouseOverHandler, visible
        ]
    )


    return null
}

/**
 * Renders a tooltip showing the neuron, spike time, and the spike strength when the mouse hovers over a spike.
 * @param tooltipId A unique ID for the tooltip
 * @param container The container holding the SVG element
 * @param margin The margin around the plot
 * @param tooltipStyle The tooltip style information
 * @param plotDimensions The dimensions of the plot
 * @param tooltipContent Function that adds the tooltip content and then returns the width and height of
 * the content. The callback function is handed the datum, svg path element, and the series name and must
 * return a {@link TooltipDimension} object that holds the width and height of the content.
 */
function createTooltip(
    tooltipId: string,
    container: SVGSVGElement,
    margin: Margin,
    tooltipStyle: TooltipStyle,
    plotDimensions: Dimensions,
    tooltipContent: () => TooltipDimensions
): void {

    // create the rounded rectangle for the tooltip's background
    const rect = d3.select<SVGSVGElement | null, any>(container)
        .append<SVGRectElement>('rect')
        .attr('id', tooltipId)
        .attr('class', 'tooltip')
        .attr('rx', tooltipStyle.borderRadius)
        .attr('fill', tooltipStyle.backgroundColor)
        .attr('fill-opacity', tooltipStyle.backgroundOpacity)
        .attr('stroke', tooltipStyle.borderColor)
        .attr('stroke-width', tooltipStyle.borderWidth)

    // call the callback to add the content
    const {contentWidth, contentHeight} = tooltipContent()

    // set the position, width, and height of the tooltip rect based on the text height and width and the padding
    const [x, y] = d3.mouse(container)
    rect.attr('x', () => tooltipX(x, contentWidth, plotDimensions, tooltipStyle, margin))
        .attr('y', () => tooltipY(y, contentHeight, plotDimensions, tooltipStyle, margin))
        .attr('width', contentWidth + tooltipStyle.paddingLeft + tooltipStyle.paddingRight)
        .attr('height', contentHeight + tooltipStyle.paddingTop + tooltipStyle.paddingBottom)

}

/**
 * Removes the tooltip when the mouse has moved away from the spike
 */
function removeTooltip() {
    d3.selectAll<SVGPathElement, Datum>('.tooltip').remove()
}
