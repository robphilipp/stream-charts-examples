import type {Visibility} from "../../options/visibility.ts";
import type {StateCreator} from "zustand";

export type VisibilityStateSlice = {
    visibility: Visibility
}

export type VisibilityActionSlice = {
    setVisibility: (visibility: Visibility) => void
    setTooltipVisibility: (visibility: boolean) => void
    setTrackerVisibility: (visibility: boolean) => void
    setMarkersVisibility: (visibility: boolean) => void
    setLegendVisibility: (visibility: boolean) => void
}

export type VisibilitySlice = VisibilityStateSlice & VisibilityActionSlice

export function visibilitySliceStateCreator(initialState: VisibilityStateSlice): StateCreator<VisibilitySlice, [], [], VisibilitySlice> {
    return (set, get) => ({
        visibility: initialState.visibility,
        setVisibility: (visibility: Visibility) => set({visibility}),
        setTooltipVisibility: (visibility: boolean) => set({visibility: {...get().visibility, tooltip: visibility}}),
        setTrackerVisibility: (visibility: boolean) => set({visibility: {...get().visibility, tracker: visibility}}),
        setMarkersVisibility: (visibility: boolean) => set({visibility: {...get().visibility, markers: visibility}}),
        setLegendVisibility: (visibility: boolean) => set({visibility: {...get().visibility, legend: visibility}}),
    })
}