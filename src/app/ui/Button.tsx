import * as React from "react";
import {JSX} from "react";

interface Props {
    style?: React.CSSProperties
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
    children: JSX.Element | string
}

const defaultButtonStyle = {
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

export function Button(props: Props): JSX.Element {
    const {
        style = defaultButtonStyle,
        onClick,
        children
    } = props
    return <button onClick={onClick} style={{...defaultButtonStyle, ...style}}>
        {children}
    </button>

}