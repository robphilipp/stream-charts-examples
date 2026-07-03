import {type CSSProperties, type JSX, useLayoutEffect, useRef, useState} from "react";
import {CollapsedIcon, ExpandedIcon} from "./Icons.tsx";
import {Button} from "./Button.tsx";

export type ControlBarType = 'header' | 'controls'

type Props = {
    expandButtonStyle: CSSProperties
    backgroundColor: string
    borderColor: string
    borderRadius: number
    width?: CSSProperties["width"]
    minHeight?: CSSProperties["minHeight"]
    defaultExpanded?: boolean
    children: JSX.Element | Array<JSX.Element>
}

export function ExpandableControlBar(props: Props): JSX.Element {
    const {
        backgroundColor,
        borderColor,
        borderRadius,
        minHeight = 'max-content',
        width = 'max-content',
        defaultExpanded = false,
        expandButtonStyle,
        children
    } = props

    const [expanded, setExpanded] = useState<boolean>(defaultExpanded)
    const [expandButtonColor, setExpandButtonColor] = useState<string>(borderColor)
    const collapseTimeoutRef = useRef<number | null>(null)

    const contentRef = useRef<HTMLDivElement>(null)
    const [contentHeight, setContentHeight] = useState<number>(0)

    const sortedChildren = categorizeChildren(children)

    useLayoutEffect(() => {
        if (!contentRef.current) return

        const element = contentRef.current
        const updateHeight = () => setContentHeight(element.scrollHeight)

        updateHeight()

        const observer = new ResizeObserver(() => updateHeight())
        observer.observe(element)

        return () => observer.disconnect()
    }, [children])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                flexWrap: 'nowrap',
                alignItems: 'stretch',
                flex: '0 0 auto',
                minHeight,
                width,
                minWidth: 0,
                zIndex: 1000,
                borderRadius: borderRadius,

                backgroundColor: expanded ? `rgba(from ${backgroundColor}, r g b / 0.5)` : backgroundColor,
                backdropFilter: expanded ? "blur(10px)" : "blur(2px)",
                WebkitBackdropFilter: expanded ? "blur(10px)" : "blur(2px)",
                boxShadow: expanded ? `0 0px 25px ${borderColor}` : `0 0 10px ${borderColor}`,
                transition: "background-color 240ms ease, box-shadow 240ms ease, backdrop-filter 240ms ease, -webkit-backdrop-filter 240ms ease",
            }}
            onMouseEnter={() => {
                if (collapseTimeoutRef.current) {
                    clearTimeout(collapseTimeoutRef.current)
                    collapseTimeoutRef.current = null
                }
                setExpanded(true)
                setExpandButtonColor(expandButtonStyle.color || borderColor)
            }}
            onMouseLeave={() => {
                setExpandButtonColor(borderColor)
                collapseTimeoutRef.current = setTimeout(() => {
                    setExpanded(false)
                }, 500)
            }}
        >
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'nowrap',
                alignItems: 'center',
                gap: 8,
                padding: '6px 16px 6px 6px',
                minWidth: 0,
            }}>
                <Button
                    style={{border: 'none'}}
                    onClick={() => expanded ? setExpanded(false) : setExpanded(true)}
                    icon={() => expanded ?
                        <ExpandedIcon color={expandButtonColor}/> :
                        <CollapsedIcon color={expandButtonColor}/>
                    }
                    children={""}
                />
                {sortedChildren.header}
            </div>
            <div style={{
                maxHeight: expanded ? `${contentHeight}px` : "0px",
                opacity: expanded ? 1 : 0,
                overflow: 'hidden',
                borderTop: `1px solid ${expanded ? borderColor : 'transparent'}`,
                transition: "max-height 260ms ease, opacity 180ms ease, border-top-color 180ms ease",
            }}>
                <div
                    ref={contentRef}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flexWrap: 'nowrap',
                        alignItems: 'stretch',
                        gap: 6,
                        padding: '0 6px 6px',
                        minWidth: 0,
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        scrollbarWidth: 'thin',
                    }}>
                    {sortedChildren.content}
                </div>
            </div>
        </div>
    )
}

type CategorizedChildren = { header: JSX.Element, content: JSX.Element }

function categorizeChildren(children: JSX.Element | Array<JSX.Element>): CategorizedChildren {
    if (!Array.isArray(children)) {
        return {header: <></>, content: children}
    }
    return children.reduce(
        (parsed, elem) => {
            if (elem.props.type === 'header') {
                parsed.header = elem
            } else {
                parsed.content = elem
            }
            return parsed
        }, {header: <></>, content: <></>}
    )

}
