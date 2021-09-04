import {useChart} from "./hooks/useChart";
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

export enum TrackerLabelLocation {
    Nowhere,
    WithMouse,
    ByAxes
}

interface Props {
    visible: boolean
    labelLocation?: TrackerLabelLocation
    style?: Partial<TrackerStyle>,
    font?: Partial<TrackerLabelFont>,
    onTrackerUpdate?: (update: TrackerAxisUpdate) => void
}

/**
 * A tracker line that displays or reports the time at the mouse location. The tracker
 * handles single axes and dual axes.
 * @param props The tracker control properties
 * @return null component
 * @constructor
 */
export function Tracker(props: Props): null {
    const {
        visible,
        labelLocation = TrackerLabelLocation.WithMouse,
        style,
        font,
        onTrackerUpdate = noop
    } = props
    const {
        chartId,
        container,
        plotDimensions,
        margin,
        xAxesState,
    } = useChart()

    const trackerStyle = useMemo(() => ({...defaultTrackerStyle, ...style}), [style])
    const trackerFont = useMemo(() => ({...defaultTrackerLabelFont, ...font}), [font])
    const trackerRef = useRef<TrackerSelection>()

    const xAxisRef = useRef<Map<string, ContinuousNumericAxis>>(new Map())
    useEffect(
        () => {
            const axes = new Map<string, ContinuousNumericAxis>()
            xAxesState.axes.forEach((axis, id) => axes.set(id, axis as ContinuousNumericAxis))
            xAxisRef.current = axes
        },
        [xAxesState]
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
                        x => labelLocation === TrackerLabelLocation.Nowhere ?
                            '' :
                            `${d3.format(",.0f")(axis.scale.invert(x - margin.left))} ms`
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
                    labelLocation,
                    onTrackerUpdate,
                )
            }
            // if the tracker was defined, and is now no longer defined (i.e. props changed, then remove the tracker)
            else if (!visible && trackerRef.current !== undefined) {
                removeTrackerControl(svg)
                return undefined
            }
        },
        [chartId, container, margin, onTrackerUpdate, plotDimensions, labelLocation, trackerFont, trackerStyle]
    )

    // when the container, tracker-control function, or visibility change, then we need to update the
    // tracker control
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
