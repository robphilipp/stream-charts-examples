import {createContext, useContext} from "react";
import type {TooltipData} from "./useTooltip";
import {defaultMouseValues} from "./defaultMouseValues";

export type TooltipMouseOverHandlerFn<D, TM> = (
    seriesName: string,
    time: number,
    tooltipData: TooltipData<D, TM>,
    mouseCoords: [x: number, y: number],
    providerId?: string
) => void

export type TooltipMouseLeaveHandlerFn = (seriesName: string) => void

/**
 * Type representing the values exposed through the {@link useMouse} react hook.
 * @template D The type of the data object for the series
 * @template TM The type of the metadata object for the series
 */
export type UseMouseValues<D, TM> = {
    /**
     * Adds a mouse-over-series handler with the specified ID and handler function
     * @param handlerId The handler ID
     * @param handler The handler function called when a mouse-over-series event occurs.
     * The handler function is handed the series name, the time (x-value), the actual
     * series, and the mouse coordinates over which the mouse has moved over.
     * @return The handler ID.
     */
    registerMouseOverHandler: (
        handlerId: string,
        handler: (seriesName: string, time: number, tooltipData: TooltipData<D, TM>, mouseCoords: [x: number, y: number]) => void
    ) => string
    /**
     * Removes the mouse-over-series handler with the specified ID
     * @param handlerId The ID of the handler to remove
     */
    unregisterMouseOverHandler: (handlerId: string) => void
    /**
     * Attempts to retrieve the mouse-over-series handler for the specified ID
     * @param handlerId The ID of the handler
     * @return The mouse-over-series handler for the ID, or `undefined` if not found
     */
    mouseOverHandlerFor: (handlerId: string, providerId?: string) => TooltipMouseOverHandlerFn<D, TM> | undefined
    /**
     * Adds a mouse-leave-series handler with the specified ID and handler function
     * @param handlerId The handler ID
     * @param handler The handler function called when a mouse-leave-series event occurs
     * @return The handler ID
     */
    registerMouseLeaveHandler: (handlerId: string, handler: TooltipMouseLeaveHandlerFn) => string
    /**
     * Removes the mouse-leave-series handler with the specified ID
     * @param handlerId The ID of the handler to remove
     */
    unregisterMouseLeaveHandler: (handlerId: string) => void
    /**
     * Attempts to retrieve the mouse-leave-series handler for the specified ID
     * @param handlerId The ID of the handler
     * @return The mouse-leave-series handler for the ID, or `undefined` if not found
     */
    mouseLeaveHandlerFor: (handlerId: string, providerId?: string) => ((seriesName: string, providerId?: string) => void) | undefined
}

// the context is generic over the same type parameters as `UseMouseValues`, but a context
// object can't itself carry unbound generics -- `useMouse` below casts it back to the caller's
// concrete types, which is safe because `<MouseProvider/>` is what actually supplies the value
export const MouseContext = createContext<unknown>(defaultMouseValues())

/**
 * React hook that sets up the React context for the mouse values.
 * @return The {@link UseMouseValues} held in the React context.
 */
export function useMouse<D, TM>(): UseMouseValues<D, TM> {
    const context = useContext(MouseContext) as UseMouseValues<D, TM>
    const {mouseOverHandlerFor} = context
    if (mouseOverHandlerFor === undefined || mouseOverHandlerFor === null) {
        throw new Error("useMouse can only be used when the parent is a <MouseProvider/>")
    }
    return context
}
