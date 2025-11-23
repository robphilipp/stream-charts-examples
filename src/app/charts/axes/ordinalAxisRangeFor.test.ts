// ordinalAxisRangeFor.test.ts
import {AxisRanges, scaleOrdinalBounds} from './ordinalAxisRangeFor';
import {AxisInterval} from "./axisInterval";

describe('scaleOrdinalBounds', () => {
    function validateRanges(actualRanges: AxisRanges, expectedRanges: AxisRanges): void {
        const {range: actualRange, original: actualOriginal} = actualRanges

        expect(actualRange.start).toBeCloseTo(expectedRanges.range.start)
        expect(actualRange.end).toBeCloseTo(expectedRanges.range.end)
        expect(actualOriginal.start).toBe(expectedRanges.original.start)
        expect(actualOriginal.end).toBe(expectedRanges.original.end)
    }

    function axisRangesFrom(width: number, range: AxisInterval): AxisRanges {
        return {
            range,
            original: AxisInterval.from(0, width)
        }
    }

    function calculateScale(ranges: AxisRanges): number {
        const {range, original} = ranges
        return range.measure() / original.measure()
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
            range: AxisInterval.from(0, 200),
            original: AxisInterval.from(0, 200)
        }
        const previousWidth = 100
        const currentWidth = 200
        const previousRange = AxisInterval.from(0, 100)

        const actualRanges = scaleOrdinalBounds(previousWidth, currentWidth, previousRange)
        validateRanges(actualRanges, expectedRanges)
        validateScale(axisRangesFrom(previousWidth, previousRange), actualRanges)
    })

    it('should scale bounds and original bounds when ordinal axis is zoomed by 10 percent', () => {
        const expectedRanges: AxisRanges = {
            range: AxisInterval.from(-55, 220),
            original: AxisInterval.from(0, 110)
        }
        const previousWidth = 100
        const currentWidth = 110
        const previousRange = AxisInterval.from(-50, 200)

        const actualRanges = scaleOrdinalBounds(previousWidth, currentWidth, previousRange)
        validateRanges(actualRanges, expectedRanges)
    })

    it('should scale bounds and original bounds when ordinal axis is zoomed by 500 percent', () => {
        const expectedRanges: AxisRanges = {
            range: AxisInterval.from(-250, 1000),
            original: AxisInterval.from(0, 500)
        }
        const previousWidth = 100
        const currentWidth = 500
        const previousRange = AxisInterval.from(-50, 200)

        const actualRanges = scaleOrdinalBounds(previousWidth, currentWidth, previousRange)
        validateRanges(actualRanges, expectedRanges)
    })

    it('should scale bounds and original bounds when ordinal axis is zoomed by 10 percent and ends are same', () => {
        const expectedRanges: AxisRanges = {
            range: AxisInterval.from(-750, 500),
            original: AxisInterval.from(0, 500)
        }
        const previousWidth = 100
        const currentWidth = 500
        const previousRange = AxisInterval.from(-150, 100)

        const actualRanges = scaleOrdinalBounds(previousWidth, currentWidth, previousRange)
        validateRanges(actualRanges, expectedRanges)
    })
});