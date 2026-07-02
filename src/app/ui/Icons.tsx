import {type JSX} from "react";

export function ForwardIcon(props: { color: string }): JSX.Element {
    const {color} = props
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

export function LastIcon(props: { color: string }): JSX.Element {
    const {color} = props
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

export function BackIcon(props: { color: string }): JSX.Element {
    const {color} = props
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

export function FirstIcon(props: { color: string }): JSX.Element {
    const {color} = props
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

export function PlayIcon(props: { color: string }): JSX.Element {
    const {color} = props
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

export function PauseIcon(props: { color: string }): JSX.Element {
    const {color} = props
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

export function ResetIcon(props: { color: string }): JSX.Element {
    const {color} = props
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


export function ExpandedIcon(props: { color: string }): JSX.Element {
    const {color} = props
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

export function CollapsedIcon(props: { color: string }): JSX.Element {
    const {color} = props
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

export function LagIcon(props: { color: string, fill: string }): JSX.Element {
    const {color, fill = "none"} = props
    return (
        <svg width="15" height="15" style={{display: 'block', flexShrink: 0}}>
            <circle cx="7.5" cy="7.5" r="6" fill={fill} stroke={color} strokeWidth={2}/>
            <line x1={7.5} y1={7.5} x2={14} y2={7.5} stroke={color} strokeWidth={1}/>
            <line x1={7.5} y1={7.5} x2={7.5} y2={3} stroke={color} strokeWidth={1}/>
        </svg>
    )
}

export function FilterIcon(props: { color: string }): JSX.Element {
    const {color} = props
    return (
        <svg width="15" height="15" style={{display: 'block', flexShrink: 0}}>
            <path
                d="M0 0 L14 0 L8 8 L8 15 L6 15 L6 8 L0 0"
                stroke={color}
                fill={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    )
}

export function TooltipIcon(props: { color: string }): JSX.Element {
    const {color} = props
    return (
        <svg width="15" height="15" style={{display: 'block', flexShrink: 0}}>
            <rect width="15" height="10" rx={3} ry={3} strokeWidth={1} stroke={color} fill="none"/>
            <path
                d="M0 6 L4 0 L8 6 L5 5 L5 12 L3 12 L3 5 L0 6"
                stroke={color}
                fill={color}
                strokeWidth={1}
                strokeLinejoin="round"
                strokeLinecap="round"
                transform={`translate(5, 3) rotate(-30, 7.5 7.5)`}
            />
            <line
                x1={3}
                y1={3}
                x2={12}
                y2={3}
                stroke={color}
                strokeWidth={1}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            <line
                x1={3}
                y1={6}
                x2={12}
                y2={6}
                stroke={color}
                strokeWidth={1}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    )
}

export function TrackerIcon(props: { color: string }): JSX.Element {
    const {color} = props
    return (
        <svg width="15" height="15" style={{display: 'block', flexShrink: 0}}>
            <path
                d="M0 6 L4 0 L8 6 L5 5 L5 12 L3 12 L3 5 L0 6"
                stroke={color}
                fill={color}
                strokeWidth={1}
                strokeLinejoin="round"
                strokeLinecap="round"
                transform={`translate(5, 2) rotate(-30, 7.5 7.5)`}
            />
            <line
                x1={5}
                y1={0}
                x2={5}
                y2={15}
                stroke={color}
                strokeWidth={1}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    )
}
