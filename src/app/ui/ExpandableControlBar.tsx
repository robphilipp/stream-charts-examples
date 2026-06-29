import {type CSSProperties, type JSX, useState} from "react";

export type ControlBarType = 'header' | 'controls'

type Props = {
    expandButtonStyle: CSSProperties
    backgroundColor: string
    borderColor: string
    borderRadius: number
    width?: CSSProperties["width"]
    // summary: ReactNode
    defaultExpanded?: boolean
    children: JSX.Element | Array<JSX.Element>
}

export function ExpandableControlBar(props: Props): JSX.Element {
    const {
        // expandButtonStyle,
        backgroundColor,
        borderColor,
        borderRadius,
        width = 'max-content',
        // summary,
        defaultExpanded = false,
        children
    } = props

    const [expanded, setExpanded] = useState<boolean>(defaultExpanded)
    // const [mouseInBounds, setMouseInBounds] = useState<boolean>(false)

    const sortedChildren = categorizeChildren(children)

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                flexWrap: 'nowrap',
                alignItems: 'stretch',
                flex: '0 0 auto',
                width,
                minWidth: 0,
                zIndex: 1000,
                // backgroundColor: backgroundColor,
                // border: `1px solid ${borderColor}`,
                borderRadius: borderRadius,

                // padding: "7px 20px 7px 15px",
                // opacity: expanded ? 0.8 : 1,
                backgroundColor: expanded ? `rgb(from ${backgroundColor}, r g b / 0.5)` : backgroundColor,
                // opacity: 1,
                backdropFilter: expanded ? "blur(10px)" : "blur(2px)",
                boxShadow: expanded ? `0 10px 25px ${borderColor}` : "none",
                border: expanded ? "none" : `1px solid ${borderColor}`,
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
                {/*<Button*/}
                {/*    aria-expanded={expanded}*/}
                {/*    onClick={() => setExpanded(!expanded)}*/}
                {/*    style={{...expandButtonStyle, backgroundColor, border: `0px solid ${borderColor}`}}*/}
                {/*    icon={color => expanded ? collapseIcon(color) : expandIcon(color)}*/}
                {/*>*/}
                {/*    <></>*/}
                {/*</Button>*/}
                {sortedChildren.header}
                {/*{!expanded &&*/}
                {/*    <div style={{*/}
                {/*        display: 'flex',*/}
                {/*        flex: '1 1 auto',*/}
                {/*        alignItems: 'center',*/}
                {/*        minWidth: 0,*/}
                {/*        overflowX: 'auto',*/}
                {/*        overflowY: 'hidden',*/}
                {/*        scrollbarWidth: 'thin',*/}
                {/*        whiteSpace: 'nowrap',*/}
                {/*        color: borderColor,*/}
                {/*    }}>*/}
                {/*        {summary}*/}
                {/*    </div>*/}
                {/*}*/}
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
                    // opacity: expanded ? 0.8 : 1,
                    // backdropFilter: expanded ? "blur(10px)" : "blur(2px)",
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

