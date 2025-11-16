/**
 * The range of an axis is the physical (start, end) pixels on the screen for the axis.
 * This is the pixel-space of the axis (where as the domain is the data-space of the axis,
 * for example, the tick values).
 */
export type AxisRangeTuple = readonly [start: number, end: number]

/**
 * Creates an axis range tuple from the specified start and end values
 * @param start The axis-range start value
 * @param end The axis-range end value
 * @return The axis-range tuple
 */
export function axisRangeTupleFrom(start: number, end: number): AxisRangeTuple {
    return [Math.min(start, end), Math.max(start, end)]
}

/**
 * Creates an axis range tuple from the specified tuple
 * @param tuple The tuple to convert
 * @return The axis-range tuple
 */
export function asAxisRangeTuple(tuple: [start: number, end: number]): AxisRangeTuple {
    return axisRangeTupleFrom(tuple[0], tuple[1])
}

/**
 * Retrieves the start value of the specified axis range tuple
 * @param rangeTuple The tuple representing the ordinal-axis range (e.g. start and end)
 * @return The start value of the specified axis range tuple
 */
export function axisRangeStart(rangeTuple: AxisRangeTuple): number {
    return rangeTuple[0]
}

/**
 * Retrieves the end value of the specified axis range tuple
 * @param rangeTuple The tuple representing the ordinal-axis range (e.g. start and end)
 * @return The start value of the specified axis range tuple
 */
export function axisRangeEnd(rangeTuple: AxisRangeTuple): number {
    return rangeTuple[1]
}

/**
 * Updates the start value of the specified axis range tuple
 * @param rangeTuple The tuple representing the ordinal-axis range (e.g. start and end)
 * @param delta The amount by which to update the start value
 * @return A new axis range tuple
 */
export function translateAxisRangeStart(rangeTuple: AxisRangeTuple, delta: number) {
    const start = axisRangeStart(rangeTuple) + delta
    const end = axisRangeEnd(rangeTuple)
    return axisRangeTupleFrom(start, end)
}

/**
 * Updates the end value of the specified axis range tuple
 * @param rangeTuple The tuple representing the ordinal-axis range (e.g. start and end)
 * @param delta The amount by which to update the end value
 * @return The new axis range tuple
 */
export function translateAxisRangeEnd(rangeTuple: AxisRangeTuple, delta: number) {
    const start = axisRangeStart(rangeTuple)
    const end = axisRangeEnd(rangeTuple) + delta
    return axisRangeTupleFrom(start, end)
}

export const anEmptyRange: AxisRangeTuple = [NaN, NaN]

/**
 * Creates a copy of the specified map(axis_id, (start, end))
 * @param ranges The ranges map to copy
 * @return A copy of the specified map(axis_id, (start, end))
 */
export const copyRangeMap = (ranges: Map<string, AxisRangeTuple>): Map<string, AxisRangeTuple> =>
    new Map(Array.from(ranges.entries())
        .map(([id, [start, end]]) => [id, axisRangeTupleFrom(start, end)])
    )

