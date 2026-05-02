import {outlierBoundsFor, outlierDatumFor, OutlierSeries, outlierSeriesFor} from "./outlierSeries";
import {Datum} from "./timeSeries";

describe('when creating outlier datum', () => {
    it('should be able to create an outlier datum with bounds and measures as long as there is a measure for each bound', () => {
        const Measures = [50, 92] as const
        const value: Datum = {time: 1, value: 10}
        const bounds = [
            outlierBoundsFor(21, 121),
            outlierBoundsFor(2, 52)
        ] as const
        const datum = outlierDatumFor<typeof Measures>(value, Measures, bounds)
        expect(datum).toBeDefined()
        expect(datum.bounds).toHaveLength(Measures.length)
        expect(datum.measures[0]).toBe(50)
        expect(datum.measures[1]).toBe(92)
    })

    it('should not be able to create an outlier datum when the number of measures does not equal the number of bounds', () => {
        const Measures = [50, 92] as const
        const value: Datum = {time: 1, value: 10}
        // @ts-expect-error - bounds length must equal measures length
        outlierDatumFor<typeof Measures>(value, Measures, [
            {lower: 0, upper: 121},
            {lower: 0, upper: 100},
            {lower: 0, upper: 52}
        ])
    })
})

describe('when creating an outlier series', () => {
    it('should be able to create an outlier series', () => {
        const Measures = [50, 92] as const
        const series: OutlierSeries<typeof Measures> = outlierSeriesFor<typeof Measures>(
            'series1',
            Measures,
            [
                [1, 11, [outlierBoundsFor(21, 121), outlierBoundsFor(2, 52)]],
                [2, 12, [outlierBoundsFor(22, 122), outlierBoundsFor(3, 53)]]
            ]
        )
        expect(series).toBeDefined()
        expect(series.data).toHaveLength(Measures.length)
    })
})