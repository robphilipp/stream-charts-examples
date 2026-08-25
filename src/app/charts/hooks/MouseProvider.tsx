import {type JSX, useRef} from "react";
import type {TooltipData} from "./useTooltip";
import {MouseContext, type UseMouseValues} from "./useMouse";

export type Props = {
    children: JSX.Element | Array<JSX.Element>
}

/**
 * The mouse context provider allows registering and retrieving mouse over and mouse leave handlers.
 * @param props The properties holding the children
 * @return A JSX element containing the children
 * @template D The type of the data object for the series
 * @template TM The type of the metadata object for the series
 */
export default function MouseProvider<D, TM>(props: Props): JSX.Element {
    const {children} = props

    const mouseOverHandlersRef = useRef<Map<string, (seriesName: string, time: number, tooltipData: TooltipData<D, TM>, mouseCoords: [x: number, y: number], providerId?: string) => void>>(new Map())
    const mouseLeaveHandlersRef = useRef<Map<string, (seriesName: string, providerId?: string) => void>>(new Map())

    // the context's `value` prop is typed as `unknown` (see `MouseContext` in `useMouse.tsx`), so
    // the object literal needs its own explicit type here to give the handler functions below
    // their parameter types -- otherwise they'd fall back to implicit `any`
    const value: UseMouseValues<D, TM> = {
        registerMouseOverHandler: (handlerId, handler) => {
            mouseOverHandlersRef.current.set(handlerId, handler)
            return handlerId
        },
        unregisterMouseOverHandler: handlerId => mouseOverHandlersRef.current.delete(handlerId),
        mouseOverHandlerFor: (_handlerId, providerId) => {
            if (mouseOverHandlersRef.current.size === 0) return undefined
            return (seriesName: string, time: number, tooltipData: TooltipData<D, TM>, mouseCoords: [x: number, y: number]) => {
                mouseOverHandlersRef.current.forEach(handler => {
                    handler(seriesName, time, tooltipData, mouseCoords, providerId)
                })
            }
        },

        registerMouseLeaveHandler: (handlerId, handler) => {
            mouseLeaveHandlersRef.current.set(handlerId, handler)
            return handlerId
        },
        unregisterMouseLeaveHandler: handlerId => mouseLeaveHandlersRef.current.delete(handlerId),
        mouseLeaveHandlerFor: (_handlerId, providerId) => {
            if (mouseLeaveHandlersRef.current.size === 0) return undefined
            return (seriesName: string) => {
                mouseLeaveHandlersRef.current.forEach(handler => {
                    handler(seriesName, providerId)
                })
            }
        },
    }

    return <MouseContext.Provider value={value}>
        {children}
    </MouseContext.Provider>
}