import {Series} from "../plot";
import {TooltipDimensions} from "../tooltipUtils";
import {createContext, JSX, useContext, useRef} from "react";

/**
 * No operation function for use when a default function is needed
 */
const noop = () => {
    /* empty on purpose */
}

export type UseTooltipValues = {
    /**
     * Registers the provider of the tooltip content (generally this will be registered by the plot).
     * When this function is called again, overwrites the previously registered provider with the
     * one specified. This function can be called repeatedly.
     * @param provider The function that provides the content when called.
     */
    registerTooltipContentProvider: (
        provider: (
            seriesName: string,
            time: number,
            series: Series,
            mouseCoords: [x: number, y: number]
        ) => TooltipDimensions) => void
    /**
     * @return The registered function that provides the tooltip content. If no function has been
     * registered, then returns `undefined`.
     */
    tooltipContentProvider: () =>
        ((seriesName: string, time: number, series: Series, mouseCoords: [x: number, y: number]) => TooltipDimensions) |
        undefined
}

export const defaultTooltipValues = (): UseTooltipValues => ({
    registerTooltipContentProvider: noop,
    tooltipContentProvider: () => undefined
})

const TooltipContext = createContext<UseTooltipValues>(defaultTooltipValues())

type Props = {
    children: JSX.Element | Array<JSX.Element>
}

export default function TooltipProvider(props: Props): JSX.Element {
    const {children} = props

    const tooltipContentProviderRef = useRef<((seriesName: string, time: number, series: Series, mouseCoords: [x: number, y: number]) => TooltipDimensions) | undefined>(undefined)

    return <TooltipContext.Provider
        value={{
            registerTooltipContentProvider: provider => tooltipContentProviderRef.current = provider,
            tooltipContentProvider: () => tooltipContentProviderRef.current,
        }}
    >
        {children}
    </TooltipContext.Provider>
}

/**
 * React hook that sets up the React context for the mouse values.
 * @return The {@link UseTooltipValues} held in the React context.
 */
export function useTooltip(): UseTooltipValues {
    const context = useContext<UseTooltipValues>(TooltipContext)
    const {registerTooltipContentProvider} = context
    if (registerTooltipContentProvider === undefined || registerTooltipContentProvider === null) {
        throw new Error("useTooltip can only be used when the parent is a <TooltipProvider/>")
    }
    return context
}