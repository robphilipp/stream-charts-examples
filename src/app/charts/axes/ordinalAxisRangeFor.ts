import {BaseAxisRange} from "./BaseAxisRange";

type AxisRange = [start: number, end: number]

/**
 * The continuous-axis range contract
 */
export interface OrdinalAxisRange extends BaseAxisRange {
    updateOriginalAxisRange: (start: number, end: number) => void
}

/**
 * A time-range that can be scaled and transformed, all the while maintaining its original range values.
 * @param _start The start of the time-range
 * @param _end The end of the time-range
 * @return A time-range object that can be scaled and transformed
 */
export function ordinalAxisRangeFor(_start: number, _end: number): OrdinalAxisRange {
    // form a closure on the original start and end of the time-range
    const originalStart = Math.min(_start, _end)
    const originalEnd = Math.max(_start, _end)

    /**
     * Updates the axis-range based on the new start and end values
     * @param start The new start of the axis-range
     * @param end The new end of the axis range
     * @return The updated axis-range type
     */
    function updateAxisRange(start: number, end: number): OrdinalAxisRange {
        return updateRange(start, end)
    }

    function updateOriginalAxisRange(start: number, end: number): OrdinalAxisRange {
        return ordinalAxisRangeFor(start, end)
    }

    /**
     * Updates the categories visible in the domain based on the new start and end indexes
     * @param start The new start index of the ordinal
     * @param end The new end index of the ordinal
     * @return The updated categories
     */
    function updateRange(start: number, end: number): OrdinalAxisRange {

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
        function scale(factor: number, value: number): OrdinalAxisRange {
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
        function constrainedScale(factor: number, value: number, constraint: [min: number, max: number]): OrdinalAxisRange {
            const [start, end] = scaledRange(factor, value)
            const [min, max] = constraint
            return updateAxisRange(Math.min(min, start), Math.max(max, end))
        }

        /**
         * Translates the axis-range by the specified amount
         * @param amount The amount by which to translate the axis-range
         * @param [constraint=[-Infinity, Infinity]] Optional constraint interval in which the axis range must be within
         * @return An updated {@link OrdinalAxisRange} that has been translated by the specified amount
         */
        function translate(amount: number, constraint: [start: number, end: number]  = [-Infinity, Infinity]): OrdinalAxisRange {
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
            current: [start, end],
            original: [originalStart, originalEnd],
            currentDistance: Math.abs(end - start),
            originalDistance: Math.abs(originalEnd - originalStart),
            matchesOriginal,
            scaleFactor,
            scale,
            constrainedScale,
            translate,
            update: updateAxisRange,
            updateOriginalAxisRange
        }
    }

    return updateAxisRange(originalStart, originalEnd);
}
