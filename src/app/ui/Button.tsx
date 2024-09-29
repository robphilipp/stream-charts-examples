import * as React from "react";
import {JSX} from "react";

interface Props {
    style?: React.CSSProperties
    disabledStyle?: React.CSSProperties
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
    disabled?: boolean
    children: JSX.Element | string
}

const defaultButtonStyle: React.CSSProperties = {
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
    margin: 6,
    marginRight: 20,
    cursor: 'pointer',
}

const defaultDisabledButtonStyle = {
    backgroundColor: '#9c9b9b',
}

export function Button(props: Props): JSX.Element {
    const {
        style = defaultButtonStyle,
        disabledStyle = defaultDisabledButtonStyle,
        onClick,
        disabled = false,
        children
    } = props

    const buttonStyle = disabled ? {
        ...defaultButtonStyle,
        ...style,
        ...disabledStyle,
        borderColor: disabledStyle.backgroundColor
    } : {
        ...defaultButtonStyle,
        ...style
    }

    return <button onClick={onClick} disabled={disabled} style={buttonStyle}>
        {children}
    </button>

}