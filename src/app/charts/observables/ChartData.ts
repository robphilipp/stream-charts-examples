export interface ChartData {
    seriesNames: Set<string>
}

export function defaultChartData(): ChartData {
    return {
        seriesNames: new Set<string>()
    }
}

export function copyChartData(data: ChartData) {
    return {
        seriesNames: new Set(data.seriesNames.values()),
    }
}