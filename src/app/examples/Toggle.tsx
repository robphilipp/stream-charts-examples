import {useState} from "react";
import {noop} from "stream-charts";

export enum ToggleStatus {
    ON, OFF
}

interface Props {
    leftLabel?: string
    rightLabel?: string
    labelFontColor?: string
    toggleOnBackgroundColor?: string
    toggleOffBackgroundColor?: string
    toggleOnColor?: string
    toggleOffColor?: string
    toggleBorderColor?: string
    labelSpacing?: number
    toggleWidth?: number
    toggleHeight?: number
    toggleOffset?: number
    onToggle?: (status: ToggleStatus) => void
}

export function Toggle(props: Props): JSX.Element {
    const {
        leftLabel = "light",
        rightLabel = "dark",
        labelFontColor = "#202020",
        toggleOffColor = "#202020",
        toggleOffBackgroundColor = "#d2933f",
        toggleOnColor = "#d2933f",
        toggleOnBackgroundColor = "#202020",
        toggleBorderColor = "#d2933f",
        labelSpacing = 5,
        toggleWidth = 35,
        toggleHeight = 20,
        toggleOffset = 1,
        onToggle = noop,
    } = props

    const [toggleStatus, setToggleStatus] = useState<ToggleStatus>(ToggleStatus.OFF)

    const toggleLocation = (status: ToggleStatus): number => status === ToggleStatus.OFF ?
            toggleOffset :
            toggleWidth - Math.min(toggleWidth, toggleHeight) + toggleOffset

    const toggle = (status: ToggleStatus): ToggleStatus => status === ToggleStatus.OFF ?
        ToggleStatus.ON :
        ToggleStatus.OFF

    const toggleColor = (status: ToggleStatus): string => status === ToggleStatus.OFF ?
        toggleOffColor :
        toggleOnColor

    const toggleBackgroundColor = (status: ToggleStatus): string => status === ToggleStatus.OFF ?
        toggleOffBackgroundColor :
        toggleOnBackgroundColor

    return <>
        <span style={{
            marginRight: labelSpacing,
            position: "relative",
            top: toggleOffset,
            color: labelFontColor,
            transition: "0.4s",
        }}>{leftLabel}</span>
        <label
            style={{
                position: "relative",
                display: "inline-block",
                width: toggleWidth,
                height: toggleHeight,
                backgroundColor: toggleBackgroundColor(toggleStatus),
                borderRadius: Math.min(toggleHeight, toggleWidth),
                border: "solid",
                borderWidth: 1,
                borderColor: toggleBorderColor,
                transition: "0.4s",
            }}>
            <input
                type="checkbox"
                style={{opacity: 0, width: 0, height: 0}}
                onClick={() => {
                    const status = toggle(toggleStatus)
                    setToggleStatus(status)
                    onToggle(status)
                }}
            />
            <span style={{
                position: "absolute",
                cursor: "pointer",
                height: Math.min(toggleWidth, toggleHeight) - 2 * toggleOffset,
                width: Math.min(toggleWidth, toggleHeight) - 2 * toggleOffset,
                top: toggleOffset,
                left: toggleLocation(toggleStatus),
                right: toggleOffset,
                bottom: toggleOffset,
                backgroundColor: toggleColor(toggleStatus),
                transition: "0.4s",
                borderRadius: Math.min(toggleHeight, toggleWidth)
            }}/>
        </label>
        <span style={{
            marginLeft: labelSpacing,
            position: "relative",
            top: toggleOffset,
            color: labelFontColor,
            transition: "0.4s",
        }}>{rightLabel}</span>
    </>
}