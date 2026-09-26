import {boundingPoints, removeTooltip} from "./tooltipUtils";

type Point = { x: number, y: number }

const emptyPoint = (): Point => ({x: NaN, y: NaN})

/**
 * A minimal structural fake of a DOM `ParentNode`/`Element` -- just enough surface for
 * `removeTooltip` to touch (`querySelectorAll`, and `remove()` on whatever it returns). No jsdom
 * in this project, so plain object fakes stand in for real DOM nodes (same technique used
 * elsewhere in this suite, e.g. `subscriptions.test.ts`'s `document` stub).
 */
function fakeScope(elementCount: number): {scope: ParentNode, removeSpies: Array<jest.Mock>} {
    const removeSpies = Array.from({length: elementCount}, () => jest.fn())
    const elements = removeSpies.map(remove => ({remove}))
    const scope = {
        querySelectorAll: jest.fn(() => elements),
    } as unknown as ParentNode
    return {scope, removeSpies}
}

describe('boundingPoints', () => {
    test('should not throw on an empty series, returning two empty datums', () => {
        const [before, after] = boundingPoints<Point>([], 10, p => p.x, emptyPoint)
        expect(before).toEqual(emptyPoint())
        expect(after).toEqual(emptyPoint())
    })

    test('should find the bounding points for a value in the middle of the series', () => {
        const data: Array<Point> = [{x: 0, y: 1}, {x: 10, y: 2}, {x: 20, y: 3}]
        const [before, after] = boundingPoints<Point>(data, 15, p => p.x, emptyPoint)
        expect(before).toEqual(data[1])
        expect(after).toEqual(data[2])
    })

    test('should return an empty "before" datum when the value is before the first point', () => {
        const data: Array<Point> = [{x: 10, y: 1}, {x: 20, y: 2}]
        const [before, after] = boundingPoints<Point>(data, 0, p => p.x, emptyPoint)
        expect(before).toEqual(emptyPoint())
        expect(after).toEqual(data[0])
    })

    test('should return an empty "after" datum when the value is after the last point', () => {
        const data: Array<Point> = [{x: 10, y: 1}, {x: 20, y: 2}]
        const [before, after] = boundingPoints<Point>(data, 30, p => p.x, emptyPoint)
        expect(before).toEqual(data[1])
        expect(after).toEqual(emptyPoint())
    })
})

// guards against a regression of M12: removeTooltip used to query `document` unscoped, so it
// removed every `.tooltip` element on the whole page -- any other chart instance's tooltip, or
// any unrelated host-app element that happened to also use the `tooltip` class, got swept up too
describe('removeTooltip', () => {
    test('removes every matched element within the given scope', () => {
        const {scope, removeSpies} = fakeScope(2)

        removeTooltip(scope)

        expect(scope.querySelectorAll).toHaveBeenCalledWith('.tooltip')
        removeSpies.forEach(remove => expect(remove).toHaveBeenCalledTimes(1))
    })

    test('does not touch a different scope, e.g. a second chart instance\'s own overlay container', () => {
        const chartA = fakeScope(1)
        const chartB = fakeScope(1)

        removeTooltip(chartA.scope)

        expect(chartA.removeSpies[0]).toHaveBeenCalledTimes(1)
        expect(chartB.scope.querySelectorAll).not.toHaveBeenCalled()
        expect(chartB.removeSpies[0]).not.toHaveBeenCalled()
    })

    test('does nothing when the scope has no matching elements', () => {
        const {scope} = fakeScope(0)

        expect(() => removeTooltip(scope)).not.toThrow()
    })
})
