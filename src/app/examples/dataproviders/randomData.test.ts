// import {initialChartData, seriesFromTuples} from "stream-charts";

import {timeSeriesFromTuples} from "../../charts/series/timeSeries.ts";
import {initialTimeSeriesChartData, type TimeSeriesChartData} from "../../charts/series/timeSeriesChartData.ts";
import {seriesFrom} from "../../charts/series/baseSeries.ts";
import {type OrdinalDatum, ordinalDatumOf} from "../../charts/series/ordinalSeries.ts";
import {barDanceDataObservable} from "./randomOrdinalData.ts";

describe('when creating random data from an initial series', () => {
    const initialData = [
        timeSeriesFromTuples('test1', [
            [10, 80], [20, 220], [30, 300], [40, 380], [50, 510], [60, 620], [70, 680],
            [80, 1080], [90, 980], [100, 880], [110, 980]
        ]),
        // seriesFromTuples('test2', [
        //     [100, 980], [200, 880], [300, 980], [400, 1080], [500, 680], [600, 620], [700, 510],
        //     [800, 380], [900, 300], [1000, 20], [1100, 180], [1200, 180], [1300, 480],
        // ]),
        timeSeriesFromTuples('test3', [
            [10, 100], [20, 103], [30, 110], [40, 100], [50, 90], [60, 88], [70, 160], [80, 130],
            [90, 100], [100, 120], [110, 100], [120, -250], [130, 120], [150, 180], [170, 280],
        ]),
    ]

    it('should create initial data', () => {
        const data = initialTimeSeriesChartData(initialData)
        expect(data.maxTime).toBe(170)
        expect(data.newPoints.size).toBe(2)
        const p1 = data.newPoints.get('test1')
        const p3 = data.newPoints.get('test3')
        expect(p1).toBeDefined()
        expect(p3).toBeDefined()
        expect(p1?.length).toBe(1)
        expect(p3?.length).toBe(1)
        expect((p1 || [])[0].x).toBe(110)
        expect((p3 || [])[0].x).toBe(170)
        expect((p1 || [])[0].y).toBe(980)
        expect((p3 || [])[0].y).toBe(280)
    })
})

describe('dancing-bar data (barDanceDataObservable)', () => {
    afterEach(() => jest.useRealTimers())

    const existing = [
        seriesFrom<OrdinalDatum>('a', [ordinalDatumOf(0, 'a', 0.1), ordinalDatumOf(1000, 'a', 0.2)]),
        seriesFrom<OrdinalDatum>('b', [ordinalDatumOf(0, 'b', 0.3), ordinalDatumOf(1000, 'b', 0.4)]),
    ]

    it('emits only new data, continuing one update period after the latest existing datum', () => {
        jest.useFakeTimers()
        const emitted: Array<TimeSeriesChartData> = []
        const subscription = barDanceDataObservable(existing, 50).subscribe(data => emitted.push(data))

        // nothing (in particular, not the existing data) until the first tick
        expect(emitted).toHaveLength(0)

        jest.advanceTimersByTime(100)
        subscription.unsubscribe()

        expect(emitted).toHaveLength(2)
        expect(emitted.map(data => data.newPoints.get('a')!.map(datum => datum.x))).toEqual([[1050], [1100]])
        expect(emitted[0].newPoints.get('b')!).toHaveLength(1)
    })
})
