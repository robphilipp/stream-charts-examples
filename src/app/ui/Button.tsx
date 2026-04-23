import {CSSProperties, JSX, MouseEvent, useState} from "react";
import {interpolateColor} from "./utils";

interface Props {
    style?: CSSProperties
    disabledStyle?: CSSProperties
    onClick: (event: MouseEvent<HTMLButtonElement>) => void
    disabled?: boolean
    children: JSX.Element | string
}

const defaultButtonStyle: CSSProperties = {
    backgroundColor: '#eee',
    outlineStyle: 'none',
    borderColor: '#202020',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: 3,
    color: '#202020',
    fontSize: 12,
    width: 50,
    padding: 4,
    cursor: 'pointer',
}

const defaultDisabledButtonStyle = {
    backgroundColor: '#9c9b9b',
}

export function Button(props: Props): JSX.Element {
    const {
        style = defaultButtonStyle,
        disabledStyle = {
            ...defaultDisabledButtonStyle,
            backgroundColor: interpolateColor(style.backgroundColor as string, style.color as string, 5),
            color: interpolateColor(style.color as string, style.backgroundColor as string, 50)
        },
        onClick,
        disabled = false,
        children
    } = props

    const [hovered, setHovered] = useState<boolean>(false)

    const buttonStyle = disabled ? {
        ...defaultButtonStyle,
        ...style,
        ...disabledStyle,
        borderColor: disabledStyle.backgroundColor,
        cursor: hovered ? 'not-allowed' : 'pointer',

    } : {
        ...defaultButtonStyle,
        ...style,
        backgroundColor: hovered && style ?
            interpolateColor(style.backgroundColor as string, style.color as string, 15) :
            style.backgroundColor,
    }

    return <button
        onClick={onClick}
        onMouseOver={() => setHovered(true)}
        onMouseOut={() => setHovered(false)}
        disabled={disabled}
        style={buttonStyle}>
        {children}
    </button>

}