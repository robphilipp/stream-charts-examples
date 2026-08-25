import {AxisInterval} from "../axes/AxisInterval";
import {type JSX, useRef, useState} from "react";
import {BaseAxisRange} from "../axes/BaseAxisRange";
import type {BaseAxis} from "../axes/axes";
import {usePlotDimensions} from "./usePlotDimensions";
import {AxesState} from "../axes/AxesState";
import type {AxesAssignment} from "../plots/plot";
import type {Dimensions} from "../styling/margins";
import {Optional} from "result-fn";
import {AxesContext, type UseAxesValues} from "./useAxes";

export type Props = {
    /**y
     * Callback when axes bounds change.
     * @param ranges The ranges (start, end) for each axis in the plot
     */
    onUpdateAxesInterval?: (ranges: Map<string, AxisInterval>) => void

    children: JSX.Element | Array<JSX.Element>
}
/**
 * The React context provider for the {@link UseAxesValues}
 * @param props The properties
 * @return The children wrapped in this provider
 * @template AR The type of the axis range (e.g. {@link ContinuousAxisRange} or {@link OrdinalAxisRange})
 * @template A The axis type
 */
export default function AxesProvider<AR extends BaseAxisRange, A extends BaseAxis>(props: Props): JSX.Element {
    const {onUpdateAxesInterval, children} = props

    const plotDimensions = usePlotDimensions()

    const [xAxesState, setXAxesState] = useState<AxesState<A>>(AxesState.empty<A>())
    const [yAxesState, setYAxesState] = useState<AxesState<A>>(AxesState.empty<A>())
    const axisAssignmentsRef = useRef<Map<string, AxesAssignment>>(new Map())
    const axesBoundsUpdateHandlersRef = useRef<Map<string, (updates: Map<string, AR>, plotDim: Dimensions) => void>>(new Map())
    const axesRangeRef = useRef<Map<string, AR>>(new Map())

    /**
     * Retrieves the x-axis and y-axis assignments for the specified series. If the axis does not have
     * an assignment, then we assume it is using the default x- and y-axes.
     * @param seriesName The name of the series for which to retrieve the axes assignments
     * @return An {@link AxesAssignment} for the specified axes.
     */
    function axisAssignmentsFor(seriesName: string): AxesAssignment {
        return axisAssignmentsRef.current.get(seriesName) || {
            xAxis: xAxesState.axisDefaultId().getOrElse(""),
            yAxis: yAxesState.axisDefaultId().getOrElse("")
        }
    }

    /**
     * Called when the domain/range is updated on one or more of the chart's axes (generally x-axes). In turn,
     * dispatches the update to all the internal domain/range update handlers.
     * @param updates A map holding the axis ID to the updated axis time-range (i.e., map(axis_id, axis_time_range))
     */
    function updateAxisRanges(updates: Map<string, AR>): void {
        // update the current time-ranges reference
        updates.forEach((range, id) => {
            axesRangeRef.current.set(id, range)
        })
        // dispatch the updates to all the registered handlers
        axesBoundsUpdateHandlersRef.current
            .forEach((handler,) => handler(updates, plotDimensions.plotDimensions))
    }

    /**
     * Sets the axis ranges specified in the input map
     * @param ranges The ranges to set
     */
    function setAxesRanges(ranges: Map<string, AR>): void {
        ranges.forEach((range, id) => {
            axesRangeRef.current.set(id, range)
        })
    }

    /**
     * Sets the axis range for the specified axis ID
     * @param axisId The axis ID
     * @param range The range to set
     */
    function setAxisRangeFor(axisId: string, range: AR): void {
        axesRangeRef.current.set(axisId, range)
    }

    /**
     * Sets the axis bounds for the specified axis ID. Note that this does not
     * change the original axis interval
     * @param axisId The axis ID
     * @param interval The interval
     */
    function setAxisIntervalFor(axisId: string, interval: AxisInterval): void {
        Optional.ofNullable(axesRangeRef.current.get(axisId))
            .map(range => range.update(interval.start, interval.end) as AR)
            .ifPresent(updatedRange => axesRangeRef.current.set(axisId, updatedRange))
    }

    /**
     * Sets the original axis interval for the axis range
     * @param axisId The axis ID
     * @param interval The interval to which to set the origin interval
     */
    function setOriginalAxisIntervalFor(axisId: string, interval: AxisInterval): void {
        Optional.ofNullable(axesRangeRef.current.get(axisId))
            .map(range => range.updateOriginal(interval.start, interval.end) as AR)
            .ifPresent(updatedRange => axesRangeRef.current.set(axisId, updatedRange))
    }

    /**
     * Resets the bounds for the specified axis to the original range
     * @param axisId The ID of the axis
     */
    function resetAxisIntervalFor(axisId: string): void {
        Optional
            .ofNullable(axesRangeRef.current.get(axisId))
            .map(range => new Map<string, AR>([[axisId, range]]))
            .ifPresent(updates => updateAxisRanges(updates))
    }

    /**
     * Resets the bounds of all the axes to their original value or to the values specified
     * in the optional bounds map.
     * @param [axesRanges=new Map()] An optional map holds bounds for specified axes. The map
     * associates an axis ID with the new bounds.
     */
    function resetAxesRanges(axesRanges: Map<string, AR> = new Map()): void {
        updateAxisRanges(axesRanges)
    }

    /**
     * Adds a handler to deal with updates to the bounds of the axes
     * @param handlerId the unique ID of the handler
     * @param handler The handler function that accepts a map of updates and a plot dimension
     * @return A map with all the handlers
     */
    function addAxesRangesUpdateHandler(
        handlerId: string,
        handler: (updates: Map<string, AR>, plotDim: Dimensions) => void
    ): Map<string, (updates: Map<string, AR>, plotDim: Dimensions) => void> {
        if (axesBoundsUpdateHandlersRef.current.has(handlerId)) {
            throw new Error(
                `Handler with ID already exists, please remove it before adding it; ` +
                `handler_id: ${handlerId}; ` +
                `existing_handler_ids: [${Array.from(axesBoundsUpdateHandlersRef.current.keys()).join(", ")}]`
            )
        }
        return axesBoundsUpdateHandlersRef.current.set(handlerId, handler)
    }

    // the context's `value` prop is typed as `unknown` (see `AxesContext` in `useAxes.tsx`), so
    // the object literal needs its own explicit type here to give the handler functions below
    // their parameter types -- otherwise they'd fall back to implicit `any`
    const value: UseAxesValues<AR, A> = {
        xAxesState,
        yAxesState,
        addXAxis: (axis, id, range) => {
            setXAxesState(xAxesState.addAxis(axis, id))
            if (range !== undefined) {
                axesRangeRef.current.set(id, range)
            }
        },
        addYAxis: (axis, id, range) => {
            setYAxesState(yAxesState.addAxis(axis, id))
            if (range !== undefined) {
                axesRangeRef.current.set(id, range)
            }
        },
        setAxisAssignments: assignments => axisAssignmentsRef.current = assignments,
        axisAssignmentsFor: seriesName => axisAssignmentsFor(seriesName),
        updateAxisRanges,
        axesRanges: () => new Map<string, AR>(axesRangeRef.current),
        axisRangeFor: axisId => Optional.ofNullable(axesRangeRef.current.get(axisId)),
        setAxesRanges,
        setAxisRangeFor,
        setAxisIntervalFor,
        setOriginalAxisIntervalFor,
        resetAxesRanges,
        resetAxisIntervalFor,
        onUpdateAxesInterval,
        addAxesRangesUpdateHandler,
        removeAxesRangesUpdateHandler: handlerId => axesBoundsUpdateHandlersRef.current.delete(handlerId),
    }

    return <AxesContext.Provider value={value}>
        {children}
    </AxesContext.Provider>
}