import type {Theme} from "./Themes.ts";
import React, {type CSSProperties, type JSX, useRef, useState} from "react";

type Props = {
    theme: Theme,
    children: JSX.Element
}

export function FloatingNavigation(props: Props): JSX.Element {
    const {theme, children} = props

    const navRef = useRef<HTMLDivElement>(null)
    const dragStateRef = useRef<{
        pointerId: number
        startX: number
        startY: number
        startOffsetX: number
        startOffsetY: number
    } | null>(null)
    const [offset, setOffset] = useState<{x: number, y: number}>({x: 0, y: 0})
    const [isDragging, setIsDragging] = useState<boolean>(false)
    const [mouseInBounds, setMouseInBounds] = useState<boolean>(false)

    function beginDrag(event: React.PointerEvent<HTMLDivElement>): void {
        if (event.button !== 0) {
            return
        }

        const target = event.target
        if (target instanceof Element && target.closest("button")) {
            return
        }

        dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startOffsetX: offset.x,
            startOffsetY: offset.y,
        }
        setIsDragging(true)
        event.currentTarget.setPointerCapture(event.pointerId)
    }

    function updateDrag(event: React.PointerEvent<HTMLDivElement>): void {
        const dragState = dragStateRef.current
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return
        }

        setOffset({
            x: dragState.startOffsetX + (event.clientX - dragState.startX),
            y: dragState.startOffsetY + (event.clientY - dragState.startY),
        })
    }

    function endDrag(event: React.PointerEvent<HTMLDivElement>): void {
        const dragState = dragStateRef.current
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return
        }

        dragStateRef.current = null
        setIsDragging(false)

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
        }
    }

    return <div
        ref={navRef}
        onPointerDown={beginDrag}
        onPointerMove={updateDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onMouseOver={() => setMouseInBounds(true)}
        onMouseLeave={() => setMouseInBounds(false)}
        style={navStyle({}, offset.x, offset.y, isDragging, mouseInBounds)}
        // style={{
        //     position: "fixed",
        //     bottom: 20, /* Distance from the bottom of the screen */
        //     left: "50%",
        //     transform: `translate3d(calc(-50% + ${offset.x}px), ${offset.y}px, 0)`,
        //     zIndex: 1000, /* Keeps it on top of other content */
        //     userSelect: "none",
        //     touchAction: "none",
        //     cursor: isDragging ? "grabbing" : "grab",
        //
        //     display: "flex",
        //     alignItems: "center",
        //     gap: 5,
        //
        //     /* Floating pill styling */
        //     background: theme.backgroundColor,
        //     opacity: mouseInBounds ? 1 : 0.8,
        //     backdropFilter: mouseInBounds ? "blur(10px)" : "blur(2px)",
        //     padding: "7px 20px 7px 15px",
        //     borderRadius: 50,
        //     boxShadow: mouseInBounds ? `0 10px 25px ${theme.disabledBackgroundColor}` : "none",
        //     border: mouseInBounds ? "none" : `1px solid ${theme.disabledBackgroundColor}`,
        // }}
    >
        <div style={{
            cursor: "grab",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            touchAction: "none",
        }}>
            <div style={{width: "12px", height: "2px", backgroundColor: theme.color, borderRadius: "1px"}}/>
            <div style={{width: "12px", height: "2px", backgroundColor: theme.color, borderRadius: "1px"}}/>
            <div style={{width: "12px", height: "2px", backgroundColor: theme.color, borderRadius: "1px"}}/>
        </div>
        {children}
    </div>
}

function navStyle(
    style: CSSProperties,
    x: number = 0,
    y: number = 0,
    isDragging: boolean = false,
    mouseInBounds: boolean = false
): CSSProperties {
    const dynamicStyle: CSSProperties = {
        transform: `translate3d(calc(-50% + ${x}px), ${y}px, 0)`,
        cursor: isDragging ? "grabbing" : "grab",

        /* Floating pill styling */
        background: style.backgroundColor,
        opacity: mouseInBounds ? 1 : 0.8,
        backdropFilter: mouseInBounds ? "blur(10px)" : "blur(2px)",
        boxShadow: mouseInBounds ? `0 10px 25px ${style.backgroundColor}` : "none",
        border: mouseInBounds ? "none" : `1px solid ${style.backgroundColor}`,
    }
    const baseStyle: CSSProperties = {
        position: "fixed",
        bottom: 20, /* Distance from the bottom of the screen */
        left: "50%",
        zIndex: 1000, /* Keeps it on top of other content */
        userSelect: "none",
        touchAction: "none",

        display: "flex",
        alignItems: "center",
        gap: 5,

        /* Floating pill styling */
        padding: "7px 20px 7px 15px",
        borderRadius: 50,
    }
    return {...baseStyle, ...style, ...dynamicStyle}
}