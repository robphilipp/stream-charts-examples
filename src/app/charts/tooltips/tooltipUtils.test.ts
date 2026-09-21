import {boundingPoints} from "./tooltipUtils";

type Point = { x: number, y: number }

const emptyPoint = (): Point => ({x: NaN, y: NaN})

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
