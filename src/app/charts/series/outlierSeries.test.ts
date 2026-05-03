import {outlierBoundsFor, outlierDatumFor, OutlierSeries, outlierSeriesFor} from "./outlierSeries";
import {datumOf} from "./timeSeries";

describe('when creating outlier datum', () => {
    it('should be able to create an outlier datum with bounds and measures as long as there is a measure for each bound', () => {
        const Measures = [50, 92] as const
        const value = datumOf(1, 10)
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
        const value = datumOf(1, 10)
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
                [
                    1, 11, // (x, y)
                    [
                        outlierBoundsFor(21, 121),  // bounds for measure = 50
                        outlierBoundsFor(2, 52)     // bounds for measure = 92
                    ]
                ],
                [2, 12, [outlierBoundsFor(22, 122), outlierBoundsFor(3, 53)]],
                [3, 13, [outlierBoundsFor(23, 123), outlierBoundsFor(4, 54)]]
            ]
        )
        expect(series).toBeDefined()
        expect(series.name).toBe('series1')
        expect(series.data).toHaveLength(3)

        // all the bounds should have the same length and values as the measures
        series.data.forEach(datum => {
            expect(datum.bounds).toHaveLength(Measures.length)
            expect(datum.measures).toEqual([50, 92])
        })

        // each datum may have a different set of bounds, but they should be the
        // same as the ones used to create the series
        expect(series.data[0].bounds[0]).toEqual({lower: 21, upper: 121})
        expect(series.data[0].bounds[1]).toEqual({lower: 2, upper: 52})

        expect(series.data[1].bounds[0]).toEqual({lower: 22, upper: 122})
        expect(series.data[1].bounds[1]).toEqual({lower: 3, upper: 53})

        expect(series.data[2].bounds[0]).toEqual({lower: 23, upper: 123})
        expect(series.data[2].bounds[1]).toEqual({lower: 4, upper: 54})
    })

    it('should not be able to create an outlier series when the bounds for a datum does not have the correct length', () => {
        const Measures = [50, 92] as const
        outlierSeriesFor<typeof Measures>(
            'series1',
            Measures,
            [
                [
                    1, 11, // (x, y)
                    // @ts-expect-error - bounds for datum should have the same length as measures
                    [
                        outlierBoundsFor(21, 121),  // bounds for measure = 50
                        outlierBoundsFor(2, 52),    // bounds for measure = 92
                        outlierBoundsFor(2, 52)     // oops, this is a compile-time error
                    ]
                ],
                [2, 12, [outlierBoundsFor(22, 122), outlierBoundsFor(3, 53)]],
                [3, 13, [outlierBoundsFor(23, 123), outlierBoundsFor(4, 54)]]
            ]
        )
    })
})