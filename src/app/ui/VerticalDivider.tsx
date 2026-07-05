import {type JSX} from 'react';

// Define the component's strict TypeScript types
type Props = {
    height?: string | number;
    color?: string;
    thickness?: string | number;
    className?: string;
}

export function VerticalDivider(props: Props): JSX.Element {
    const {
        height = '100%', // Fallback default values
        color = '#e2e8f0',
        thickness = '1px',
        className = '',
    } = props

    return (
        <div
            className={className}
            style={{
                width: typeof thickness === 'number' ? `${thickness}px` : thickness,
                height: typeof height === 'number' ? `${height}px` : height,
                backgroundColor: color,
                alignSelf: 'center', // Ensures it stretches in a flex container if height isn't static
            }}
            role="separator"
            aria-orientation="vertical"
        />
    );
};
