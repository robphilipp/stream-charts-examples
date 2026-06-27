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
