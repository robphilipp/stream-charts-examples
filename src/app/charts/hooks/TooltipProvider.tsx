import {type JSX, useCallback, useRef, useState} from "react";
import {type TooltipContentProvider, TooltipContext, type UseTooltipValues} from "./useTooltip";

type Props = {
    children: JSX.Element | Array<JSX.Element>
}

/**
 * The tooltip context provider allows registering and retrieving tooltip content providers. When
 * a tooltip content provider is registered with a provider ID, then it must be retrieved with that
 * same provider ID. This allows a chart to have multiple tooltip content providers, depending on
 * the context or types of objects being moused over. When a tooltip content provider is registered
 * without a provider ID, then the default provider ID is used.
 * @param props The properties holding the children
 * @return A JSX element containing the children
 */
export default function TooltipProvider<D, M>(props: Props): JSX.Element {
    const {children} = props

    const tooltipContentProviderRef = useRef<TooltipContentProvider<D, M>>(undefined)
    const [visibilityState, setVisibilityState] = useState<boolean>(false)
    const visibility = useCallback((visible: boolean) => setVisibilityState(visible), [])

    // the context's `value` prop is typed as `unknown` (see `TooltipContext` in `useTooltip.tsx`),
    // so the object literal needs its own explicit type here to give the handler functions below
    // their parameter types -- otherwise they'd fall back to implicit `any`
    const value: UseTooltipValues<D, M> = {
        registerTooltipContentProvider: provider => tooltipContentProviderRef.current = provider,
        tooltipContentProvider: () => tooltipContentProviderRef.current,
        setVisibilityState: (visible: boolean) => visibility(visible),
        visibilityState: visibilityState
    }

    return <TooltipContext.Provider value={value}>
        {children}
    </TooltipContext.Provider>
}