import {type CSSProperties, type JSX, useState} from "react";
import {expandedIcon, collapsedIcon} from "./Icons.tsx";

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
        children
    } = props

    const [expanded, setExpanded] = useState<boolean>(defaultExpanded)

    const sortedChildren = categorizeChildren(children)

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
            }}
            onMouseOver={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
        >
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'nowrap',
                alignItems: 'center',
                gap: 8,
                padding: 6,
                minWidth: 0,
            }}>
                <div>{expanded ? expandedIcon(borderColor) : collapsedIcon(borderColor)}</div>
                {sortedChildren.header}
            </div>
            {expanded &&
                <div style={{
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
                    borderTop: `1px solid ${borderColor}`,
                }}>
                    {sortedChildren.content}
                </div>
            }
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

