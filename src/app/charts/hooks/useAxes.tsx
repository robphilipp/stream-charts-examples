import {AxesState} from "./AxesState";
import {BaseAxis} from "../axes/axes";
import {AxesAssignment} from "../plots/plot";
import {createContext, JSX, useContext, useRef} from "react";
import {Dimensions} from "../styling/margins";
import {usePlotDimensions} from "./usePlotDimensions";
import {BaseAxisRange} from "../axes/BaseAxisRange";
import {AxisInterval, copyRangeMap} from "../axes/AxisInterval";
import {Optional} from "result-fn";

/**
 * No operation function for use when a default function is needed
 */
const noop = () => {
    /* empty on purpose */
}

/**
 * Type definition for an axis-range provider function. This type defines a function that
 * takes a start and end value and returns an axis range.
 * @template AR The type of the axis range (e.g. {@link ContinuousAxisRange} or {@link OrdinalAxisRange})
 * @param start The start value of the axis range
 * @param end The end value of the axis range
 * @return The axis range tuple
 */
type AxisRangeProvider<AR extends BaseAxisRange> = (start: number, end: number) => AR

/**
 * The values exposed by the hook
 * @template AR The type of the axis range (e.g. {@link ContinuousAxisRange} or {@link OrdinalAxisRange})
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
     * @param domain The initial axis range (start, end)
     */
    addXAxis: (axis: A, id: string, range?: AxisInterval) => void
    /**
     * The y-axes state holds the currently set x-axes, manipulation and accessor functions
     */
    yAxesState: AxesState<A>
    /**
     * Adds a y-axis to the axes and updates the internal state
     * @param axis The axis to add
     * @param id The ID of the axis to add
     * @param domain The initial axis range (start, end)
     */
    addYAxis: (axis: A, id: string, range?: AxisInterval) => void
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
     * Retrieves the axis range for the specified axis ID
     * @param axisId The ID of the axis for which to retrieve the axis-range
     * @return The axis-range as a `[start, end]` tuple if the axis ID is found, `undefined` otherwise
     */
    axisBoundsFor: (axisId: string) => AxisInterval
    /**
     * Retrieves the original axis range for the specified axis ID
     * @param axisId The ID of the axis for which to retrieve the axis-range
     * @return The axis-range as a `[start, end]` tuple if the axis ID is found, `undefined` otherwise
     */
    originalAxisBoundsFor: (axisId: string) => AxisInterval
    /**
     * Sets the original axis bounds for the specified axis ID to the specified range
     * @param axisId The ID of the axis for which to set the range
     * @param range The new range as a `[start, end]` tuple
     */
    setOriginalAxisBoundsFor: (axisId: string, range: AxisInterval) => void
    /**
     * @param axisId The ID of the axis for which to set the range
     * @return The original axis bounds as a map(axis_id, (start, end))
     */
    originalAxesBounds: () => Map<string, AxisInterval>
    /**
     * Sets the domain (interval) for the specified axis ID to the specified range
     * @param axisId The ID of the axis for which to set the range
     * @param domain The new domain as a `[start: number, end: number]` tuple
     */
    setAxisBoundsFor: (axisId: string, domain: AxisInterval) => void
    /**
     * Sets the original bounds for the specified axis to the specified range.
     * This function is helpful when the axis ranges are changing in response to a
     * domain change or window resizing (ordinal axes), and the original bounds need to
     * reflect that change.
     * @param axisId The ID of the axis
     * @param axisRangeProvider The axis range provider for the axis
     * @param axisRange The range to which to set the original axis range
     */
    setOriginalAxesBounds: (axisId: string, axisRangeProvider: AxisRangeProvider<AR>, axisRange: AxisInterval) => void
    /**
     * Callback function that is called when the time ranges change. The time ranges could
     * change because of a zoom action, a pan action, or as new data is streamed in.
     * @param domains A `map(axis_id -> domain)` that associates the axis ID with the
     * current time range.
     */
    updateAxesBounds: (domains: Map<string, AR>) => void
    /**
     * Retrieves the current axis bounds for the specified axis ID
     * @return The current axis bounds as a map(axis_id, (start, end))
     */
    axesBounds: () => Map<string, AR>
    /**
     * Resets the axis bounds to its original bounds
     * @param axisId The ID of the axis
     * @param axisRangeProvider The axis range provider for the axis
     * @param [axisBounds] An optional bounds that resets the original bounds
     */
    resetAxisBoundsFor: (axisId: string, axisRangeProvider: AxisRangeProvider<AR>, axisBounds?: AxisInterval) => void
    /**
     * Resets all the axes bound to the original bounds
     * @param axisRangeProviders The axis range providers for the axes
     * @param [axesBounds] An optional map holds the new bounds for specified axes. The map
     * associates an axis ID with the new bounds.
     */
    resetAxesBounds: (axisRangeProviders: Map<string, AxisRangeProvider<AR>>, axesBounds?: Map<string, AxisInterval>) => void
    /**
     * Callback when the time range changes.
     * @param times The times (start, end) times for each axis in the plot. The `times` argument is a
     * map(axis_id -> (start, end)). Where start and end refer to the time-range for the
     * axis.
     * @return void
     */
    onUpdateAxesBounds?: (times: Map<string, AxisInterval>) => void
    /**
     * Adds a handler for when the axes are updated. An axis domain/range could change because of a zoom action,
     * a pan action, or as new data is streamed in.
     * @param handlerId The unique ID of the handler to register/add
     * @param handler The handler function that accepts a map of updates and a plot dimension
     */
    addAxesBoundsUpdateHandler: (handlerId: string, handler: (updates: Map<string, AR>, plotDim: Dimensions) => void) => void
    /**
     * Removes the axis-update handler with the specified ID
     * @param handlerId The ID of the handler to remove
     */
    removeAxesBoundsUpdateHandler: (handlerId: string) => void
}

export const defaultAxesValues = (): UseAxesValues<any, any> => ({
    xAxesState: AxesState.empty(),
    yAxesState: AxesState.empty(),
    addXAxis: noop,
    addYAxis: noop,
    setAxisAssignments: noop,
    axisAssignmentsFor: () => ({xAxis: "", yAxis: ""}),
    axisBoundsFor: () => AxisInterval.empty(),
    originalAxisBoundsFor: () => AxisInterval.empty(),
    setOriginalAxesBounds: noop,
    setOriginalAxisBoundsFor: noop,
    originalAxesBounds: () => new Map<string, AxisInterval>(),
    setAxisBoundsFor: noop,
    updateAxesBounds: noop,
    axesBounds: () => new Map<string, any>(),
    resetAxisBoundsFor: noop,
    resetAxesBounds: noop,
    addAxesBoundsUpdateHandler: () => noop,
    removeAxesBoundsUpdateHandler: () => noop,
})

// the context for axes
const AxesContext = createContext<UseAxesValues<any, any>>(defaultAxesValues())

type Props = {
    /**y
     * Callback when axes bounds change.
     * @param ranges The ranges (start, end) for each axis in the plot
     */
    onUpdateAxesBounds?: (ranges: Map<string, AxisInterval>) => void

    children: JSX.Element | Array<JSX.Element>
}

/**
 * The React context provider for the {@link UseAxesValues}
 * @param props The properties
 * @return The children wrapped in this provider
 * @constructor
 */
export default function AxesProvider<AR extends BaseAxisRange, A extends BaseAxis>(props: Props): JSX.Element {
    const {onUpdateAxesBounds, children} = props

    const plotDimensions = usePlotDimensions()

    const xAxesStateRef = useRef<AxesState<A>>(AxesState.empty<A>())
    const yAxesStateRef = useRef<AxesState<A>>(AxesState.empty<A>())
    const axisAssignmentsRef = useRef<Map<string, AxesAssignment>>(new Map())
    // todo remove axesBoundRef and originalAxesBoundRef and switch to using axesRangeRef instead
    // holds the current axis bounds, map(axis_id -> (start, end)
    const axesBoundsRef = useRef<Map<string, AxisInterval>>(new Map())
    // holds the original axis bounds, map(axis_id -> (start, end)
    const originalAxesBoundsRef =  useRef<Map<string, AxisInterval>>(new Map())
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
            xAxis: xAxesStateRef.current.axisDefaultId(),
            yAxis: yAxesStateRef.current.axisDefaultId()
        }
    }

    /**
     * Called when the domain/range is updated on one or more of the chart's axes (generally x-axes). In turn,
     * dispatches the update to all the internal domain/range update handlers.
     * @param updates A map holding the axis ID to the updated axis time-range (i.e., map(axis_id, axis_time_range))
     */
    function updateAxesBounds(updates: Map<string, AR>): void {
        // update the current time-ranges reference
        updates.forEach((range, id) => {
            axesBoundsRef.current.set(id, range.current)
            axesRangeRef.current.set(id, range)
        })
        // dispatch the updates to all the registered handlers
        axesBoundsUpdateHandlersRef.current.forEach((handler, ) => handler(updates, plotDimensions.plotDimensions))
    }

    /**
     * Sets the original bounds for the specified axis to the specified range.
     * This function is helpful when the axis ranges are changing in response to a
     * domain change or window resizing (ordinal axes), and the original bounds need to
     * reflect that change.
     * @param axisId The ID of the axis
     * @param axisRangeProvider The axis range provider for the axis
     * @param axisRange The range to which to set the original axis range
     */
    function setOriginalAxesBounds(axisId: string, axisRangeProvider: AxisRangeProvider<AR>, axisRange: AxisInterval): void {
        const updatedRange = axisRangeProvider(axisRange.start, axisRange.end)
        originalAxesBoundsRef.current.set(axisId, updatedRange.current)

        if (axesRangeRef.current.has(axisId)) {
            axesRangeRef.current.set(axisId, updatedRange)
        }
    }

    /**
     * Resets the bounds for the specified axis to the original range
     * @param axisId The ID of the axis
     * @param axisRangeProvider The axis range provider for the axis
     */
    function resetAxisBoundsFor(axisId: string, axisRangeProvider: AxisRangeProvider<AR>): void {
        if (axesBoundsRef.current.has(axisId) && originalAxesBoundsRef.current.has(axisId)) {
            const [start, end] = Optional.ofNullable(originalAxesBoundsRef.current.get(axisId))
                .map(interval => interval.asTuple())
                .getOrElse(AxisInterval.empty().asTuple())
            const updates = new Map<string, AR>([[axisId, axisRangeProvider(start, end)]])
            updateAxesBounds(updates)
        }
    }

    /**
     * Resets the bounds of all the axes to their original value or to the values specified
     * in the optional bounds map.
     * @param axisRangeProviders The axis range providers for the axes.
     * @param [axisBounds=new Map()] An optional map holds bounds for specified axes. The map
     * associates an axis ID with the new bounds.
     */
    function resetAxesBounds(
        axisRangeProviders: Map<string, AxisRangeProvider<AR>>,
        axisBounds: Map<string, AxisInterval> = new Map()
    ): void {
        const updates: Map<string, AR> = new Map(Array.from<[string, AxisInterval]>(axesBoundsRef.current.entries())
            .filter(([id, _]) => originalAxesBoundsRef.current.has(id) || axisBounds.has(id))
            .map(([id, _]) => {
                // grab the axis range provider for the axis
                const axisRangeProvider = axisRangeProviders.get(id)
                if (axisRangeProvider === undefined) {
                    throw new Error(`No axis range provider for axis. Did you forget to add it to the axis range providers map? ` +
                        `axis_id ${id}; ` +
                        `specified_providers; [${Array.from(axisRangeProviders.keys()).join(", ")}]`
                    )
                }

                // because of the filter, this will never be an empty range
                if (axisBounds.has(id)) {
                    const [start, end] = Optional.ofNullable(axisBounds.get(id))
                        .map(interval => interval.asTuple())
                        .getOrElse(AxisInterval.empty().asTuple())
                    return [id, axisRangeProvider(start, end)]
                }
                const [start, end] = Optional.ofNullable(originalAxesBoundsRef.current.get(id))
                    .map(interval => interval.asTuple())
                    .getOrElse(AxisInterval.empty().asTuple())
                return [id, axisRangeProvider(start, end)]
            }))
        updateAxesBounds(updates)
    }

    /**
     * Adds a handler to deal with updates to the bounds of the axes
     * @param handlerId the unique ID of the handler
     * @param handler The handler function that accepts a map of updates and a plot dimension
     * @return A map with all the handlers
     */
    function addAxesBoundsUpdateHandler(
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

    return <AxesContext.Provider
        value={{
            xAxesState: xAxesStateRef.current,
            yAxesState: yAxesStateRef.current,
            addXAxis: (axis, id, range) => {
                xAxesStateRef.current = xAxesStateRef.current.addAxis(axis, id)
                if (range !== undefined) {
                    originalAxesBoundsRef.current.set(id, range)
                    axesBoundsRef.current.set(id, range)
                }
            },
            addYAxis: (axis, id, range) => {
                yAxesStateRef.current = yAxesStateRef.current.addAxis(axis, id)
                if (range !== undefined) {
                    originalAxesBoundsRef.current.set(id, range)
                    axesBoundsRef.current.set(id, range)
                }
            },
            setAxisAssignments: assignments => axisAssignmentsRef.current = assignments,
            axisAssignmentsFor: seriesName => axisAssignmentsFor(seriesName),
            axisBoundsFor: axisId => axesBoundsRef.current.get(axisId) || AxisInterval.empty(),
            originalAxisBoundsFor: axisId => originalAxesBoundsRef.current.get(axisId) || AxisInterval.empty(),
            setOriginalAxisBoundsFor: (axisId, range) => originalAxesBoundsRef.current.set(axisId, range),
            setOriginalAxesBounds,
            originalAxesBounds: () => copyRangeMap(originalAxesBoundsRef.current),
            setAxisBoundsFor: (axisId, range) => axesBoundsRef.current.set(axisId, range),
            updateAxesBounds,
            axesBounds: () => new Map(axesRangeRef.current),
            resetAxisBoundsFor,
            resetAxesBounds,
            onUpdateAxesBounds,
            addAxesBoundsUpdateHandler,
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
export function useAxes<AR extends BaseAxisRange, A extends BaseAxis>(): UseAxesValues<AR, A> {
    const context = useContext<UseAxesValues<AR, A>>(AxesContext)
    const {xAxesState} = context
    if (xAxesState === undefined || xAxesState === null) {
        throw new Error("useAxes can only be used when the parent is a <AxesProvider/>")
    }
    return context
}
