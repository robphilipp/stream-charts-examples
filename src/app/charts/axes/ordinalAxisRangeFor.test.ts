// ordinalAxisRangeFor.test.ts
import {AxisRanges, scaleOrdinalBounds} from './ordinalAxisRangeFor';
import {axisRangeEnd, axisRangeStart, AxisRangeTuple, axisRangeTupleFrom} from "./axisRangeTuple";
import {measureOf} from "./BaseAxisRange";

describe('scaleOrdinalBounds', () => {
    function validateRanges(actualRanges: AxisRanges, expectedRanges: AxisRanges): void {
        const {range: actualRange, original: actualOriginal} = actualRanges
        const [rs, re] = actualRange
        const [os, oe] = actualOriginal

        expect(rs).toBeCloseTo(axisRangeStart(expectedRanges.range))
        expect(re).toBeCloseTo(axisRangeEnd(expectedRanges.range))
        expect(os).toBe(axisRangeStart(expectedRanges.original))
        expect(oe).toBe(axisRangeEnd(expectedRanges.original))
    }

    function axisRangesFrom(width: number, range: AxisRangeTuple): AxisRanges {
        return {
            range,
            original: axisRangeTupleFrom(0, width)
        }
    }

    function calculateScale(ranges: AxisRanges): number {
        const {range, original} = ranges
        return measureOf(range) / measureOf(original)
    }

    /**
     * Ranges before and after zoom should have the same scale as calculated by the
     * measure of the zoomed range divided by the measure of the original range.
     * @param previousRanges The ranges before the zoom
     * @param currentRanges The ranges after the zoom
     */
    function validateScale(previousRanges: AxisRanges, currentRanges: AxisRanges): void {
        expect(Math.abs(calculateScale(previousRanges) - calculateScale(currentRanges))).toBeLessThan(1e-10)
    }

    it('should scale bounds and original bounds the same when they are both the same', () => {
        const expectedRanges: AxisRanges = {
            range: axisRangeTupleFrom(0, 200),
            original: axisRangeTupleFrom(0, 200)
        }
        const previousWidth = 100
        const currentWidth = 200
        const previousRange = axisRangeTupleFrom(0, 100)

        const actualRanges = scaleOrdinalBounds(previousWidth, currentWidth, previousRange)
        validateRanges(actualRanges, expectedRanges)
        validateScale(axisRangesFrom(previousWidth, previousRange), actualRanges)
    })

    it('should scale bounds and original bounds when ordinal axis is zoomed by 10 percent', () => {
        const expectedRanges: AxisRanges = {
            range: axisRangeTupleFrom(-55, 220),
            original: axisRangeTupleFrom(0, 110)
        }
        const previousWidth = 100
        const currentWidth = 110
        const previousRange = axisRangeTupleFrom(-50, 200)

        const actualRanges = scaleOrdinalBounds(previousWidth, currentWidth, previousRange)
        validateRanges(actualRanges, expectedRanges)
    })

    it('should scale bounds and original bounds when ordinal axis is zoomed by 500 percent', () => {
        const expectedRanges: AxisRanges = {
            range: axisRangeTupleFrom(-250, 1000),
            original: axisRangeTupleFrom(0, 500)
        }
        const previousWidth = 100
        const currentWidth = 500
        const previousRange = axisRangeTupleFrom(-50, 200)

        const actualRanges = scaleOrdinalBounds(previousWidth, currentWidth, previousRange)
        validateRanges(actualRanges, expectedRanges)
    })

    it('should scale bounds and original bounds when ordinal axis is zoomed by 10 percent and ends are same', () => {
        const expectedRanges: AxisRanges = {
            range: axisRangeTupleFrom(-750, 500),
            original: axisRangeTupleFrom(0, 500)
        }
        const previousWidth = 100
        const currentWidth = 500
        const previousRange = axisRangeTupleFrom(-150, 100)

        const actualRanges = scaleOrdinalBounds(previousWidth, currentWidth, previousRange)
        validateRanges(actualRanges, expectedRanges)
    })
});