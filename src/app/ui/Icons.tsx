import {type JSX} from "react";

export function forwardIcon(color: string): JSX.Element {
    return (
        <svg width="15" height="15" style={{display: 'block', flexShrink: 0}}>
            <path
                d="M6 3 L12 7.5 L6 12"
                stroke={color}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    )
}

export function lastIcon(color: string): JSX.Element {
    return (
        <svg width="15" height="15" style={{display: 'block', flexShrink: 0}}>
            <path
                d="M3 3 L9 7.5 L3 12"
                stroke={color}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            <line
                x1="12"
                y1="3"
                x2="12"
                y2="12"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    )
}

export function backIcon(color: string): JSX.Element {
    return (
        <svg width="15" height="15" style={{display: 'block', flexShrink: 0}}>
            <path
                d="M9 3 L3 7.5 L9 12"
                stroke={color}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    )
}

export function firstIcon(color: string): JSX.Element {
    return (
        <svg width="15" height="15" style={{display: 'block', flexShrink: 0}}>
            <path
                d="M12 3 L6 7.5 L12 12"
                stroke={color}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            <line
                x1="3"
                y1="3"
                x2="3"
                y2="12"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    )
}

export function playIcon(color: string): JSX.Element {
    return (
        <svg width="16" height="16" style={{display: 'block', flexShrink: 0}}>
            <path
                d="M6 3 L12 7.5 L6 12 L6 3"
                stroke={color}
                fill={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    )
}

export function pauseIcon(color: string): JSX.Element {
    return (
        <svg width="16" height="16" style={{display: 'block', flexShrink: 0}}>
            <line
                x1="5"
                y1="3"
                x2="5"
                y2="12"
                stroke={color}
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            <line
                x1="11"
                y1="3"
                x2="11"
                y2="12"
                stroke={color}
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    )
}

export function resetIcon(color: string): JSX.Element {
    return (
        <svg width="16" height="16" style={{display: 'block', flexShrink: 0}}>
            <defs>
                <marker id="arrow" viewBox="0 0 12 12" refX="2" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M 0 1 L 9 4 L 0 9 z" fill={color} />
                </marker>
            </defs>
            <path d="M 15,10 A 5,5 0 1 1 15,5"
                  fill="none"
                  stroke={color}
                  stroke-width={2}
                  stroke-linecap="round"
                  marker-end="url(#arrow)"
            />
        </svg>
    )
}


export function collapseIcon(color: string): JSX.Element {
    return (
        <svg width="15" height="15" style={{display: 'block', flexShrink: 0}}>
            <path
                d="M6 3 L10 7.5 L6 12 L6 3"
                stroke={color}
                fill={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                transform={`translate(0, -5) rotate(90, 7.5 7.5)`}
            />
            <path
                d="M6 3 L10 7.5 L6 12 L6 3"
                stroke={color}
                fill={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                transform={`translate(0, 5) rotate(-90, 7.5 7.5)`}
            />
        </svg>
    )
}

export function expandIcon(color: string): JSX.Element {
    return (
        <svg width="15" height="15" style={{display: 'block', flexShrink: 0}}>
            <path
                d="M6 3 L10 7.5 L6 12 L6 3"
                stroke={color}
                fill={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                transform={`translate(0,4) rotate(90, 7.5 7.5)`}
            />
            <path
                d="M6 3 L10 7.5 L6 12 L6 3"
                stroke={color}
                fill={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                transform={`translate(0, -4) rotate(-90, 7.5 7.5)`}
            />
        </svg>
    )
}

