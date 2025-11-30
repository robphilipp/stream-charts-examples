/**
 * The range of an axis is the physical (start, end) pixels on the screen for the axis.
 * This is the pixel-space of the axis (where as the domain is the data-space of the axis,
 * for example, the tick values).
 */
export class AxisInterval {
    private constructor(readonly start: number, readonly end: number) {}

    /**
     * Creates an axis interval from the specified start and end values
     * @param start The axis-range start value
     * @param end The axis-range end value
     * @return The axis-interval
     */
    static from(start: number, end: number): AxisInterval {
        return new AxisInterval(Math.min(start, end), Math.max(start, end))
    }

    /**
     * Creates an axis interval from the specified tuple
     * @param tuple The tuple to convert
     * @return The axis-interval
     */
    static as(tuple: [start: number, end: number]): AxisInterval {
        return AxisInterval.from(tuple[0], tuple[1])
    }

    /**
     * Creates an empty axis interval
     * @return An empty axis interval
     */
    static empty(): AxisInterval {
        return new AxisInterval(NaN, NaN)
    }

    /**
     * @return `true` if the axis interval is empty, `false` otherwise
     */
    isEmpty(): boolean {
        return isNaN(this.start) || isNaN(this.end)
    }

    /**
     * @return `true` if the axis interval is not empty, `false` otherwise
     */
    isNotEmpty(): boolean {
        return !this.isEmpty()
    }

    /**
     * @return `true` if the specified axis interval is equal to this one, `false` otherwise
     */
    equalsInterval(start: number, end: number): boolean {
        return this.start === start && this.end === end
    }

    equals(other: AxisInterval): boolean {
        return this.start === other.start && this.end === other.end
    }

    /**
     * Creates a copy of the specified axis interval
     * @return A copy of the specified axis interval
     */
    copy(): AxisInterval {
        return AxisInterval.from(this.start, this.end)
    }

    /**
     * Converts the axis interval to a tuple
     * @return The axis interval as a tuple
     */
    asTuple(): [start: number, end: number] {
        return [this.start, this.end]
    }

    /**
     * Applies the specified function to the axis interval and returns the result
     * @param fn The function to apply to the axis interval
     * @return The result of the function application
     */
    map(fn: (start: number, end: number) => [start: number, end: number]): AxisInterval {
        const [start, end] = fn(this.start, this.end)
        return AxisInterval.from(start, end)
    }

    /**
     * Calculates the measure (end - start) of the specified axis interval
     * @return The measure (end - start) of the specified axis interval
     */
    measure(): number {
        return this.end - this.start
    }

    /**
     * Updates the start value of the specified axis interval
     * @param rangeTuple The tuple representing the ordinal-axis range (e.g. start and end)
     * @param delta The amount by which to update the start value
     * @return A new axis interval
     */
    translateStart(rangeTuple: AxisInterval, delta: number) {
        return AxisInterval.from(rangeTuple.start + delta, rangeTuple.end)
    }

    /**
     * Updates the end value of the specified axis interval
     * @param rangeTuple The tuple representing the ordinal-axis range (e.g. start and end)
     * @param delta The amount by which to update the end value
     * @return The new axis interval
     */
    translateEnd(rangeTuple: AxisInterval, delta: number) {
        return AxisInterval.from(rangeTuple.start, rangeTuple.end + delta)
    }
}

/**
 * Creates a copy of the specified map(axis_id, (start, end))
 * @param ranges The ranges map to copy
 * @return A copy of the specified map(axis_id, (start, end))
 */
export function copyRangeMap(ranges: Map<string, AxisInterval>): Map<string, AxisInterval> {
    return new Map(Array.from(ranges.entries())
        .map(([id, range]) => [id, range.copy()])
    )
}

