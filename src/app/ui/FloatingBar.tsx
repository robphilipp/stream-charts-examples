import type {Theme} from "../examples/theme/Themes.ts";
import React, {type CSSProperties, type JSX, useRef, useState} from "react";

type Location = {
    // offset from the top or bottom of the screen
    offsetFrom: "top" | "bottom"
    // the offset in pixels
    offset: number
}

type FloatingNavigationStyle = CSSProperties & Partial<Theme> & {
    boxShadowColor?: string,
    borderColor?: string
}

type Props = {
    location?: Location
    style: FloatingNavigationStyle
    children: JSX.Element
}

/**
 * A floating navigation bar that can be dragged and repositioned. Initial position is
 * determined by the `location` prop, which can be either "top" or "bottom" with the
 * offset from that location. The `location` prop can be used to adjust the initial
 * position of the navigation bar.
 * @param props
 * @return A floating navigation bar
 */
export function FloatingBar(props: Props): JSX.Element {
    const {
        location = {offsetFrom: "bottom", offset: 20},
        style,
        children
    } = props

    const {
        disabledBackgroundColor,
        boxShadowColor = disabledBackgroundColor || "none",
        borderColor = disabledBackgroundColor || "none",
    } = style

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
        style={navStyle({boxShadowColor, borderColor}, location, offset.x, offset.y, isDragging, mouseInBounds)}
    >
        <div style={{
            cursor: "grab",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            touchAction: "none",
        }}>
            <div style={{width: "12px", height: "2px", backgroundColor: style.color, borderRadius: "1px"}}/>
            <div style={{width: "12px", height: "2px", backgroundColor: style.color, borderRadius: "1px"}}/>
            <div style={{width: "12px", height: "2px", backgroundColor: style.color, borderRadius: "1px"}}/>
        </div>
        {children}
    </div>
}

function navStyle(
    style: FloatingNavigationStyle,
    location: Location,
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
        backdropFilter: mouseInBounds ? "blur(10px)" : "blur(4px)",
        boxShadow: mouseInBounds ? `0 10px 25px ${style.boxShadowColor}` : "none",
        border: mouseInBounds ? "none" : `1px solid ${style.borderColor}`,
    }
    const baseStyle: CSSProperties = {
        position: "fixed",
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
    switch (location.offsetFrom) {
        case "top":
            baseStyle.top = location.offset
            break
        case "bottom":
        default:
            baseStyle.bottom = location.offset
    }
    return {...baseStyle, ...dynamicStyle, ...style}
}