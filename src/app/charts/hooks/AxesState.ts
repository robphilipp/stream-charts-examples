import {BaseAxis} from "../axes/axes";

/**
 * Holds the information to allow mapping axes names to the underlying axes objects.
 * These objects hold the axis ID, its location on the chart (i.e. left, right, bottom, upper)
 * and the underlying D3 selection objects for managing the axes.
 */
export interface AxesState<A extends BaseAxis> {
    /**
     * Attempts to retrieve the x-axis for the specified ID
     * @param axisId The unique ID of the axis
     * @return The axis, or undefined if no axis with the specified ID is found
     */
    readonly axisFor: (axisId: string) => A | undefined
    /**
     * Returns the default axis
     * @return The default axis
     * @see axisDefaultId
     */
    readonly defaultAxis: () => A
    /**
     * @return An array holding all existing the x-axis IDs
     */
    readonly axisIds: () => Array<string>
    /**
     * @return The default name of the x-axis (in case only on default axis was added)
     */
    readonly axisDefaultId: () => string
    /**
     * Mapping of the axis IDs to their axis objects
     */
    readonly axes: Map<string, A>
}

/**
 * @return a new, empty {@link AxesState}
 */
export function createAxesState<A extends BaseAxis>(): AxesState<A> {
    return axesStateFrom(new Map<string, A>())
}

/**
 * Adds an axis to the current axis state and returns a new axis state. This is an internal state
 * management function. This should generally not be used. Instead use the {@link UseChartValues.addXAxis}
 * and {@link UseChartValues.addYAxis} functions to add axes.
 * @param axesState The current axes state
 * @param axis The axis to add
 * @param id The ID of the axis to add
 * @return An updated axes state that has the new axis
 * @see UseChartValues.addXAxis
 * @see UseChartValues.addYAxis
 */
export function addAxisTo<A extends BaseAxis>(axesState: AxesState<A>, axis: A, id: string): AxesState<A> {
    const updatedAxes = axesState.axes.set(id, axis)
    return axesStateFrom(updatedAxes)
}

/**
 * Calculates the axes-state from the specified map. The map associates the axis ID
 * to each axis
 * @param axes The map associating the axes IDs to their respective axes
 * @return An {@link AxesState}
 */
function axesStateFrom<A extends BaseAxis>(axes: Map<string, A>): AxesState<A> {
    return {
        axisFor: id => {
            const axis = axes.get(id)
            // when there is no axis for the specified ID and there is at least
            // one axis, then just use that...it is the default axis
            if (axis === undefined && axes.size >= 1) {
                return Array.from(axes.values())[0]
            }
            return axis
        },
        axisIds: () => Array.from(axes.keys()),
        axisDefaultId: () => Array.from(axes.keys())[0],
        defaultAxis: () => Array.from(axes.values())[0],
        axes
    }
}

/**
 * Makes a copy of the specified axes state
 * @param axesState The axes state to copy
 * @return A new axes state copied from the specified one
 */
export function copyAxesState<A extends BaseAxis>(axesState: AxesState<A>): AxesState<A> {
    const {axes} = axesState
    return {
        axisFor: (id: string) => {
            const axis = axes.get(id)
            // when there is no axis for the specified ID and there is at least
            // one axis, then just use that...it is the default axis
            if (axis === undefined && axes.size >= 1) {
                return Array.from(axes.values())[0]
            }
            return axis
        },
        axisIds: () => Array.from(axes.keys()),
        axisDefaultId: () => Array.from(axes.keys())[0],
        defaultAxis: () => Array.from(axes.values())[0],
        axes: new Map<string, A>(
            Array.from(axes.entries()).map(([id, axis]) => [id, {...axis}])
        ),
    }
}



// import {BaseAxis} from "../axes/axes";
//
// /**
//  * Holds the information to allow mapping axes names to the underlying axes objects.
//  * These objects hold the axis ID, its location on the chart (i.e. left, right, bottom, upper)
//  * and the underlying D3 selection objects for managing the axes.
//  */
// export class AxesState<A extends BaseAxis> {
//     readonly axes: Map<string, A>
//
//     private constructor(axes: Map<string, A>) {
//         this.axes = axes
//     }
//
//     static from<A extends BaseAxis>(axes: Map<string, A>): AxesState<A> {
//         return new AxesState<A>(axes)
//     }
//
//     static empty<A extends BaseAxis>(): AxesState<A> {
//         return new AxesState<A>(new Map<string, A>())
//     }
//
//     copy(): AxesState<A> {
//         return new AxesState<A>(
//             new Map(
//                 Array.from(
//                     this.axes.entries()).map(([id, axis]) => [id, {...axis}])
//             )
//         )
//     }
//
//     /**
//      * Adds an axis to the current axis state and returns a new axis state. This is an internal state
//      * management function. This should generally not be used. Instead use the {@link UseChartValues.addXAxis}
//      * and {@link UseChartValues.addYAxis} functions to add axes.
//      * @param axis The axis to add
//      * @param id The ID of the axis to add
//      * @return An updated axes state that has the new axis
//      * @see UseChartValues.addXAxis
//      * @see UseChartValues.addYAxis
//      */
//     addAxis(axis: A, id: string): AxesState<A> {
//         const updatedAxes = this.axes.set(id, axis)
//         return new AxesState<A>(updatedAxes)
//     }
//
//     /**
//      * Attempts to retrieve the x-axis for the specified ID
//      * @param axisId The unique ID of the axis
//      * @return The axis, or undefined if no axis with the specified ID is found
//      */
//     axisFor(axisId: string): A | undefined {
//         const axis = this.axes.get(axisId)
//         // when there is no axis for the specified ID and there is at least
//         // one axis, then just use that...it is the default axis
//         if (axis === undefined && this.axes.size >= 1) {
//             return Array.from(this.axes.values())[0]
//         }
//         return axis
//     }
//
//     /**
//      * Returns the default axis
//      * @return The default axis
//      * @see axisDefaultId
//      */
//     defaultAxis(): A {
//         return Array.from(this.axes.values())[0]
//     }
//
//     /**
//      * @return An array holding all existing the x-axis IDs
//      */
//     axisIds(): Array<string> {
//         return Array.from(this.axes.keys())
//     }
//
//     /**
//      * @return The default name of the x-axis (in case only on default axis was added)
//      */
//     axisDefaultId(): string {
//         return Array.from(this.axes.keys())[0]
//     }
// }

// /**
//  * @return a new, empty {@link AxesState}
//  */
// export function createAxesState<A extends BaseAxis>(): AxesState<A> {
//     return axesStateFrom(new Map<string, A>())
// }
//
// /**
//  * Adds an axis to the current axis state and returns a new axis state. This is an internal state
//  * management function. This should generally not be used. Instead use the {@link UseChartValues.addXAxis}
//  * and {@link UseChartValues.addYAxis} functions to add axes.
//  * @param axesState The current axes state
//  * @param axis The axis to add
//  * @param id The ID of the axis to add
//  * @return An updated axes state that has the new axis
//  * @see UseChartValues.addXAxis
//  * @see UseChartValues.addYAxis
//  */
// export function addAxisTo<A extends BaseAxis>(axesState: AxesState<A>, axis: A, id: string): AxesState<A> {
//     const updatedAxes = axesState.axes.set(id, axis)
//     return axesStateFrom(updatedAxes)
// }

// /**
//  * Calculates the axes-state from the specified map. The map associates the axis ID
//  * to each axis
//  * @param axes The map associating the axes IDs to their respective axes
//  * @return An {@link AxesState}
//  */
// function axesStateFrom<A extends BaseAxis>(axes: Map<string, A>): AxesState<A> {
//     return {
//         axisFor: id => {
//             const axis = axes.get(id)
//             // when there is no axis for the specified ID and there is at least
//             // one axis, then just use that...it is the default axis
//             if (axis === undefined && axes.size >= 1) {
//                 return Array.from(axes.values())[0]
//             }
//             return axis
//         },
//         axisIds: () => Array.from(axes.keys()),
//         axisDefaultId: () => Array.from(axes.keys())[0],
//         defaultAxis: () => Array.from(axes.values())[0],
//         axes
//     }
// }
//
// /**
//  * Makes a copy of the specified axes state
//  * @param axesState The axes state to copy
//  * @return A new axes state copied from the specified one
//  */
// export function copyAxesState<A extends BaseAxis>(axesState: AxesState<A>): AxesState<A> {
//     const {axes} = axesState
//     return {
//         axisFor: (id: string) => {
//             const axis = axes.get(id)
//             // when there is no axis for the specified ID and there is at least
//             // one axis, then just use that...it is the default axis
//             if (axis === undefined && axes.size >= 1) {
//                 return Array.from(axes.values())[0]
//             }
//             return axis
//         },
//         axisIds: () => Array.from(axes.keys()),
//         axisDefaultId: () => Array.from(axes.keys())[0],
//         defaultAxis: () => Array.from(axes.values())[0],
//         axes: new Map<string, A>(
//             Array.from(axes.entries()).map(([id, axis]) => [id, {...axis}])
//         ),
//     }
// }
