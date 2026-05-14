// import {interval, Observable} from "rxjs";
// import {TimeSeriesChartData} from "../charts/series/timeSeriesChartData";
// import {OutlierDatum, OutlierSeries} from "../charts/series/outlierSeries";
// import {map} from "rxjs/operators";
//
// const Measures = [0.75, 0.95] as const

// export function randomOutlierDataObservable(
//     baseFunction: (x: number, sigma: number) => OutlierDatum<typeof Measures>,
//     sigmaNoise: number = 1,
//     updatePeriod: number = 25,
// ): Observable<TimeSeriesChartData> {
//     // return Array.from({ length: n }, () => Math.random() * 100)
//     return interval(updatePeriod).pipe(
//         map(() => {
//             const x = Math.random() * 100;
//             const y = baseFunction(x, sigmaNoise);
//             return { x, y };
//         })
//     )
// }
