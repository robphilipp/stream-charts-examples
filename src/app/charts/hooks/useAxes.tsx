import {addAxisTo, AxesState, createAxesState} from "./AxesState";
import {BaseAxis} from "../axes";
import {AxesAssignment} from "../plot";
import {createContext, JSX, useContext, useRef} from "react";
import {ContinuousAxisRange} from "../continuousAxisRangeFor";
import {Dimensions} from "../margins";
import {usePlotDimensions} from "./usePlotDimensions";

/**
 * No operation function for use when a default function is needed
 */
const noop = () => {
    /* empty on purpose */
}

export type UseAxesValues = {
    /**
     * The x-axes state holds the currently set x-axes, manipulation and accessor functions
     */
    xAxesState: AxesState
    /**
     * Adds an x-axis to the axes and updates the internal state
     * @param axis The axis to add
     * @param id The ID of the axis to add
     */
    addXAxis: (axis: BaseAxis, id: string) => void
    /**
     * The y-axes state holds the currently set x-axes, manipulation and accessor functions
     */
    yAxesState: AxesState
    /**
     * Adds a y-axis to the axes and updates the internal state
     * @param axis The axis to add
     * @param id The ID of the axis to add
     */
    addYAxis: (axis: BaseAxis, id: string) => void
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
     * Retrieves the time range for the specified axis ID
     * @param axisId The ID of the axis for which to retrieve the time-range
     * @return The time-range as a `[t_start, t_end]` tuple if the axis ID is found, `undefined` otherwise
     */
    axisBoundsFor: (axisId: string) => [start: number, end: number] | undefined
    /**
     * Sets the time-range for the specified axis ID to the specified range
     * @param axisId The ID of the axis for which to set the range
     * @param timeRange The new time range as an `[t_start, t_end]` tuple
     */
    setAxisBoundsFor: (axisId: string, timeRange: [start: number, end: number]) => void
    /**
     * Callback function that is called when the time ranges change. The time ranges could
     * change because of a zoom action, a pan action, or as new data is streamed in.
     * @param times A `map(axis_id -> time_range)` that associates the axis ID with the
     * current time range.
     */
    updateAxesBounds: (times: Map<string, ContinuousAxisRange>) => void
    /**
     * Callback when the time range changes.
     * @param times The times (start, end) times for each axis in the plot. The times argument is a
     * map(axis_id -> (start, end)). Where start and end refer to the time-range for the
     * axis.
     * @return void
     */
    onUpdateAxesBounds?: (times: Map<string, [start: number, end: number]>) => void
    /**
     * Adds a handler for when the time is updated. The time could change because of a zoom action,
     * a pan action, or as new data is streamed in.
     * @param handlerId The unique ID of the handler to register/add
     * @param handler The handler function
     */
    addAxesBoundsUpdateHandler: (handlerId: string, handler: (updates: Map<string, ContinuousAxisRange>, plotDim: Dimensions) => void) => void
    /**
     * Removes the time-update handler with the specified ID
     * @param handlerId The ID of the handler to remove
     */
    removeAxesBoundsUpdateHandler: (handlerId: string) => void
}

export const defaultAxesValues = (): UseAxesValues => ({
    xAxesState: createAxesState(),
    yAxesState: createAxesState(),
    addXAxis: noop,
    addYAxis: noop,
    setAxisAssignments: noop,
    axisAssignmentsFor: () => ({xAxis: "", yAxis: ""}),
    axisBoundsFor: () => [NaN, NaN],
    setAxisBoundsFor: noop,
    updateAxesBounds: noop,
    addAxesBoundsUpdateHandler: () => noop,
    removeAxesBoundsUpdateHandler: () => noop,
})

// the context for axes
const AxesContext = createContext<UseAxesValues>(defaultAxesValues())

type Props = {
    /**
     * Callback when the time range changes.
     * @param times The times (start, end) times for each axis in the plot
     * @return void
     */
    onUpdateAxesBounds?: (times: Map<string, [start: number, end: number]>) => void
    children: JSX.Element | Array<JSX.Element>
}

/**
 * The React context provider for the {@link UseAxesValues}
 * @param props The properties
 * @return The children wrapped in this provider
 * @constructor
 */
export default function AxesProvider(props: Props): JSX.Element {
    const {onUpdateAxesBounds, children} = props

    const plotDimensions = usePlotDimensions()

    const xAxesRef = useRef<AxesState>(createAxesState())
    const yAxesRef = useRef<AxesState>(createAxesState())
    const axisAssignmentsRef = useRef<Map<string, AxesAssignment>>(new Map())
    const axesBoundsRef = useRef<Map<string, [start: number, end: number]>>(new Map())
    const axesBoundsUpdateHandlersRef = useRef<Map<string, (updates: Map<string, ContinuousAxisRange>, plotDim: Dimensions) => void>>(new Map())

    /**
     * Retrieves the x-axis and y-axis assignments for the specified series. If the axes does not have
     * an assignment, then is assumed to be using the default x- and y-axes.
     * @param seriesName The name of the series for which to retrieve the axes assignments
     * @return An {@link AxesAssignment} for the specified axes.
     */
    function axisAssignmentsFor(seriesName: string): AxesAssignment {
        return axisAssignmentsRef.current.get(seriesName) || {
            xAxis: xAxesRef.current.axisDefaultName(),
            yAxis: yAxesRef.current.axisDefaultName()
        }
    }

    /**
     * Called when the time is updated on one or more of the chart's axes (generally x-axes). In turn,
     * dispatches the update to all the internal time update handlers.
     * @param updates A map holding the axis ID to the updated axis time-range (i.e. map(axis_id, axis_time_range))
     */
    function updateAxesBounds(updates: Map<string, ContinuousAxisRange>): void {
        // update the current time-ranges reference
        updates.forEach((range, id) => axesBoundsRef.current.set(id, [range.start, range.end]))
        // dispatch the updates to all the registered handlers
        axesBoundsUpdateHandlersRef.current.forEach((handler, ) => handler(updates, plotDimensions.plotDimensions))
    }

    return <AxesContext.Provider
        value={{
            xAxesState: xAxesRef.current,
            yAxesState: yAxesRef.current,
            addXAxis: (axis, id) => xAxesRef.current = addAxisTo(xAxesRef.current, axis, id),
            addYAxis: (axis, id) => yAxesRef.current = addAxisTo(yAxesRef.current, axis, id),
            setAxisAssignments: assignments => axisAssignmentsRef.current = assignments,
            axisAssignmentsFor: seriesName => axisAssignmentsFor(seriesName),
            axisBoundsFor: axisId => axesBoundsRef.current.get(axisId),
            setAxisBoundsFor: ((axisId, timeRange) => axesBoundsRef.current.set(axisId, timeRange)),
            updateAxesBounds,
            onUpdateAxesBounds,
            addAxesBoundsUpdateHandler: (handlerId, handler) => axesBoundsUpdateHandlersRef.current.set(handlerId, handler),
            removeAxesBoundsUpdateHandler: handlerId => axesBoundsUpdateHandlersRef.current.delete(handlerId),
        }}
    >
        {children}
    </AxesContext.Provider>
}

/**
 * React hook that sets up the React context for the chart values.
 * @return The {@link UseAxesValues} held in the React context.
 */
export function useAxes(): UseAxesValues {
    const context = useContext<UseAxesValues>(AxesContext)
    const {xAxesState} = context
    if (xAxesState === undefined || xAxesState === null) {
        throw new Error("useAxes can only be used when the parent is a <AxesProvider/>")
    }
    return context
}
