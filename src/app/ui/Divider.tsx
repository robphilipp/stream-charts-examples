import {type HTMLAttributes, type JSX} from 'react';
import type {Theme} from "../examples/theme/Themes.ts";

// Extend the native hr attributes to support all standard HTML props
interface Props extends HTMLAttributes<HTMLHRElement> {
    theme: Theme
    thickness?: number | string
    verticalSpacing?: number | string
}

export function Divider(props: Props): JSX.Element {
    const {
        theme,
        thickness = '1px',
        verticalSpacing = '10px',
        style,
        ...hrProps
    } = props;

    const defaultStyle = {
        border: '0',
        height: thickness,
        width: '100%',
        alignSelf: 'stretch',
        flexShrink: 0,
        backgroundColor: theme.disabledBackgroundColor,
        marginTop: verticalSpacing,
        marginBottom: verticalSpacing,
        ...style,
    };

    return <hr style={defaultStyle} {...hrProps} />;
};
