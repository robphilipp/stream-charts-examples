import type {Series} from "../plots/plot";
import type {TooltipDimensions} from "../tooltips/tooltipUtils";
import {createContext, useContext} from "react";
import {defaultTooltipValues} from "./defaultTooltipValues";

/**
 * Base interface for tooltip data that is passed through to the tooltip content provider
 * @template D The type of the data object for the series
 * @template M The type of the metadata object for the series
 */
export interface TooltipData<D, M> {
    series: Series<D>
    metadata: M
}

/**
 * A higher-order function that returns a function that provides the tooltip content or
 * `undefined` if no tooltip content is available.
 * @return The tooltip content, or `undefined` if no tooltip content is available.
 * @param seriesName The name of the series for which the tooltip content is being provided
 * @param time The time (x-value) for which the tooltip content is being provided
 * @param tooltipData The tooltip data
 * @param mouseCoords The mouse coordinates over which the mouse is hovering
 * @param providerId An optional ID of the tooltip content provider.
 * @template D The type of the data object for the series
 * @template M The type of the metadata object for the series
 */
export type TooltipContentProvider<D, M> =
    (seriesName: string, time: number, tooltipData: TooltipData<D, M>, mouseCoords: [x: number, y: number], providerId?: string) => TooltipDimensions

/**
 * The functions and values exposed through the {@link useTooltip} react hook
 * @template D The type of the data object for the series
 * @template M The type of the metadata object for the series
 */
export type UseTooltipValues<D, M> = {
    /**
     * Registers the provider of the tooltip content (generally the plot will register this).
     * When this function is called again, overwrites the previously registered provider with the
     * one specified. This function can be called repeatedly.
     * @param provider The function that provides the content when called.
     */
    registerTooltipContentProvider: (provider: TooltipContentProvider<D, M>) => void

    /**
     * @return The registered function that provides the tooltip content. If no function has been
     * registered, then returns `undefined`.
     */
    tooltipContentProvider: () => (TooltipContentProvider<D, M> | undefined)

    /**
     * Callback that sets the visibility state of the tooltip. This is used to control whether the tooltip is
     * visible or not.
     * @param visible Whether the tooltip should be visible or not.
     */
    setVisibilityState: (visible: boolean) => void

    /**
     * @return Whether the tooltip is currently visible or not.
     */
    visibilityState: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TooltipContext = createContext<UseTooltipValues<any, any>>(defaultTooltipValues())

/**
 * React hook that sets up the React context for the mouse values.
 * @return The {@link UseTooltipValues} held in the React context.
 */
export function useTooltip<D, M>(): UseTooltipValues<D, M> {
    const context = useContext<UseTooltipValues<D, M>>(TooltipContext)
    const {registerTooltipContentProvider} = context
    if (registerTooltipContentProvider === undefined || registerTooltipContentProvider === null) {
        throw new Error("useTooltip can only be used when the parent is a <TooltipProvider/>")
    }
    return context
}