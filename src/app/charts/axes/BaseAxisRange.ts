import {AxisInterval} from "./axisInterval";

export interface BaseAxisRange {
    /**
     * The current axis range (in pixel space)
     */
    get current(): AxisInterval
    /**
     * The original axis range (in pixel space)
     */
    get original(): AxisInterval

    get currentDistance(): number

    get originalDistance(): number

    /**
     * Determines whether the specified (start, end) interval matches the original interval
     * @param start The original start of the axis range
     * @param end The original end of the axis range
     * @return `true` if the specified interval matches the original interval; `false` otherwise
     */
    matchesOriginal(start: number, end: number): boolean

    /**
     * The current scale factor for zooming
     */
    get scaleFactor(): number

    /**
     *
     * Scales the axis-range by the specified scale factor from the specified {@link value}. The equations
     * are written so that the zooming (scaling) occurs at the specified {@link value}, and expands/contracts equally
     * from that {@link value}.
     * @param factor The scale factor
     * @param value The time from which to scale the interval
     * @return A new continuous-axis range with updated values
     */
    scale(factor: number, value: number): BaseAxisRange
    /**
     * Scales the axis-range by the specified scale factor, but constrains the range to the specified
     * {@link constraint} min and max. The equations are written so that the zooming (scaling) occurs
     * at the specified {@link value}, and expands/contracts equally from that {@link value}.
     * @param factor The scale factor
     * @param value The value at which the zoom is initiated
     * @param constraint The min and max range
     * @return A new continuous-axis range with updated values
     */
    constrainedScale(factor: number, value: number, constraint: [min: number, max: number]): BaseAxisRange
    /**
     * Translates the axis-range by the specified amount
     * @param amount The amount by which to translate the axis-range
     * @param [constraints] Optional constraint interval in which the axis range must be within
     * @return An updated {@link ContinuousAxisRange} that has been translated by the specified amount
     */
    translate(amount: number, constraints?: [start: number, end: number]): BaseAxisRange
    /**
     * Updates the axis-range based on the new start and end values
     * @param start The new start of the axis-range
     * @param end The new end of the axis range
     * @return The updated axis-range type, with all other values unchanged
     */
    update(start: number, end: number): BaseAxisRange
}

// /**
//  * Convenience function for extracting the start value from a range
//  * @param range The range
//  * @return The start value
//  */
// export function startFrom(range: AxisRangeTuple): number {
//     return range[0]
// }
//
// /**
//  * Convenience function for extracting the end value from a range
//  * @param range The range
//  * @return The end value
//  */
// export function endFrom(range: AxisRangeTuple): number {
//     return range[1]
// }
//
// /**
//  * Convenience function for extracting the measure (end - start) from a range
//  * @param range The range
//  * @return The measure
//  */
// export function measureOf(range: AxisRangeTuple): number {
//     return endFrom(range) - startFrom(range)
// }
