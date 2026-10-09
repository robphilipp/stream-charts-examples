import {lightTheme, type Theme} from "../../ui/Themes.ts";
import {
    type AnchorHTMLAttributes,
    type ClassAttributes,
    type CSSProperties,
    type HTMLAttributes,
    type ImgHTMLAttributes,
    type JSX,
    useLayoutEffect,
    useRef,
    useState,
    type VideoHTMLAttributes
} from "react";
import {getRouteApi, useElementScrollRestoration, useNavigate} from "@tanstack/react-router";
import {Button} from "../../ui/Button.tsx"
import intro_page from "./intro.md?raw"
import some_context_page from "./some-context.md?raw"
import contents_page from "./contents.md?raw";
import anatomy_of_example_page from "./anatomy-of-example.md?raw";
import common_controls_page from "./common-controls.md?raw";
import scatter_chart_page from "./scatter-chart.md?raw";
import raster_chart_page from "./raster-chart.md?raw";
import poincare_chart_page from "./poincare-chart.md?raw";
import bar_chart_page from "./bar-chart.md?raw";
import outlier_chart_page from "./outlier-chart.md?raw";
import legends_page from "./legends.md?raw";
import tooltips_and_trackers_page from "./tooltips-and-trackers.md?raw";
import where_the_code_lives_page from "./where-the-code-lives.md?raw";
import how_the_data_flows_page from "./how-the-data-flows.md?raw";
import ReactMarkdown, {type ExtraProps} from "react-markdown";
import rehypeRaw from 'rehype-raw';
import {buttonStyle, interpolateColor} from "../../ui/utils.ts";
import {useGridCell} from "react-resizable-grid-layout";
import {FloatingBar} from "../../ui/FloatingBar.tsx";
import {
    BackIcon,
    FirstIcon,
    ForwardIcon,
    LastIcon,
    TableOfContentsCollapseIcon,
    TableOfContentsExpandIcon
} from "../../ui/Icons.tsx";
import remarkGfm from "remark-gfm";
import {useThemeStore} from "../appstate/themeStore.ts";

const pages = [
    intro_page,
    some_context_page,
    contents_page,
    anatomy_of_example_page,
    common_controls_page,
    scatter_chart_page,
    raster_chart_page,
    poincare_chart_page,
    bar_chart_page,
    outlier_chart_page,
    legends_page,
    tooltips_and_trackers_page,
    where_the_code_lives_page,
    how_the_data_flows_page,
]

/**
 * The page's title: the text of its first heading (e.g. "what is stream-charts?")
 * @param page The page's markdown
 * @param pageNum The page's index (for the fallback title, when the page has no heading)
 * @return The page's title
 */
function titleOf(page: string, pageNum: number): string {
    const heading = page.match(/^#{1,6}\s+(.+?)\s*$/m)
    return heading !== null ? heading[1] : `page ${pageNum + 1}`
}

// the table of contents: each page's entry, numbered and labelled with the page's title
const TABLE_OF_CONTENTS: Array<string> = pages.map((page, pageNum) => `${pageNum + 1}. ${titleOf(page, pageNum)}`)

// the ID of the table of contents (which the button that opens and closes it controls)
const TABLE_OF_CONTENTS_ID = "intro-table-of-contents"

function style(theme: Theme, height: number): CSSProperties {
    return {
        backgroundColor: theme.backgroundColor,
        color: theme.color,
        width: 'auto',
        paddingRight: 140,
        paddingLeft: 40,
        maxWidth: 750,
        maxHeight: height,
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarWidth: "thin",
        // scrollbarColor: `${theme.color} ${theme.backgroundColor}`,
        scrollbarColor: `${interpolateColor(theme.color as string, theme.backgroundColor as string, 0.5)} ${theme.backgroundColor}`,
        fontSize: 15,
        fontWeight: 400,
    }
}

// id used by the router's scroll-restoration watcher to save/restore the scroll position of
// the (inner) scrollable intro content div
const SCROLL_RESTORATION_ID = "intro-content"

const introRouteApi = getRouteApi("/intro")

export default function Intro() {
    const {theme} = useThemeStore()
    const numPages = pages.length

    // the current intro page comes from the ?page=N search param, so browser back/forward
    // moves between intro pages; clamp to a valid page in case of a hand-edited URL
    const {page} = introRouteApi.useSearch()
    const pageNum = Math.min(Math.max(0, page), numPages - 1)
    const navigate = useNavigate()

    const {height} = useGridCell()
    const cssStyle = style(theme, height)

    // restore the scroll position within the content div when returning to this page/URL. The
    // router caches scroll per key (path + search), so each intro page keeps its own position.
    const scrollRef = useRef<HTMLDivElement>(null)
    const scrollEntry = useElementScrollRestoration({id: SCROLL_RESTORATION_ID})
    useLayoutEffect(
        () => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollEntry?.scrollY ?? 0
            }
        },
        [pageNum, scrollEntry]
    )

    // whether the table of contents (which expands below the navigation bar's buttons) is open
    const [tableOfContentsOpen, setTableOfContentsOpen] = useState<boolean>(false)

    function updatePageNum(nextPage: number): void {
        navigate({to: "/intro", search: {page: Math.min(Math.max(0, nextPage), numPages - 1)}})
    }

    return (
        <div ref={scrollRef} data-scroll-restoration-id={SCROLL_RESTORATION_ID} style={cssStyle}>
            <ReactMarkdown
                components={{
                    a: anchor => CustomLink(anchor, {
                        color: theme.color,
                        // fontWeight: adjustFontWeight(cssStyle.fontWeight, 25)
                    }),
                    figure: figure => CustomFigure(figure, {paddingLeft: 0, marginLeft: 0, width: "100%"}),
                    figcaption: figureCaption => CustomFigureCaption(figureCaption, {
                        color: theme.color,
                        fontSize: adjustFontSize(cssStyle.fontSize, -2)
                    }),
                    img: image => CustomImage(image, {maxWidth: "100%", height: "auto", borderRadius: 10}, theme),
                    video: video => CustomVideo(video, {width: "100%"}),
                }}
                rehypePlugins={[
                    rehypeRaw,
                ]}
                remarkPlugins={[remarkGfm]}
            >
                {pages[pageNum]}
            </ReactMarkdown>

            <FloatingBar
                style={{...theme}}
                location={{offsetFrom: "top", offset: 120}}
                panel={
                    <TableOfContents
                        theme={theme}
                        pageNum={pageNum}
                        onSelectPage={page => {
                            setTableOfContentsOpen(false)
                            updatePageNum(page)
                        }}
                    />
                }
                panelExpanded={tableOfContentsOpen}
                onPanelCollapse={() => setTableOfContentsOpen(false)}
            >
                <Navigation
                    theme={theme}
                    pageNum={pageNum}
                    numPages={numPages}
                    updatePageNum={updatePageNum}
                    tableOfContentsOpen={tableOfContentsOpen}
                    onTableOfContentsToggle={() => setTableOfContentsOpen(open => !open)}
                />
            </FloatingBar>
        </div>
    )
}


type NavigationProps = {
    theme: Theme,
    pageNum: number,
    numPages: number,
    updatePageNum: (pageNum: number) => void
    tableOfContentsOpen: boolean
    onTableOfContentsToggle: () => void
}

function Navigation(props: NavigationProps): JSX.Element {

    const {theme, pageNum, numPages, updatePageNum, tableOfContentsOpen, onTableOfContentsToggle} = props
    const style = {...buttonStyle(theme), marginLeft: 3, marginRight: 3, marginTop: 6, marginBottom: 6}

    return (
        <>
            {/* opens and closes the table of contents (its icon shows which a click will do) */}
            <Button
                style={style}
                onClick={onTableOfContentsToggle}
                icon={color => tableOfContentsOpen ?
                    <TableOfContentsCollapseIcon color={color}/> :
                    <TableOfContentsExpandIcon color={color}/>
                }
                ariaLabel={tableOfContentsOpen ? "Close the table of contents" : "Open the table of contents"}
                ariaExpanded={tableOfContentsOpen}
                ariaControls={TABLE_OF_CONTENTS_ID}
            >
                {""}
            </Button>
            <Button
                style={style}
                onClick={() => updatePageNum(0)} disabled={pageNum === 0 || numPages <= 1}
                icon={color => <FirstIcon color={color}/>}
            >
                First
            </Button>
            <Button
                style={style}
                onClick={() => updatePageNum(pageNum - 1)} disabled={pageNum === 0}
                icon={color => <BackIcon color={color}/>}
            >
                Previous
            </Button>
            <Button
                style={style}
                onClick={() => updatePageNum(pageNum + 1)} disabled={pageNum >= numPages - 1}
                icon={color => <ForwardIcon color={color}/>}
            >
                Next
            </Button>
            <Button
                style={style}
                onClick={() => updatePageNum(numPages - 1)} disabled={pageNum >= numPages - 1 || numPages <= 1}
                icon={color => <LastIcon color={color}/>}
            >
                Last
            </Button>
        </>
    )
}

type TableOfContentsProps = {
    theme: Theme
    pageNum: number
    onSelectPage: (pageNum: number) => void
}

/**
 * The table of contents: a list of the pages (numbered and titled), with the current page marked.
 * Selecting a page goes to it. Shown in the navigation bar's expandable panel.
 * @param props The properties
 * @return The table of contents
 */
function TableOfContents(props: TableOfContentsProps): JSX.Element {
    const {theme, pageNum, onSelectPage} = props
    const [hoveredPage, setHoveredPage] = useState<number | undefined>(undefined)

    return (
        <nav id={TABLE_OF_CONTENTS_ID} aria-label="Table of contents">
            <ol style={{
                listStyle: 'none',
                margin: 0,
                padding: '4px 0 2px',
                // (scrolls when the pages don't fit on the screen)
                maxHeight: '60vh',
                overflowY: 'auto',
                scrollbarWidth: 'thin',
            }}>
                {TABLE_OF_CONTENTS.map((title, page) => {
                    const isCurrent = page === pageNum
                    return (
                        <li key={page}>
                            <button
                                onClick={() => onSelectPage(page)}
                                onMouseEnter={() => setHoveredPage(page)}
                                onMouseLeave={() => setHoveredPage(undefined)}
                                aria-current={isCurrent ? 'page' : undefined}
                                title={title}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    width: '100%',
                                    padding: '4px 8px',
                                    border: 'none',
                                    borderRadius: 6,
                                    backgroundColor: hoveredPage === page ?
                                        interpolateColor(theme.backgroundColor, theme.color, 12) :
                                        'transparent',
                                    color: theme.color,
                                    font: 'inherit',
                                    fontSize: 13,
                                    fontWeight: isCurrent ? 600 : 'normal',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                }}
                            >
                                {/* marks the current page (keeps every title aligned) */}
                                <span aria-hidden="true" style={{width: 10, flexShrink: 0, textAlign: 'center'}}>
                                    {isCurrent ? '✓' : ''}
                                </span>
                                <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                    {title}
                                </span>
                            </button>
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}

// type FontWeight = number
//     | "normal" | "bold" | "bolder" | "lighter"
//     | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
//     | "initial" | "inherit" | "unset" | "revert"
//     | (string & {})
//
// function adjustFontWeight(weight: FontWeight | undefined, adjustment: number, defaultWeight: number = 500): number {
//     return parseInt(`${weight?.valueOf() || defaultWeight}`) + adjustment;
// }

type FontSize = string | number | (string & {})

function adjustFontSize(size: FontSize | undefined, adjustment: number, defaultSize: number = 15): number {
    return parseInt(`${size?.valueOf() || defaultSize}`) + adjustment;
}

const hoverLinkStyle: CSSProperties = {textDecoration: 'underline', textDecorationStyle: 'solid'}
const linkStyle: CSSProperties = {textDecoration: 'underline',  textDecorationStyle: 'dashed'}

function CustomLink(
    anchor: ClassAttributes<HTMLAnchorElement> & AnchorHTMLAttributes<HTMLAnchorElement>,
    css: CSSProperties
): JSX.Element {
    const [hoverStyle, setHoverStyle] = useState<CSSProperties>(linkStyle)
    return <a
        href={anchor.href}
        target="_blank" rel="noopener noreferrer"
        onMouseOver={() => setHoverStyle(hoverLinkStyle)}
        onMouseLeave={() => setHoverStyle(linkStyle)}
        style={{...anchor.style, ...css, ...hoverStyle}}
    >
        {anchor.children}
    </a>
}

function CustomFigure(
    figure: ClassAttributes<HTMLElement> & HTMLAttributes<HTMLElement>,
    css: CSSProperties
): JSX.Element {
    return <figure style={{...figure.style, ...css}}>
        {figure.children}
    </figure>
}

function CustomFigureCaption(
    caption: ClassAttributes<HTMLElement> & HTMLAttributes<HTMLElement>,
    css: CSSProperties
): JSX.Element {
    return <figcaption style={{...caption.style, ...css}}>
        {caption.children}
    </figcaption>
}

/**
 * Updates the base (fallback) image name with the theme name. For example, if
 * the base image name is "navigation-bar.png" and the theme is set to "dark", then will
 * attempt to find an image named "navigation-bar-dark.png". Similarly, if the theme
 * is set to "light" then it will attempt to find an image named "navigation-bar-light.png".
 * If not found, will revert to the fallback image. Note that the base image need not
 * actually exist. But if it doesn't, the fallback will fail.
 * @param image The image element
 * @param css The styles for the image
 * @param [theme=lightTheme]
 * @return A an image element
 */
function CustomImage(
    image: ClassAttributes<HTMLImageElement> & ImgHTMLAttributes<HTMLImageElement> & ExtraProps,
    css: CSSProperties,
    theme: Theme = lightTheme
): JSX.Element {
    const [error, setError] = useState(false)

    const extensionIndex = image.src?.lastIndexOf(".") || -1
    if (extensionIndex >= 0 && !error) {
        const imageSrc = `${image.src?.slice(0, extensionIndex)}-${theme.name}${image.src?.slice(extensionIndex)}`
        return <img
            src={imageSrc}
            alt={image.alt}
            onError={() => setError(true)}
            width={image.width}
            height={image.height}
            style={{...image.style, ...css}}
        />
    }
    return <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        style={{...image.style, ...css}}
    />
}

function CustomVideo(
    video: ClassAttributes<HTMLVideoElement> & VideoHTMLAttributes<HTMLVideoElement>,
    css: CSSProperties
): JSX.Element {
    return <video controls={video.controls} width={css.width} style={{...video.style, ...css}}>
        {video.children}
    </video>
}
