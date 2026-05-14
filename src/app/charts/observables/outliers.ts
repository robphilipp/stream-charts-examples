import type {ChartData} from "./ChartData.ts";
import type {OutlierDatum} from "../series/outlierSeries.ts";

/**
 * Converts an observable of {@link TimeSeriesChartData} into an observable of {@link OutlierDatum}
 */
export interface OutlierChartData<M extends readonly number[]> extends ChartData {

    /**
     * Maps the series name to the new outlier datum for that series
     */
    newPoints: Map<string, Array<OutlierDatum<M>>>
}