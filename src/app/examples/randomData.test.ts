// import {initialChartData, seriesFromTuples} from "stream-charts";

import {timeSeriesFromTuples} from "../charts/series/timeSeries";
import {initialTimeSeriesChartData} from "../charts/series/timeSeriesChartData";

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
        expect((p1 || [])[0].time).toBe(110)
        expect((p3 || [])[0].time).toBe(170)
        expect((p1 || [])[0].value).toBe(980)
        expect((p3 || [])[0].value).toBe(280)
    })
})