import {BaseAxisRange} from "./BaseAxisRange";
import {AxisInterval} from "./axisInterval";

/**
 * An immutable continuous-axis range that holds the current range and the original (no zoom) range.
 * Create an instance using the {@link ContinuousAxisRange.from} factory method.
 */
export class ContinuousAxisRange implements BaseAxisRange {
    readonly current: AxisInterval
    readonly original: AxisInterval

    private constructor(start: number, end: number, originalStart: number = start, originalEnd: number = end) {
        this.current = AxisInterval.from(start, end)
        this.original = AxisInterval.from(originalStart, originalEnd)
    }

    /**
     * Factory function for creating a new continuous-axis range instance.
     * @param start The start of the axis-range.
     * @param end The end of the axis-range.
     * @param [originalStart=start] The optional original start of the axis-range (e.g. before any zooming or panning.
     * Defaults to the start value if not specified.)
     * @param [originalEnd=end] The optional original end of the axis-range (e.g. before any zooming or panning.
     * Defaults to the end value if not specified.)
     * @return A new continuous-axis range instance.
     */
    static from(start: number, end: number, originalStart: number = start, originalEnd: number = end): ContinuousAxisRange {
        return new ContinuousAxisRange(start, end, originalStart, originalEnd)
    }

    /**
     * Determines whether the specified (start, end) interval matches the original interval
     * @param start The start of the interval
     * @param end The end of the interval
     * @return `true` if the specified interval matches the original interval; `false` otherwise
     */
    matchesOriginal(start: number, end: number): boolean {
        return this.original.equalsInterval(start, end)
    }

    /**
     * Returns the current distance between the start and end of the range.
     */
    get currentDistance(): number {
        return this.current.measure()
    }

    /**
     * Returns the original (e.g. before any zooming or panning) distance between the start and end of the range.
     */
    get originalDistance(): number {
        return this.original.measure()
    }

    /**
     * The ratio between the current and original distance.
     */
    get scaleFactor(): number {
        return this.currentDistance / this.originalDistance
    }

    /**
     * Scales the range using the current scale-factor (closure on `scaleFactor`)
     * @param factor The factor used to update the range
     * @param value The current value of the being scaled
     * @return The new range, represented by an array holding the start and end value
     */
    private scaledRange(factor: number, value: number): AxisInterval {
        const oldScaleFactor = this.scaleFactor
        const dtStart = value - this.current.start
        const dtEnd = this.current.end - value
        const start = value - dtStart * factor / oldScaleFactor
        const end = value + dtEnd * factor / oldScaleFactor
        return AxisInterval.from(start, end)
    }

    /**
     * Scales the axis-range by the specified scale factor from the specified value. The equations
     * are written so that the zooming (scaling) occurs at the specified value and expands/contracts equally
     * from that value.
     * @param factor The scale factor
     * @param value The value from which to scale the interval
     * @return A new continuous-axis range with updated values
     */
    scale(factor: number, value: number): ContinuousAxisRange {
        const scaledInterval = this.scaledRange(factor, value)
        return new ContinuousAxisRange(scaledInterval.start, scaledInterval.end, this.original.start, this.original.end)
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
    constrainedScale(factor: number, value: number, constraint: [min: number, max: number]): BaseAxisRange {
        const scaledInterval = this.scaledRange(factor, value)
        const [min, max] = constraint
        return new ContinuousAxisRange(
            Math.max(min, scaledInterval.start),
            Math.min(max, scaledInterval.end),
            this.original.start,
            this.original.end
        )
    }

    /**
     * Translates the axis-range by the specified amount
     * @param amount The amount by which to translate the axis-range
     * @param [constraint=[-Infinity, Infinity]] Optional constraint interval in which the axis range must be within
     * @return An updated {@link ContinuousAxisRange} that has been translated by the specified amount
     */
    translate(amount: number, constraint: [start: number, end: number] = [-Infinity, Infinity]): ContinuousAxisRange {
        const [cs, ce] = constraint
        // when either of the constraints is infinite, or the pan keeps the new axis range
        // within the origin axis range (i.e. zoomed in and the panned), then allow the pan,
        // otherwise don't update
        if ((!isFinite(cs) && !isFinite(ce)) || (this.current.start + amount >= cs && this.current.end + amount <= ce)) {
            return new ContinuousAxisRange(this.current.start + amount, this.current.end + amount, this.original.start, this.original.end)
        }
        return new ContinuousAxisRange(this.current.start, this.current.end, this.original.start, this.original.end)
    }

    update(start: number, end: number): ContinuousAxisRange {
        return new ContinuousAxisRange(start, end, this.original.start, this.original.end)
    }
}