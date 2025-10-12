import {BaseAxisRange} from "./BaseAxisRange";

/**
 * The continuous-axis range contract
 */
export interface ContinuousAxisRange extends BaseAxisRange {
    // start: number
    // end: number
    // /**
    //  * The current axis range (in pixel space)
    //  */
    // current: [start: number, end: number]
    // /**
    //  * The original axis range (in pixel space)
    //  */
    // original: [start: number, end: number]
    //
    // /**
    //  * Accessor function to get the width of the current axis range (pixel space)
    //  * @return The width of the current axis range (pixel space)
    //  */
    // currentDistance: () => number
    // /**
    //  * Access function to get the current start of the axis range (pixel space)
    //  * @return The current start of the axis range (pixel space)
    //  */
    // currentStart: () => number
    // /**
    //  * Access function to get the current end of the axis range (pixel space)
    //  * @return The current end of the axis range (pixel space)
    //  */
    // currentEnd: () => number
    //
    // /**
    //  * Determines whether the specified (start, end) interval matches the original interval
    //  * @param start The original start of the axis range
    //  * @param end The original end of the axis range
    //  * @return `true` if the specified interval matches the original interval; `false` otherwise
    //  */
    // matchesOriginal: (start: number, end: number) => boolean
    //
    // /**
    //  * The current scale factor for zooming
    //  */
    // scaleFactor: number

    // /**
    //  *
    //  * Scales the axis-range by the specified scale factor from the specified {@link value}. The equations
    //  * are written so that the zooming (scaling) occurs at the specified {@link value}, and expands/contracts equally
    //  * from that {@link value}.
    //  * @param factor The scale factor
    //  * @param time The time from which to scale the interval
    //  * @return A new continuous-axis range with updated values
    //  */
    // scale: (factor: number, value: number) => ContinuousAxisRange
    // /**
    //  * Scales the axis-range by the specified scale factor, but constrains the range to the specified
    //  * {@link constraint} min and max. The equations are written so that the zooming (scaling) occurs
    //  * at the specified {@link value}, and expands/contracts equally from that {@link value}.
    //  * @param factor The scale factor
    //  * @param time The value at which the zoom is initiated
    //  * @param constraint The min and max range
    //  * @return A new continuous-axis range with updated values
    //  */
    // constrainedScale: (factor: number, value: number, constraint: [min: number, max: number]) => ContinuousAxisRange
    // /**
    //  * Translates the axis-range by the specified amount
    //  * @param amount The amount by which to translate the axis-range
    //  * @return An updated {@link ContinuousAxisRange} that has been translated by the specified amount
    //  */
    // translate: (amount: number, constraints?: [start: number, end: number]) => ContinuousAxisRange
    // /**
    //  * Updates the axis-range based on the new start and end values
    //  * @param start The new start of the axis-range
    //  * @param end The new end of the axis range
    //  * @return The updated axis-range type, with all other values unchanged
    //  */
    // update: (start: number, end: number) => ContinuousAxisRange
}

/**
 * A time-range that can be scaled and transformed, all the while maintaining its original range values.
 * @param _start The start of the time-range
 * @param _end The end of the time-range
 * @return A time-range object that can be scaled and transformed
 */
export function continuousAxisRangeFor(_start: number, _end: number): ContinuousAxisRange {
    // form a closure on the original start and end of the time-range
    const originalStart = Math.min(_start, _end)
    const originalEnd = Math.max(_start, _end)

    /**
     * Updates the axis-range based on the new start and end values
     * @param start The new start of the axis-range
     * @param end The new end of the axis range
     * @return The updated axis-range type
     */
    function updateAxisRange(start: number, end: number): ContinuousAxisRange {
        return updateRange(start, end)
    }

    /**
     * Updates the continuous range based on the new start and end times
     * @param start The new start of the continuous range
     * @param end The new end of the continuous range
     * @return The updated continuous range type
     */
    function updateRange(start: number, end: number): ContinuousAxisRange {

        // the amount by which the time-range is currently scaled
        const scaleFactor = (end - start) / (originalEnd - originalStart)

        /**
         * Determines whether the specified (start, end) interval matches the original interval
         * @param start The start of the interval
         * @param end The end of the interval
         * @return `true` if the specified interval matches the original interval; `false` otherwise
         */
        function matchesOriginal(start: number, end: number): boolean {
            return originalStart === start && originalEnd === end
        }

        /**
         * Scales the range using the current scale-factor (closure on `scaleFactor`)
         * @param factor The factor used to update the range
         * @param value The current value of the being scaled
         * @return The new range, represented by an array holding the start and end value
         */
        function scaledRange(factor: number, value: number): [start: number, end: number] {
            const oldScaleFactor = scaleFactor
            const dtStart = value - start
            const dtEnd = end - value
            start = value - dtStart * factor / oldScaleFactor
            end = value + dtEnd * factor / oldScaleFactor
            return [start, end]
        }

        /**
         * Scales the axis-range by the specified scale factor from the specified value. The equations
         * are written so that the zooming (scaling) occurs at the specified value, and expands/contracts equally
         * from that value.
         * @param factor The scale factor
         * @param value The value from which to scale the interval
         * @return A new continuous-axis range with updated values
         */
        function scale(factor: number, value: number): ContinuousAxisRange {
            const [start, end] = scaledRange(factor, value)
            return updateAxisRange(start, end)
        }

        /**
         * Scales the axis-range by the specified scale factor from the specified value, while keeping
         * the range within the constraints (start, end). The equations are written so that the zooming
         * (scaling) occurs at the specified value, and expands/contracts equally from that value.
         * @param factor The scale factor
         * @param value The value from which to scale the interval
         * @param constraint The minimum and maximum values that range bounds can be
         * @return A new continuous-axis range with updated values
         */
        function constrainedScale(factor: number, value: number, constraint: [min: number, max: number]): ContinuousAxisRange {
            const [start, end] = scaledRange(factor, value)
            const [min, max] = constraint
            return updateAxisRange(Math.max(min, start), Math.min(max, end))
        }

        /**
         * Translates the axis-range by the specified amount
         * @param amount The amount by which to translate the axis-range
         * @param [constraint=[-Infinity, Infinity]] Optional constraint interval in which the axis range must be within
         * @return An updated {@link ContinuousAxisRange} that has been translated by the specified amount
         */
        function translate(amount: number, constraint: [start: number, end: number]  = [-Infinity, Infinity]): ContinuousAxisRange {
            const [cs, ce] = constraint
            // when either of the constraints is infinite, or the pan keeps the new axis range
            // within the origin axis range (i.e. zoomed in and the panned), then allow the pan,
            // otherwise don't update
            if ((!isFinite(cs) && !isFinite(ce)) || (start + amount >= cs && end + amount <= ce)) {
                start += amount
                end += amount
            }
            return updateAxisRange(start, end)
        }

        return {
            // start: start,
            // end: end,
            current: [start, end],
            original: [originalStart, originalEnd],
            currentStart: () => start,
            currentEnd: () => end,
            currentDistance: () => end - start,
            matchesOriginal,
            scaleFactor,
            scale,
            constrainedScale,
            translate,
            update: updateAxisRange
        }
    }

    return updateAxisRange(originalStart, originalEnd);
}
