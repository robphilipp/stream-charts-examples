import {scaleBand} from "d3";
import {AxisLocation, calculateOrdinalPanFor, ordinalAxisZoomHandler, type OrdinalStringAxis} from "./axes";
import {AxesState} from "./AxesState";
import {OrdinalAxisRange} from "./OrdinalAxisRange";
import type {Dimensions, Margin} from "../styling/margins";

/**
 * These tests guard against a regression of a bug where the ordinal (categorical) axis pan/zoom
 * math hard-coded `plotDimensions.width` regardless of the axis's location, silently using the
 * wrong pixel extent for a left/right-located (y) axis, which should use `plotDimensions.height`.
 */
describe('ordinal axis pan/zoom pixel-extent selection by location', () => {
    const plotDimensions: Dimensions = {width: 500, height: 200}
    const margin: Margin = {top: 0, right: 0, bottom: 0, left: 0}

    function fakeOrdinalAxis(location: AxisLocation): OrdinalStringAxis {
        return {
            axisId: 'axis-1',
            location,
            scale: scaleBand<string>(),
            categorySize: 10,
            update: () => 10,
            updateFont: () => {
            },
            setHighlighted: () => {
            },
        }
    }

    describe('calculateOrdinalPanFor', () => {
        // this range has already reached the plot's height (200) but not yet its width (500) --
        // so whether the pan below is allowed depends entirely on which extent is used
        const range = OrdinalAxisRange.from(-100, 220, -100, 220)

        it('blocks the pan for a bottom-located (x) axis because the range has not yet reached the plot width', () => {
            const panned = calculateOrdinalPanFor(10, range, plotDimensions, AxisLocation.Bottom)
            expect(panned.current.start).toBe(range.current.start)
            expect(panned.current.end).toBe(range.current.end)
        })

        it('allows the same pan for a left-located (y) axis because the range already covers the plot height', () => {
            const panned = calculateOrdinalPanFor(10, range, plotDimensions, AxisLocation.Left)
            expect(panned.current.start).toBe(range.current.start + 10)
            expect(panned.current.end).toBe(range.current.end + 10)
        })
    })

    describe('ordinalAxisZoomHandler', () => {
        function zoomAndCaptureOriginalRange(location: AxisLocation): { start: number, end: number } {
            const axis = fakeOrdinalAxis(location)
            const axesState = AxesState.from<OrdinalStringAxis>(new Map([['axis-1', axis]]))
            const ranges = new Map<string, OrdinalAxisRange>([
                ['axis-1', OrdinalAxisRange.from(0, 100, 0, 100)],
            ])
            let capturedOriginalRange: { start: number, end: number } | undefined
            const setOriginalRangeFor = (_axisId: string, range: { start: number, end: number }) => {
                capturedOriginalRange = range
            }
            const handler = ordinalAxisZoomHandler(['axis-1'], margin, () => {
            }, setOriginalRangeFor, axesState, [0, Infinity])
            handler(1.5, 50, plotDimensions, ranges)
            expect(capturedOriginalRange).toBeDefined()
            return capturedOriginalRange as { start: number, end: number }
        }

        it("uses the plot's width for a bottom-located (x) axis original range", () => {
            const originalRange = zoomAndCaptureOriginalRange(AxisLocation.Bottom)
            expect(originalRange.end).toBe(plotDimensions.width)
        })

        it("uses the plot's height, not the width, for a left-located (y) axis original range", () => {
            const originalRange = zoomAndCaptureOriginalRange(AxisLocation.Left)
            expect(originalRange.end).toBe(plotDimensions.height)
        })
    })
})
