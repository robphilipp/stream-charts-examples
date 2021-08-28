import {defaultTooltipStyle, TooltipStyle} from "./TooltipStyle";
import {useMemo} from "react";

export interface Props {
    visible: boolean
    style?: Partial<TooltipStyle>
}

export function Tooltip(props: Props): null {
    const {
        visible,
        style
    } = props

    const tooltipStyle = useMemo(() => ({...defaultTooltipStyle, ...style}), [style])
    // const tooltipRef = useRef<TooltipSelectoin>()

    return null
}