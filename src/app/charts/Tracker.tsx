import {useChart} from "./useChart";
import {SvgSelection, TrackerSelection} from "./d3types";
import {
    defaultTrackerLabelFont,
    defaultTrackerStyle,
    removeTrackerControl,
    trackerControlInstance,
    TrackerLabelFont,
    TrackerStyle
} from "./trackerUtils";
import * as d3 from "d3";
import {useCallback, useEffect, useMemo, useRef} from "react";
import {AxisLocation, ContinuousNumericAxis} from "./axes";
import {noop} from "./utils";

export interface TrackerAxisInfo {
    x: number
    axisLocation: AxisLocation
}

// export interface TrackerSeriesInfo {
//     before: Datum
//     after: Datum
//     axisInfo: TrackerAxisInfo
// }

// map(axis_id -> tracker_axis_info)
export type TrackerAxisUpdate = Map<string, TrackerAxisInfo>
// map(series_id -> tracker_info)
// export type TrackerUpdate = Map<string, TrackerSeriesInfo>

interface Props {
    visible: boolean
    style?: Partial<TrackerStyle>,
    font?: Partial<TrackerLabelFont>,
    onTrackerUpdate?: (update: TrackerAxisUpdate) => void
}

export function Tracker(props: Props): null {
    const {
        visible,
        style,
        font,
        onTrackerUpdate = noop
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

    const xAxisRef = useRef<Map<string, ContinuousNumericAxis>>(new Map())
    useEffect(
        () => {
            const axes = new Map<string, ContinuousNumericAxis>()
            xAxes().forEach((axis, id) => axes.set(id, axis as ContinuousNumericAxis))
            xAxisRef.current = axes
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
                const trackerLabels = new Map<ContinuousNumericAxis, (x: number) => string>(
                    Array.from(xAxisRef.current.values()).map(axis => [
                        axis,
                        x => `${d3.format(",.0f")(axis.scale.invert(x - margin.left))} ms`
                    ])
                )

                return trackerControlInstance(
                    chartId,
                    container,
                    svg,
                    plotDimensions,
                    margin,
                    trackerStyle,
                    trackerFont,
                    trackerLabels,
                    onTrackerUpdate,
                )
            }
            // if the magnifier was defined, and is now no longer defined (i.e. props changed, then remove the magnifier)
            else if (!visible && trackerRef.current) {
                removeTrackerControl(svg)
                return undefined
            }
        },
        [chartId, container, margin, onTrackerUpdate, plotDimensions, trackerFont, trackerStyle]
    )

    const trackerRef = useRef<TrackerSelection>()
    useEffect(
        () => {
            if (container && trackerRef.current === undefined) {
                const svg = d3.select<SVGSVGElement, any>(container)
                trackerRef.current = trackerControl(svg, visible)
            }
        },
        [container, trackerControl, visible]
    )

    return null
}

// function onTrackerAxisUpdate(update: TrackerAxisUpdate): void {
//     console.dir(update)
// }
