import {useChart} from "./useChart";
import {SvgSelection, TrackerSelection} from "./d3types";
import {
    createTrackerControl, defaultTrackerLabelFont,
    defaultTrackerStyle,
    removeTrackerControl,
    TrackerLabelFont,
    TrackerStyle
} from "./trackerUtils";
import * as d3 from "d3";
import {useCallback, useEffect, useMemo, useRef} from "react";
import {ContinuousNumericAxis} from "./axes";


interface Props {
    visible: boolean
    style?: Partial<TrackerStyle>,
    font?: Partial<TrackerLabelFont>,
    onChange?: (time: number) => void
}

export function Tracker(props: Props): null {
    const {
        visible,
        style,
        font
    } = props
    const {
        chartId,
        container,
        plotDimensions,
        margin,
        xAxes,
    } = useChart()

    const trackerStyle = useMemo(() => ({...defaultTrackerStyle, ...style}), [style])
    const trackerFont = useMemo(() => ({...defaultTrackerLabelFont, ...font}), [font])

    // todo temporary: need to show label for (possibly) both x-axis
    const xAxisRef = useRef<ContinuousNumericAxis>()
    useEffect(
        () => {
            const axes = Array.from(xAxes().values())
            if (axes.length > 0) {
                xAxisRef.current = axes[0] as ContinuousNumericAxis
            }
        },
        [xAxes]
    )

    const trackerControl = useCallback(
        /**
         * Creates the SVG elements for displaying a tracker line
         * @param svg The SVG selection
         * @param visible `true` if the tracker is visible; `false` otherwise
         * @return The tracker selection if visible; otherwise undefined
         */
        (svg: SvgSelection, visible: boolean): TrackerSelection | undefined => {
            if (visible && container) {
                const timeFrom = (x: number) => xAxisRef.current !== undefined ?
                    xAxisRef.current.scale.invert(x - margin.left) :
                    0

                return createTrackerControl(
                    chartId,
                    container,
                    svg,
                    plotDimensions,
                    margin,
                    trackerStyle,
                    trackerFont,
                    x => `${d3.format(",.0f")(timeFrom(x))} ms`
                )
            }
            // if the magnifier was defined, and is now no longer defined (i.e. props changed, then remove the magnifier)
            else if (!visible && trackerRef.current) {// || tooltipRef.current.visible) {
                removeTrackerControl(svg)
                return undefined
            }
        },
        [chartId, container, margin, plotDimensions, trackerFont, trackerStyle]
    )

    const trackerRef = useRef<TrackerSelection>()
    useEffect(
        () => {
            if (container) {
                const svg = d3.select<SVGSVGElement, any>(container)
                trackerRef.current = trackerControl(svg, visible)
            }
        },
        [container, trackerControl, visible]
    )

    return null
}