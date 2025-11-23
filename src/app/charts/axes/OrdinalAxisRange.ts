import {BaseAxisRange} from "./BaseAxisRange";
import {AxisInterval} from "./axisInterval";

/**
 * An immutable ordinal-axis range that holds the current range and the original (no zoom) range.
 * Create an instance using the {@link OrdinalAxisRange.from} factory method.
 */
export class OrdinalAxisRange implements BaseAxisRange {
    readonly current: AxisInterval
    // the range when there is no zoom, which is the interval (0, width | height)
    readonly original: AxisInterval

    private constructor(start: number, end: number, originalStart: number = start, originalEnd: number = end) {
        this.current = AxisInterval.from(start, end)
        this.original = AxisInterval.from(originalStart, originalEnd)
    }

    static from(start: number, end: number, originalStart: number = start, originalEnd: number = end): OrdinalAxisRange {
        return new OrdinalAxisRange(start, end, originalStart, originalEnd)
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

    get scaleFactor(): number {
        return this.current.measure() / this.original.measure()
    }

    get currentDistance(): number {
        return this.current.measure()
    }

    get originalDistance(): number {
        return this.original.measure()
    }

    /**
     * Scales the range using the current scale-factor (closure on `scaleFactor`)
     * @param factor The factor used to update the range
     * @param value The current value being scaled
     * @return The new range, represented by an array holding the start and end value
     */
    private scaledRange(factor: number, value: number): AxisInterval {
        const dtStart = value - this.current.start
        const dtEnd = this.current.end - value
        const start = value - dtStart * factor / this.scaleFactor
        const end = value + dtEnd * factor / this.scaleFactor
        return AxisInterval.from(start, end)
    }

    /**
     * Scales the axis-range by the specified scale factor from the specified value. The equations
     * are written so that the zooming (scaling) occurs at the specified value, and expands/contracts equally
     * from that value. This operation does not modify the original range.
     * @param factor The scale factor
     * @param value The value from which to scale the interval
     * @return A new continuous-axis range with updated values
     */
    scale(factor: number, value: number): OrdinalAxisRange {
        const scaledInterval = this.scaledRange(factor, value)
        return new OrdinalAxisRange(scaledInterval.start, scaledInterval.end, this.original.start, this.original.end)
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
    constrainedScale(factor: number, value: number, constraint: [min: number, max: number]): OrdinalAxisRange {
        const scaledInterval = this.scaledRange(factor, value)
        const [min, max] = constraint
        return new OrdinalAxisRange(
            Math.min(min, scaledInterval.start),
            Math.max(max, scaledInterval.end),
            this.original.start,
            this.original.end
        )
    }
    /**
     * Translates the axis-range by the specified amount
     * @param amount The amount by which to translate the axis-range
     * @param [constraint=[-Infinity, Infinity]] Optional constraint interval in which the axis range must be within
     * @return An updated {@link OrdinalAxisRange} that has been translated by the specified amount
     */
    translate(amount: number, constraint: [start: number, end: number] = [-Infinity, Infinity]): OrdinalAxisRange {
        const [cs, ce] = constraint
        // when either of the constraints is infinite, or the pan keeps the new axis range
        // within the origin axis range (i.e. zoomed in and the panned), then allow the pan,
        // otherwise don't update
        if ((!isFinite(cs) && !isFinite(ce)) || (this.current.start + amount >= cs && this.current.end + amount <= ce)) {
            return new OrdinalAxisRange(this.current.start + amount, this.current.end + amount, this.original.start, this.original.end)
        }
        return new OrdinalAxisRange(this.current.start, this.current.end, this.original.start, this.original.end)
    }

    /**
     * Assumes that the original ranges start at 0 and end at the width or height of the plot. Calculates the
     * new range based on the change in dimensions and the previous range. And calculates the new original range
     * based on the change in the dimensions.
     * @param beforeDimension The width or height before the change in dimensions
     * @param afterDimension The width or height after the change in dimensions
     * @param beforeRange
     */
    zoom(beforeDimension: number, afterDimension: number): OrdinalAxisRange {
        const [start, end] = this.current.asTuple()
        const delta = (end - start ) * (afterDimension - beforeDimension) / beforeDimension
        const lowerBound = start / (end - start) * delta + start
        const upperBound = end / (end - start) * delta + end
        return new OrdinalAxisRange(lowerBound, upperBound, 0, afterDimension)
    }

    update(start: number, end: number): OrdinalAxisRange {
        return new OrdinalAxisRange(start, end, this.original.start, this.original.end)
    }
}
