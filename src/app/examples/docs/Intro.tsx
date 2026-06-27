import type {Theme} from "../../ui/Themes.ts";
import {
    type AnchorHTMLAttributes,
    type ClassAttributes,
    type CSSProperties,
    type HTMLAttributes,
    type ImgHTMLAttributes,
    type JSX,
    useState,
    type VideoHTMLAttributes
} from "react";
import {Button} from "../../ui/Button.tsx";
import intro_page from "./intro.md?raw";
import anatomy_of_example_page from "./anatomy-of-example.md?raw";
import ReactMarkdown, {type ExtraProps} from "react-markdown";
import rehypeRaw from 'rehype-raw';
import {buttonStyle, interpolateColor} from "../../ui/utils.ts";
import {useGridCell} from "react-resizable-grid-layout";
import {FloatingNavigation} from "../../ui/FloatingNavigation.tsx";
import {backIcon, firstIcon, forwardIcon, lastIcon} from "../../ui/Icons.tsx";

const pages = [intro_page, anatomy_of_example_page]

function style(theme: Theme, height: number): CSSProperties {
    return {
        backgroundColor: theme.backgroundColor,
        color: theme.color,
        width: 'auto',
        // marginLeft: 40,
        // marginRight: 40,
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

type Props = {
    theme: Theme
}

export default function Intro(props: Props) {
    const {theme} = props
    const numPages = pages.length
    const [pageNum, setPageNum] = useState<number>(0)

    const {height} = useGridCell()
    const cssStyle = style(theme, height)
    
    return (
        <div
            style={cssStyle}
        >
            <ReactMarkdown
                components={{
                    a: anchor => CustomLink(anchor, {
                        color: theme.color,
                        fontWeight: adjustFontWeight(cssStyle.fontWeight, 50)
                    }),
                    figure: figure => CustomFigure(figure, {paddingLeft: 0, marginLeft: 0, width: "100%"}),
                    figcaption: figureCaption => CustomFigureCaption(figureCaption, {
                        color: theme.color,
                        fontSize: adjustFontSize(cssStyle.fontSize, -2)
                    }),
                    img: image => CustomImage(image, {maxWidth: "100%", height: "auto", borderRadius: 10}),
                    video: video => CustomVideo(video, {width: "100%"}),
                }}
                rehypePlugins={[
                    rehypeRaw,
                ]}
            >
                {pages[pageNum]}
            </ReactMarkdown>

            <FloatingNavigation theme={theme}>
                <Navigation
                    theme={theme}
                    pageNum={pageNum}
                    numPages={numPages}
                    updatePageNum={setPageNum}
                />
            </FloatingNavigation>
        </div>
    )
}


type NavigationProps = {
    theme: Theme,
    pageNum: number,
    numPages: number,
    updatePageNum: (pageNum: number) => void
}

function Navigation(props: NavigationProps): JSX.Element {

    const {theme, pageNum, numPages, updatePageNum} = props
    const style = {...buttonStyle(theme), marginLeft: 3, marginRight: 3, marginTop: 6, marginBottom: 6}

    return (
        <>
            <Button
                style={style}
                onClick={() => updatePageNum(0)} disabled={pageNum === 0 || numPages <= 1}
                icon={color => firstIcon(color)}
            >
                First
            </Button>
            <Button
                style={style}
                onClick={() => updatePageNum(pageNum - 1)} disabled={pageNum === 0}
                icon={color => backIcon(color)}
            >
                Previous
            </Button>
            <Button
                style={style}
                onClick={() => updatePageNum(pageNum + 1)} disabled={pageNum >= numPages - 1}
                icon={color => forwardIcon(color)}
            >
                Next
            </Button>
            <Button
                style={style}
                onClick={() => updatePageNum(numPages - 1)} disabled={pageNum >= numPages - 1 || numPages <= 1}
                icon={color => lastIcon(color)}
            >
                Last
            </Button>
        </>
    )
}

type FontWeight = number
    | "normal" | "bold" | "bolder" | "lighter"
    | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
    | "initial" | "inherit" | "unset" | "revert"
    | (string & {})

function adjustFontWeight(weight: FontWeight | undefined, adjustment: number, defaultWeight: number = 500): number {
    return parseInt(`${weight?.valueOf() || defaultWeight}`) + adjustment;
}

type FontSize = string | number | (string & {})

function adjustFontSize(size: FontSize | undefined, adjustment: number, defaultSize: number = 15): number {
    return parseInt(`${size?.valueOf() || defaultSize}`) + adjustment;
}

function CustomLink(
    anchor: ClassAttributes<HTMLAnchorElement> & AnchorHTMLAttributes<HTMLAnchorElement>,
    css: CSSProperties
): JSX.Element {
    return <a
        href={anchor.href}
        target="_blank" rel="noopener noreferrer"
        style={{...anchor.style, ...css}}
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

function CustomImage(
    image: ClassAttributes<HTMLImageElement> & ImgHTMLAttributes<HTMLImageElement> & ExtraProps,
    css: CSSProperties
): JSX.Element {
    return <img src={image.src} alt={image.alt} style={{...image.style, ...css}}/>
}

function CustomVideo(
    video: ClassAttributes<HTMLVideoElement> & VideoHTMLAttributes<HTMLVideoElement>,
    css: CSSProperties
): JSX.Element {
    return <video controls={video.controls} width={css.width} style={{...video.style, ...css}}>
        {video.children}
    </video>
}
