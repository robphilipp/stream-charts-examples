import {type JSX} from "react";

type Props = {
    children: JSX.Element | Array<JSX.Element>
}

export function CommonControls(props: Props): JSX.Element {
    const {children} = props

    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            flexDirection: 'column',
            gap: 10,
            padding: 10
        }}>
            {children}
        </div>
    )
}