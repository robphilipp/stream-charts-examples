export interface Visibility {
    tooltip: boolean;
    tracker: boolean;
    markers: boolean
    legend: boolean;
}

export const createInitialVisibility = (): Visibility => ({
    tooltip: false,
    tracker: false,
    markers: false,
    legend: false,
})

