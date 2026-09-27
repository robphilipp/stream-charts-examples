export interface SvgStyle {
    height?: string | number;
    width?: string | number;
    outline?: string;

    [propName: string]: string | number | undefined;
}

export const initialSvgStyle: SvgStyle = {
    width: '100%',
    top: 0,
    left: 0
}

export interface SvgStrokeStyle {
    readonly color: string
    readonly width: number
    readonly opacity: number
}

export interface SvgFillStyle {
    readonly color: string
    readonly opacity: number
}
