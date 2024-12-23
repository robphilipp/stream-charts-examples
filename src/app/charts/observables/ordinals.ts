/**
 * Converts an observable of {@link TimeSeriesChartData} into an observable of {@link OrdinalChartData} for
 * plotting categorical data.
 * 1. Convert series to chart data observable in the usual way
 * 2. Accepts that chart-data observable and converts that observable to an ordinal-chart-data observable
 */
import {Observable} from "rxjs";
import {TimeSeriesChartData} from "../series/timeSeriesChartData";
import {map, scan} from "rxjs/operators";
import {Datum} from "../series/timeSeries";
import {copyOrdinalDatum, nonEmptyOrdinalDatum, OrdinalDatum, ordinalDatumOf} from "../series/ordinalSeries";
import {ChartData, copyChartData, defaultChartData} from "./ChartData";

export interface OrdinalChartData extends ChartData {
    stats: OrdinalStats
    /**
     * Map holding the name of the series (the time-series identifier) and the associated
     * data points for that time-series (`map(series_name -> array(datum))`)
     */
    newPoints: Map<string, Array<OrdinalDatum>>
}

export interface OrdinalStats {
    /**
     * The min values for (time, value) for the data in the newPoints map
     */
    minDatum: OrdinalDatumExtremum

    /**
     * The max values for (time, iterate n, and iterate n+1) for the data in the newPoints map
     */
    maxDatum: OrdinalDatumExtremum

    valueStatsForSeries: Map<string, OrdinalValueStats>

    // forSeries: (seriesName: string) => OrdinalValueStats
    // /**
    //  * Holds the association of the series name to the ordinal-datum with current min value for that category
    //  */
    // minValueInCategory: Map<string, OrdinalDatum>
    //
    // /**
    //  * Holds the association of the series name to the ordinal-datum with current max value for that category
    //  */
    // maxValueInCategory: Map<string, OrdinalDatum>
    //
    // countInCategory: Map<string, number>
    // sumInCategory: Map<string, number>
    // sumSquaredInCategory: Map<string, number>
    // meanInCategory: Map<string, number>
}

export type OrdinalValueStats = {
    min: OrdinalDatum
    max: OrdinalDatum
    count: number
    sum: number
    sumSquared: number
    mean: number
}

export type OrdinalDatumExtremum = {
    // holds the ordinal datum with the minimum or maximum time
    time: OrdinalDatum
    // holds the ordinal datum with the minimum or maximum value
    value: OrdinalDatum
}

const initialMinValueDatum = (): OrdinalDatum => ordinalDatumOf(NaN, "", Infinity)
const initialMaxValueDatum = (): OrdinalDatum => ordinalDatumOf(NaN, "", -Infinity)

const initialMinOrdinalDatum = (): OrdinalDatumExtremum => ({
    time: ordinalDatumOf(Infinity, "", NaN),
    value: initialMinValueDatum()
})

const initialMaxOrdinalDatum = (): OrdinalDatumExtremum => ({
    time: ordinalDatumOf(-Infinity, "", NaN),
    value: initialMaxValueDatum()
})

function copyOrdinalDatumExtremum(datum: OrdinalDatumExtremum): OrdinalDatumExtremum {
    return {
        time: copyOrdinalDatum(datum.time),
        value: copyOrdinalDatum(datum.value)
    }
}

export const defaultOrdinalStats = (): OrdinalStats => ({
    minDatum: initialMinOrdinalDatum(),
    maxDatum: initialMaxOrdinalDatum(),
    valueStatsForSeries: new Map<string, OrdinalValueStats>()
})

const defaultOrdinalValueStats = (): OrdinalValueStats => ({
    min: initialMinValueDatum(),
    max: initialMaxValueDatum(),
    count: 0,
    sum: 0,
    mean: NaN,
    sumSquared: NaN,
})

const copyOrdinalValueStats = (data: OrdinalValueStats) => ({...data})

export const copyOrdinalStats = (data: OrdinalStats): OrdinalStats => ({
    minDatum: copyOrdinalDatumExtremum(data.minDatum),
    maxDatum: copyOrdinalDatumExtremum(data.maxDatum),
    valueStatsForSeries: new Map<string, OrdinalValueStats>(Array.from(data.valueStatsForSeries.entries())
        .map(([seriesName, valueStats]) => [seriesName, copyOrdinalValueStats(valueStats)])
    ),
})

const emptyOrdinalData = (): OrdinalChartData => ({
    ...defaultChartData(),
    stats: defaultOrdinalStats(),
    // minDatum: initialMinOrdinalDatum(),
    // maxDatum: initialMaxOrdinalDatum(),
    // minValueInCategory: new Map<string, OrdinalDatum>(),
    // maxValueInCategory: new Map<string, OrdinalDatum>(),
    // countInCategory: new Map<string, number>(),
    // sumInCategory: new Map<string, number>(),
    // sumSquaredInCategory: new Map<string, number>(),
    // meanInCategory: new Map<string, number>(),
    newPoints: new Map<string, Array<OrdinalDatum>>()
})

/**
 * Makes a deep copy of the ordinal chart data
 * @param data The ordinal chart data to copy
 */
export const copyOrdinalDataFrom = (data: OrdinalChartData): OrdinalChartData => ({
    ...copyChartData(data),
    stats: copyOrdinalStats(data.stats),
    // minDatum: copyOrdinalDatumExtremum(data.minDatum),
    // maxDatum: copyOrdinalDatumExtremum(data.maxDatum),
    // minValueInCategory: new Map(Array.from(data.minValueInCategory.entries()).map(([seriesName, extremum]) => [seriesName, copyOrdinalDatum(extremum)])),
    // maxValueInCategory: new Map(Array.from(data.maxValueInCategory.entries()).map(([seriesName, extremum]) => [seriesName, copyOrdinalDatum(extremum)])),
    // countInCategory: new Map(data.countInCategory),
    // sumInCategory: new Map(data.sumInCategory),
    // sumSquaredInCategory: new Map(data.sumSquaredInCategory),
    // meanInCategory: new Map(data.meanInCategory),
    newPoints: new Map<string, Array<OrdinalDatum>>(Array.from(data.newPoints.entries()).map(([name, points]) => [name, points.slice()])),
})

type Accumulator = {
    previous: Map<string, Array<Datum>>
    accumulated: OrdinalChartData
}

const initialAccumulate = (): Accumulator => ({previous: new Map(), accumulated: emptyOrdinalData()})

/**
 * Accepts a {@link TimeSeriesChartData} observable and converts it to an observable of {@link OrdinalChartData}.
 * @param dataObservable The observable over {@link TimeSeriesChartData}
 * @return An observable of {@link OrdinalChartData} holding the series for the incoming chart data
 */
export function ordinalsObservable(dataObservable: Observable<TimeSeriesChartData>): Observable<OrdinalChartData> {
    return dataObservable
        .pipe(
            // calculate the iterates for each series in the chart data
            scan(({previous, accumulated}: Accumulator, current: TimeSeriesChartData) => {
                // make a deep copy of the accumulated data (because the accumulated data object
                // holds references to maps)
                const accum = copyOrdinalDataFrom(accumulated)

                // for each series, add the new points to the accumulated data
                Array
                    .from(current.newPoints.entries())
                    .forEach(([name, series]) => {
                        // grab the points from the previous incoming data and add the new
                        // data to the end  of the previous data (when the updated data
                        // didn't yet exist, add it to the map holding the previous series)
                        const updated = (previous.get(name) || [])
                        if (updated.length === 0) {
                            previous.set(name, updated)
                        }
                        updated.push(...series)

                        // add the series name to the list of all
                        accum.seriesNames.add(name)

                        // calculate the max-time, min-time, max-value, and min-value for
                        // all the data series
                        series.forEach(({time, value}: Datum, ) => {
                            // calculate the min and max times over all series
                            if (time < accum.stats.minDatum.time.time) {
                                accum.stats.minDatum.time = ordinalDatumOf(time, name, value)
                            } else if (time > accum.stats.maxDatum.time.time) {
                                accum.stats.maxDatum.time = ordinalDatumOf(time, name, value)
                            }
                            // calculate the min and max values over all series
                            if (value < accum.stats.minDatum.value.value) {
                                accum.stats.minDatum.value = ordinalDatumOf(time, name, value)
                            } else if (value > accum.stats.maxDatum.value.value) {
                                accum.stats.maxDatum.value = ordinalDatumOf(time, name, value)
                            }

                            // calculate the min, max of the time and value for each series
                            let valueStats: OrdinalValueStats = accum.stats.valueStatsForSeries.get(name) || defaultOrdinalValueStats()

                            const minValue = (value < valueStats.min.value) ?
                                ordinalDatumOf(time, name, value) :
                                copyOrdinalDatum(valueStats.min)
                            const maxValue = (value > valueStats.max.value) ?
                                ordinalDatumOf(time, name, value) :
                                copyOrdinalDatum(valueStats.max)
                            const count = valueStats.count + 1
                            const sum = valueStats.sum + value
                            valueStats = {
                                min: minValue,
                                max: maxValue,
                                count,
                                sum,
                                sumSquared: isNaN(valueStats.sumSquared) ? value * value : valueStats.sumSquared + value * value,
                                mean: sum / count
                            }

                            accum.stats.valueStatsForSeries.set(name, valueStats)
                        })

                        // convert the new points to ordinal datum
                        accum.newPoints.set(name, series.map(({time, value}: Datum) => ordinalDatumOf(time, name, value)))
                    })
                return {previous, accumulated: accum}
            }, initialAccumulate()),

            // remove new points from the map that are empty
            map(accum => removeEmptyNewPoints(accum)),
            map(accum => accum.accumulated === undefined ? emptyOrdinalData() : accum.accumulated)
        )
}

function removeEmptyNewPoints(accum: Accumulator): Accumulator {
    const newPoints = new Map(
        Array
            .from(accum.accumulated.newPoints.entries())
            .map(([name, points]) => [name, points.filter(point => nonEmptyOrdinalDatum(point))])
    )
    return {
        previous: accum.previous,
        accumulated: {
            ...accum.accumulated,
            newPoints
        }
    }
}