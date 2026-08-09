import type {StateCreator} from "zustand";

export type RunStateSlice = {
    running: boolean
}

export type RunActionSlice = {
    setRunning: (running: boolean) => void
    startRunning: () => void
    stopRunning: () => void
}

export type RunSlice = RunStateSlice & RunActionSlice

export function runSliceStateCreator(initialState: RunStateSlice): StateCreator<RunSlice, [], [], RunSlice> {
    return (set) => ({
        running: initialState.running,
        setRunning: (running: boolean) => set({running}),
        startRunning: () => set({running: true}),
        stopRunning: () => set({running: false}),
    })
}