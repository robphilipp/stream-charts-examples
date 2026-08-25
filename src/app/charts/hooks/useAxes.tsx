import {AxesState} from "../axes/AxesState";
import type {BaseAxis} from "../axes/axes";
import type {AxesAssignment} from "../plots/plot";
import {createContext, useContext} from "react";
import type {Dimensions} from "../styling/margins";
import {BaseAxisRange} from "../axes/BaseAxisRange";
import {AxisInterval} from "../axes/AxisInterval";
import {Optional} from "result-fn";
import {defaultAxesValues} from "./defaultAxesValues";

/**
 * The values exposed by the hook
 * @template AR The type of the axis range (e.g. {@link ContinuousAxisRange} or {@link OrdinalAxisRange})
 * @template A The axis type
 */
export type UseAxesValues<AR extends BaseAxisRange, A extends BaseAxis> = {
    /**
     * The x-axes state holds the currently set x-axes, manipulation and accessor functions
     */
    xAxesState: AxesState<A>
    /**
     * Adds an x-axis to the axes and updates the internal state
     * @param axis The axis to add
     * @param id The ID of the axis to add
     * @param range The initial axis range (start, end)
     */
    addXAxis: (axis: A, id: string, range?: AR) => void
    /**
     * The y-axes state holds the currently set x-axes, manipulation and accessor functions
     */
    yAxesState: AxesState<A>
    /**
     * Adds a y-axis to the axes and updates the internal state
     * @param axis The axis to add
     * @param id The ID of the axis to add
     * @param range The initial axis range (start, end)
     */
    addYAxis: (axis: A, id: string, range?: AR) => void
    /**
     * Sets the axis assigned to each series. This should contain **all** the series used in
     * the chart.
     * @param assignments The assignment of the series to their axes
     */
    setAxisAssignments: (assignments: Map<string, AxesAssignment>) => void
    /**
     * Retrieves the axis assigned to the specified series
     * @return The axes assigned to the specified series
     */
    axisAssignmentsFor: (seriesName: string) => AxesAssignment
    /**
     * Sets the axis ranges specified in the input map
     * @param ranges A map holding the axis ID to the axis range
     */
    setAxesRanges: (ranges: Map<string, AR>) => void
    /**
     * Sets the axis range for the specified axis ID
     * @param axisId The ID of the axis for which to set the range
     * @param range The new axis range
     */
    setAxisRangeFor: (axisId: string, range: AR) => void
    /**
     * Retrieves the current axis range for the specified axis ID
     * @param axisId The ID of the axis for which to retrieve the range
     * @return The current axis range for the specified axis ID wrapped
     * in a n {@link Optional}, or an empty {@link Optional} if the axis
     * ID is not found
     */
    axisRangeFor: (axisId: string) => Optional<AR>
    /**
     * Sets the domain (interval) for the specified axis ID to the specified range
     * @param axisId The ID of the axis for which to set the range
     * @param domain The new domain as a `[start: number, end: number]` tuple
     */
    setAxisIntervalFor: (axisId: string, domain: AxisInterval) => void
    /**
     * Sets the original axis bounds for the specified axis ID to the specified range
     * @param axisId The ID of the axis for which to set the range
     * @param range The new range as a `[start, end]` tuple
     */
    setOriginalAxisIntervalFor: (axisId: string, range: AxisInterval) => void
    /**
     * Callback function that is called when the time ranges change. The time ranges could
     * change because of a zoom action, a pan action, or as new data is streamed in.
     * @param domains A `map(axis_id -> domain)` that associates the axis ID with the
     * current time range.
     */
    updateAxisRanges: (domains: Map<string, AR>) => void
    /**
     * Retrieves the current axis bounds for the specified axis ID
     * @return The current axis bounds as a map(axis_id, (start, end))
     */
    axesRanges: () => Map<string, AR>
    /**
     * Resets the axis bounds to its original bounds
     * @param axisId The ID of the axis
     * @param [axisBounds] An optional bounds that resets the original bounds
     */
    resetAxisIntervalFor: (axisId: string, axisBounds?: AxisInterval) => void
    /**
     * Resets all the axes bound to the original bounds
     * @param [axesBounds] An optional map holds the new bounds for specified axes. The map
     * associates an axis ID with the new bounds.
     */
    resetAxesRanges: (axesBounds?: Map<string, AR>) => void
    /**
     * Callback when the time range changes.
     * @param times The times (start, end) times for each axis in the plot. The `times` argument is a
     * map(axis_id -> (start, end)). Where start and end refer to the time-range for the
     * axis.
     * @return void
     */
    onUpdateAxesInterval?: (times: Map<string, AxisInterval>) => void
    /**
     * Adds a handler for when the axes are updated. An axis domain/range could change because of a zoom action,
     * a pan action, or as new data is streamed in.
     * @param handlerId The unique ID of the handler to register/add
     * @param handler The handler function that accepts a map of updates and a plot dimension
     */
    addAxesRangesUpdateHandler: (handlerId: string, handler: (updates: Map<string, AR>, plotDim: Dimensions) => void) => void
    /**
     * Removes the axis-update handler with the specified ID
     * @param handlerId The ID of the handler to remove
     */
    removeAxesRangesUpdateHandler: (handlerId: string) => void
}

// the context is generic over the same type parameters as `UseAxesValues`, but a context
// object can't itself carry unbound generics -- `useAxes` below casts it back to the caller's
// concrete types, which is safe because `<AxesProvider/>` is what actually supplies the value
export const AxesContext = createContext<unknown>(defaultAxesValues())

/**
 * React hook that sets up the React context for the chart values.
 * @return The {@link UseAxesValues} held in the React context.
 * @template AR The type of the axis range (e.g. {@link ContinuousAxisRange} or {@link OrdinalAxisRange})
 * @template A The axis type
 */
export function useAxes<AR extends BaseAxisRange, A extends BaseAxis>(): UseAxesValues<AR, A> {
    const context = useContext(AxesContext) as UseAxesValues<AR, A>
    const {xAxesState} = context
    if (xAxesState === undefined || xAxesState === null) {
        throw new Error("useAxes can only be used when the parent is a <AxesProvider/>")
    }
    return context
}
