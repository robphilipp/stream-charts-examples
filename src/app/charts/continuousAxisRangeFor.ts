/**
 * The continuous-axis range contract
 */
export interface ContinuousAxisRange {
    start: number
    end: number
    original: [start: number, end: number]
    scaleFactor: number
    matchesOriginal: (start: number, end: number) => boolean
    /**
     * Scales the time-range by the specified scale factor from the specified time-location. The equations
     * are written so that the zooming (scaling) occurs at the specified time, and expands/contracts equally
     * from that time.
     * @param factor The scale factor
     * @param time The time from which to scale the interval
     * @return A new continuous-axis range with updated values
     */
    scale: (factor: number, time: number) => ContinuousAxisRange
    /**
     * Translates the axis-range by the specified amount
     * @param amount The amount by which to translate the axis-range
     * @return An updated {@link ContinuousAxisRange} that has been translated by the specified amount
     */
    translate: (amount: number) => ContinuousAxisRange
    /**
     * Updates the axis-range based on the new start and end values
     * @param start The new start of the axis-range
     * @param end The new end of the axis range
     * @return The updated axis-range type, with all other values unchanged
     */
    update: (start: number, end: number) => ContinuousAxisRange
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
         * Scales the time-range by the specified scale factor from the specified time-location. The equations
         * are written so that the zooming (scaling) occurs at the specified time, and expands/contracts equally
         * from that time.
         * @param factor The scale factor
         * @param time The time from which to scale the interval
         * @return A new continuous-axis range with updated values
         */
        function scale(factor: number, time: number): ContinuousAxisRange {
            const oldScale = scaleFactor
            const dts = time - start
            const dte = end - time
            start = time - dts * factor / oldScale
            end = time + dte * factor / oldScale
            return updateAxisRange(start, end)
        }

        /**
         * Translates the axis-range by the specified amount
         * @param amount The amount by which to translate the axis-range
         * @return An updated {@link ContinuousAxisRange} that has been translated by the specified amount
         */
        function translate(amount: number): ContinuousAxisRange {
            start += amount
            end += amount
            return updateAxisRange(start, end)
        }

        return {
            start: start,
            end: end,
            original: [originalStart, originalEnd],
            matchesOriginal,
            scaleFactor,
            scale,
            translate,
            update: updateAxisRange
        }
    }

    return updateAxisRange(originalStart, originalEnd);
}
