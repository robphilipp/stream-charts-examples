export interface Visibility {
    tooltip: boolean;
    tracker: boolean;
    markers: boolean
    hideMarkersWhileRunning: boolean
    legend: boolean;
    highlightAxes: boolean;
}

export const createInitialVisibility = (): Visibility => ({
    tooltip: false,
    tracker: false,
    markers: false,
    hideMarkersWhileRunning: true,
    legend: false,
    highlightAxes: false,
})

