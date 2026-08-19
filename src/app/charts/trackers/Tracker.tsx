import {noop} from "../utils";
import {useChart} from "../hooks/useChart";
import {
    defaultTrackerLabelFont,
    defaultTrackerStyle,
    trackerControlInstance,
    type TrackerLabelFont,
    TrackerLabelLocation,
    type TrackerStyle
} from "./trackerUtils";
import * as d3 from "d3";
import {useEffect, useMemo, useRef} from "react";
import {AxisLocation, type BaseAxis, type ContinuousNumericAxis} from "../axes/axes";
import {usePlotDimensions} from "../hooks/usePlotDimensions";

export interface TrackerAxisInfo {
    x: number
    axisLocation: AxisLocation
}

// map(axis_id -> tracker_axis_info)
export type TrackerAxisUpdate = Map<string, TrackerAxisInfo>

export interface Props {
    visible: boolean
    trackerAxis?: AxisLocation
    labelLocation?: TrackerLabelLocation
    labelFormatter?: (value: number) => string
    style?: Partial<TrackerStyle>,
    font?: Partial<TrackerLabelFont>,
    onTrackerUpdate?: (update: TrackerAxisUpdate) => void
}

/**
 * A tracker line that displays or reports the x or y coordinates at the mouse location. The tracker
 * handles single axes and dual axes. Internally, this registers a draw function with the chart's
 * canvas context (see `trackerUtils.ts`) rather than creating/updating SVG elements.
 * @param props The tracker control properties
 * @return null component
 */
export function Tracker(props: Props): null {
    const {
        visible,
        trackerAxis = AxisLocation.Bottom,
        labelLocation = TrackerLabelLocation.ByAxis,
        labelFormatter,
        style,
        font,
        onTrackerUpdate = noop
    } = props
    const {
        chartId,
        canvasContext,
        axes,
        backgroundColor
    } = useChart()

    const {xAxesState, yAxesState} = axes
    const axisState = (trackerAxis === AxisLocation.Bottom || trackerAxis === AxisLocation.Top) ?
        xAxesState :
        yAxesState

    const {plotDimensions, margin} = usePlotDimensions()

    const trackerStyle = useMemo(() => ({...defaultTrackerStyle, ...style}), [style])
    const trackerFont = useMemo(() => ({...defaultTrackerLabelFont, ...font}), [font])
    // holds the cleanup function returned by `trackerControlInstance`, replacing the old
    // `TrackerSelection` ref
    const trackerCleanupRef = useRef<(() => void) | undefined>(undefined)

    const axisRef = useRef<Map<string, ContinuousNumericAxis>>(new Map())
    useEffect(
        () => {
            const axes = new Map<string, ContinuousNumericAxis>()
            axisState.axes.forEach((axis: BaseAxis, id: string) => axes.set(id, axis as ContinuousNumericAxis))
            axisRef.current = axes
        },
        [axisState]
    )

    // when the canvas context, tracker-control function, or visibility change, then we need to
    // update the tracker control
    useEffect(
        () => {
            if (canvasContext) {
                if (visible) {
                    // if a tracker was already registered (e.g. from a prior render with
                    // different props), tear it down before registering the new one
                    if (trackerCleanupRef.current !== undefined) {
                        trackerCleanupRef.current()
                        trackerCleanupRef.current = undefined
                    }

                    const trackerLabels = new Map<ContinuousNumericAxis, (x: number) => string>(
                        Array.from(axisRef.current.values()).map(axis => {
                            const formatter = labelFormatter ??
                                ((value: number) => labelLocation === TrackerLabelLocation.Nowhere ?
                                    "" :
                                    `${d3.format(",.0f")(value)}`
                                )
                            return [axis, formatter]
                        })
                    )

                    trackerCleanupRef.current = trackerControlInstance(
                        canvasContext,
                        chartId,
                        plotDimensions,
                        margin,
                        trackerStyle,
                        trackerFont,
                        trackerLabels,
                        labelLocation,
                        onTrackerUpdate,
                        trackerAxis,
                        backgroundColor
                    )
                }
                // if the tracker was defined and is now no longer defined (i.e., props changed, then remove the tracker)
                else if (!visible && trackerCleanupRef.current !== undefined) {
                    trackerCleanupRef.current()
                    trackerCleanupRef.current = undefined
                }
            }
        },
        [backgroundColor, chartId, canvasContext, labelFormatter, labelLocation, margin, onTrackerUpdate, plotDimensions, trackerAxis, trackerFont, trackerStyle, visible]
    )

    // unregister the tracker when this component unmounts
    useEffect(
        () => {
            return () => {
                if (trackerCleanupRef.current !== undefined) {
                    trackerCleanupRef.current()
                    trackerCleanupRef.current = undefined
                }
            }
        },
        []
    )

    return null
}
