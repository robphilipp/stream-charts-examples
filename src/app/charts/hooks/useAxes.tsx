import {addAxisTo, AxesState, createAxesState} from "./AxesState";
import {BaseAxis} from "../axes";
import {AxesAssignment} from "../plot";
import {createContext, JSX, useContext, useRef} from "react";

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
}

export const defaultAxesValues = (): UseAxesValues => ({
    xAxesState: createAxesState(),
    yAxesState: createAxesState(),
    addXAxis: noop,
    addYAxis: noop,
    setAxisAssignments: noop,
    axisAssignmentsFor: () => ({xAxis: "", yAxis: ""}),
})

// the context for axes
const AxesContext = createContext<UseAxesValues>(defaultAxesValues())

type Props = {
    children: JSX.Element | Array<JSX.Element>
}

/**
 * The React context provider for the {@link UseAxesValues}
 * @param props The properties
 * @return The children wrapped in this provider
 * @constructor
 */
export default function AxesProvider(props: Props): JSX.Element {
    const {children} = props

    const xAxesRef = useRef<AxesState>(createAxesState())
    const yAxesRef = useRef<AxesState>(createAxesState())
    const axisAssignmentsRef = useRef<Map<string, AxesAssignment>>(new Map())

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

    return <AxesContext.Provider
        value={{
            xAxesState: xAxesRef.current,
            yAxesState: yAxesRef.current,
            addXAxis: (axis, id) => xAxesRef.current = addAxisTo(xAxesRef.current, axis, id),
            addYAxis: (axis, id) => yAxesRef.current = addAxisTo(yAxesRef.current, axis, id),
            setAxisAssignments: assignments => axisAssignmentsRef.current = assignments,
            axisAssignmentsFor: seriesName => axisAssignmentsFor(seriesName),
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
