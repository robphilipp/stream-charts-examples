import {filter, map, scan} from 'rxjs/operators';
import {Observable, range} from 'rxjs';

type Point = {
    x: number
    y: number
}

const pointFrom = (x: number, y: number): Point => ({x, y})
const emptyPoint = (): Point => ({x: NaN, y: NaN})
const isEmptyPoint = (point?: Point): boolean => point === undefined || (isNaN(point.x) && isNaN(point.y))
const nonEmptyPoint = (point?: Point): boolean => !isEmptyPoint(point)

type Accumulate = {
    // n-difference, which is the number of points between successive differences
    n: number
    // holds the previous n point (for successive-n differences)
    previous: Array<Point>
    // the current successive-n difference
    difference?: Point
}
const initialAccumulate = (n: number = 1): Accumulate => ({n, previous: []})

/**
 * Generates chart data
 * @param numPoints
 * @param valueFn
 */
function chartDataObservable(numPoints: number = 10, valueFn: (x: number) => number): Observable<Point> {
    return range(1, numPoints).pipe(map(value => pointFrom(value, valueFn(value))))
}

/**
 *
 * @param n The number of points back from which to calculate the `n-difference`
 * @param dataObservable Observable that is the source of the underlying data
 * @param useStartX Whether to use the x-value from the beginning of the interval as the x-value
 * for the difference (default), or whether to use the last x-value in the interval.
 */
function successiveDiffsObservable(
    n: number = 1,
    dataObservable: Observable<Point>,
    useStartX: boolean = true
): Observable<Point> {
    return dataObservable
        .pipe(
            scan(({n, previous,}, current) => {
                // when we have accumulated enough previous values to cover the "n-difference",
                // we can calculate an actual difference
                if (previous.length >= n) {
                    // add the new point, and take the first point from the beginning
                    previous.push(current)
                    const first: Point = previous.shift() || emptyPoint()

                    // calculate the n-difference, using the x-value of the initial point (default)
                    // or the current point (end of current time-range
                    const difference = pointFrom(
                        useStartX ? first.x : current.x,
                        current.y - first.y
                    )

                    return {n, previous, difference}
                }

                // not enough points yet, so just accumulate the current point
                previous.push(current)

                return {n, previous}

            }, initialAccumulate(n)),
            filter(accum => nonEmptyPoint(accum.difference)),
            map(accum => accum.difference === undefined ? emptyPoint() : accum.difference)
        )
}

describe('should be able to calculate successive differences', () => {

    test('should be able to calc successive-diffs for x^2 where x is in 1..10', done => {
        let results: Array<Point> = []
        successiveDiffsObservable(1, chartDataObservable(10, x => x * x), true).subscribe(point => results.push(point))
        done()
        expect(results).toHaveLength(9)
        expect(results).toEqual([
            {x: 1, y:  3},
            {x: 2, y:  5},
            {x: 3, y:  7},
            {x: 4, y:  9},
            {x: 5, y: 11},
            {x: 6, y: 13},
            {x: 7, y: 15},
            {x: 8, y: 17},
            {x: 9, y: 19},
        ])
    });

    test('should be able to calc successive-diffs for x^2 where x is in 1..10 using interval end', done => {
        let results: Array<Point> = []
        successiveDiffsObservable(1, chartDataObservable(10, x => x * x), false).subscribe(point => results.push(point))
        done()
        expect(results).toHaveLength(9)
        expect(results).toEqual([
            {x:  2, y:  3},
            {x:  3, y:  5},
            {x:  4, y:  7},
            {x:  5, y:  9},
            {x:  6, y: 11},
            {x:  7, y: 13},
            {x:  8, y: 15},
            {x:  9, y: 17},
            {x: 10, y: 19},
        ])
    });

    test('should be able to calc 3-diffs for x^2 where x is in 1..10', done => {
        let results: Array<Point> = []
        successiveDiffsObservable(3, chartDataObservable(10, x => x * x), true).subscribe(point => results.push(point))
        done()
        expect(results).toHaveLength(7)
        expect(results).toEqual([
            {x: 1, y: 15},
            {x: 2, y: 21},
            {x: 3, y: 27},
            {x: 4, y: 33},
            {x: 5, y: 39},
            {x: 6, y: 45},
            {x: 7, y: 51},
        ])
    });

    test('should be able to calc 3-diffs for x^2 where x is in 1..10 using interval end', done => {
        let results: Array<Point> = []
        successiveDiffsObservable(3, chartDataObservable(10, x => x * x), false).subscribe(point => results.push(point))
        done()
        expect(results).toHaveLength(7)
        expect(results).toEqual([
            {x:  4, y: 15},
            {x:  5, y: 21},
            {x:  6, y: 27},
            {x:  7, y: 33},
            {x:  8, y: 39},
            {x:  9, y: 45},
            {x: 10, y: 51},
        ])
    });
})

function iteratesObservable(n: number = 1, dataObservable: Observable<Point>): Observable<Point> {
    return dataObservable
        .pipe(
            scan(({n, previous,}, current) => {
                // when we have accumulated enough previous values to cover the "n-iterate",
                // we can grab the y-value from the n-th point back
                if (previous.length >= n) {
                    // add the new point, and take the first point from the beginning
                    previous.push(pointFrom(previous[previous.length-1].y, current.y))
                    const first: Point = previous.shift() || emptyPoint()

                    // calculate the n-difference, using the x-value of the initial point (default)
                    // or the current point (end of current time-range
                    const iterate = pointFrom(first.y, current.y)

                    return {n, previous, difference: iterate}
                }

                // not enough points yet, so just accumulate the current point
                previous.push(current)

                return {n, previous}

            }, initialAccumulate(n)),
            filter(accum => nonEmptyPoint(accum.difference)),
            map(accum => accum.difference === undefined ? emptyPoint() : accum.difference)
        )
}

describe('should be able to calculate iterates', () => {

    test('should be able to calc 1-iterates for x^2 where x is in 1..10', done => {
        let results: Array<Point> = []
        iteratesObservable(1, chartDataObservable(10, x => 2 * x)).subscribe(point => results.push(point))
        done()
        expect(results).toHaveLength(9)
        expect(results).toEqual([
            {x:  2, y:  4},
            {x:  4, y:  6},
            {x:  6, y:  8},
            {x:  8, y: 10},
            {x: 10, y: 12},
            {x: 12, y: 14},
            {x: 14, y: 16},
            {x: 16, y: 18},
            {x: 18, y: 20}
        ])
    });

    test('should be able to calc 1-iterates for x^2 where x is in 1..10', done => {
        let results: Array<Point> = []
        iteratesObservable(3, chartDataObservable(10, x => 2 * x)).subscribe(point => results.push(point))
        done()
        expect(results).toHaveLength(7)
        expect(results).toEqual([
            {x:  2, y:  8},
            {x:  4, y: 10},
            {x:  6, y: 12},
            {x:  8, y: 14},
            {x: 10, y: 16},
            {x: 12, y: 18},
            {x: 14, y: 20}
        ])
    });
})