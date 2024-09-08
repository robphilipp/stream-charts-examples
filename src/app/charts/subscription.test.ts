import {filter, map, pairwise, scan, take} from 'rxjs/operators';
import {interval, Observable, range} from 'rxjs';

type Point = {
    x: number
    y: number
}

const pointFrom = (x: number, y: number): Point => ({x, y})
const emptyPoint = (): Point => ({x: NaN, y: NaN})
const isEmptyPoint = (point?: Point): boolean => point === undefined || (isNaN(point.x) && isNaN(point.y))
const nonEmptyPoint = (point?: Point): boolean => !isEmptyPoint(point)

type Accumulate = {
    n: number
    // holds the previous n point (for successive-n differences)
    previous: Array<Point>
    // the current successive-n difference
    difference?: Point
}
const initialAccumulate = (n: number = 1): Accumulate => ({n, previous: []})

/**
 *
 * @param n The number of points back from which to calulate the `n-difference`
 * @param numPoints The number of points to generate
 * @param useStartX Whether to use the x-value from the beginning of the interval as the x-value
 * for the difference (default), or whether to use the last x-value in the interval.
 */
function successiveDiffsObservable(n: number = 1, numPoints: number = 10, useStartX: boolean = true): Observable<Point> {
    return range(1, numPoints)
        .pipe(
            map(value => pointFrom(value, value * value)),
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

    test('create pairwise', done => {
        successiveDiffsObservable(3, 10, false)
            .subscribe(({x, y}: Point) => {
                console.log(`(${x}, ${y})`)
                // expect(y).toBe(2 * x + 1) // (i+1)*(i+1) - i*i
                fail()
            })
        done()
    });
})