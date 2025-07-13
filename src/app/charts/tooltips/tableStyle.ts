import {TableData} from "./tableData";

// todo get rid of the notion of headers once the data is set. instead, each
//    row wil have a style, and each column will have a style, and the headers
//    will just be a row with a "header-type" style
//
//    a column will have width, alignment, background color, font, left/right
//    padding, left/right margin,


export type TableFont = {
    size: number
    color: string
    family: string
    weight: number
}
export const defaultTableFont: TableFont = {size: 12, color: 'black', family: 'sans-serif', weight: 400}

export type Background = {
    color: string
    opacity: number
}
export const defaultTableBackground: Background = {color: 'white', opacity: 0}

export type Padding = {
    left: number
    right: number
    top: number
    bottom: number
}
export const defaultTablePadding = {left: 0, right: 0, top: 0, bottom: 0}

export type Margin = {
    left: number
    right: number
    top: number
    bottom: number
}
export const defaultTableMargin = {left: 0, right: 0, top: 0, bottom: 0}

export type Border = {
    color: string
    // opacity: number
    width: number
    radius: number
}
export const defaultTableBorder: Border = {color: 'black', radius: 0, width: 0}

/**
 * The style for each column (for what is not determined by each row's style).
 */
export type ColumnStyle = {
    defaultWidth: number
    minWidth: number
    maxWidth: number
    leftPadding: number
    rightPadding: number
    alignText: "left" | "center" | "right"
}

/**
 * Note that the {@link ColumnStyle} determines the text alignment for
 * each column. Therefore, the alignment of the text in a row is determined
 * by the alignment for all the rows in the column.
 */
export type RowStyle = {
    defaultHeight: number
    minHeight: number
    maxHeight: number
    topPadding: number
    bottomPadding: number
}

/**
 * Confusing as it may be, this is the style for the **row** that holds the
 * headers for each column. The styling for this row may differ from the
 * other rows in the table.
 */
export type ColumnHeaderStyle = {
    height: number
    topPadding: number
    bottomPadding: number
}

/**
 * Confusing as it may be, this is the style for the **column** that holds
 * the headers for each row. The styling for this column may differ from the
 * columns in the table.
 */
export type RowHeaderStyle = {
    width: number
    leftPadding: number
    rightPadding: number
    alignText: "left" | "right" | "center"
}

export type TableStyle = {
    font: TableFont
    headerFont: TableFont
    // rowHeaderFont: TableFont

    background: Background
    headerBackground: Background

    border: Border

    // the default width of the table bounds (the actual table will have a width
    // that is calculated by (defaultWidth - paddingLeft - paddingRight)
    width: number
    // the default height of the table bounds (the actual table will have a height
    // that is calculated by (defaultHeight - paddingTop - paddingBottom)
    height: number

    padding: Padding
    margin: Margin


    // a row may have a header, and the row-headers form a column that sits before
    // the other columns, and so here we want the width of that column. this value
    // must be specified if the data has row-headers
    rowHeaderStyle: RowHeaderStyle

    // a column may have a header, and the column-headers form a row that sits before
    // the other rows, and so here we want the height of that row. this value must be
    // specified if the data has column-headers
    columnHeaderStyle: ColumnHeaderStyle

    // the style (height bounds and padding) for each row
    rows: Array<RowStyle>
    // the style (width bounds, padding, and text alignment) for each column
    columns: Array<ColumnStyle>
}

const emptyTableFont: TableFont = {
    size: NaN,
    color: '',
    family: '',
    weight: NaN
}

function isTableFontEmpty(font: TableFont) {
    return isNaN(font.size) || font.color === '' || font.family === '' || isNaN(font.weight)
}

const emptyBackground: Background = {color: '', opacity: NaN}
function isBackgroundEmpty(background: Background) {
    return background.color === '' || isNaN(background.opacity)
}

const emptyColumnHeaderStyle: ColumnHeaderStyle = {
    height: NaN,
    bottomPadding: NaN,
    topPadding: NaN
}

function isColumnHeaderStyleEmpty(style: ColumnHeaderStyle) {
    return isNaN(style.height) || isNaN(style.bottomPadding) || isNaN(style.topPadding)
}

const emptyRowHeaderStyle: RowHeaderStyle = {
    width: NaN,
    alignText: "center",
    leftPadding: NaN,
    rightPadding: NaN
}
function isRowHeaderStyleEmpty(style: RowHeaderStyle) {
    return (isNaN(style.width) || isNaN(style.leftPadding) || isNaN(style.rightPadding)) &&
        style.alignText === "center"
}

type HeaderInfo<H, E> = {
    readonly font: TableFont
    readonly headerStyle: H
    readonly elementStyle: Array<E>
}
type ColumnHeaderInfo = HeaderInfo<ColumnHeaderStyle, ColumnStyle>
type RowHeaderInfo = HeaderInfo<RowHeaderStyle, RowStyle>

const emptyColumnHeaderInfo: ColumnHeaderInfo = {
    font: emptyTableFont,
    headerStyle: emptyColumnHeaderStyle,
    elementStyle: []
}
function isColumnHeaderInfoEmpty(style: ColumnHeaderInfo) {
    return isTableFontEmpty(style.font) ||
        isColumnHeaderStyleEmpty(style.headerStyle) //||
        // style.elementStyle.length === 0
}

const emptyRowHeaderInfo: RowHeaderInfo = {
    font: emptyTableFont,
    headerStyle: emptyRowHeaderStyle,
    elementStyle: []
}
function isRowHeaderInfoEmpty(style: RowHeaderInfo) {
    return isTableFontEmpty(style.font) ||
        isRowHeaderStyleEmpty(style.headerStyle) //||
        // style.elementStyle.length === 0
}

export function createTableStyleFor(tableData: TableData): TableStyleBuilder {
    return new TableStyleBuilder(tableData)
}
// export function createTableStyleFor(tableData: TableData): TableStyleColumnHeaderBuilder {
//     return new TableStyleColumnHeaderBuilder(tableData)
// }

type TableLevelStyles = {
    background: Background | undefined
    headerBackground: Background | undefined
    border: Border
    width: number
    height: number
    padding: Padding
    margin: Margin
}

class TableStyleBuilder {
    private readonly tableData: TableData
    private background: Background
    private headerBackground: Background
    private border: Border
    private width: number
    private height: number
    private padding: Padding
    private margin: Margin

    private columnHeader: ColumnHeaderInfo
    private rowHeader: RowHeaderInfo

    constructor(tableData: TableData) {
        this.tableData = tableData
        this.background = emptyBackground
        this.headerBackground = emptyBackground
        this.border = defaultTableBorder
        this.width = NaN
        this.height = NaN
        this.padding = defaultTablePadding
        this.margin = defaultTableMargin

        this.columnHeader = emptyColumnHeaderInfo
        this.rowHeader = emptyRowHeaderInfo
    }

    public withTableBackground(background: Background): TableStyleBuilder {
        this.background = background
        // default the header background to the table background unless it
        // had be set explicitly
        if (this.headerBackground === undefined) {
            this.headerBackground = background
        }
        return this
    }

    public withHeaderBackground(background: Background): TableStyleBuilder {
        this.headerBackground = background
        return this
    }

    public withBorder(border: Border): TableStyleBuilder {
        this.border = border
        return this
    }

    public withDimensions(width: number, height: number): TableStyleBuilder {
        this.width = width
        this.height = height
        return this
    }

    public withPadding(padding: Padding): TableStyleBuilder {
        this.padding = padding
        return this
    }

    public withMargin(margin: Margin): TableStyleBuilder {
        this.margin = margin
        return this
    }

    public withColumnHeaderStyle(font: TableFont, headerStyle: ColumnHeaderStyle, elementStyle: Array<ColumnStyle>): TableStyleBuilder {
        this.columnHeader = {font, headerStyle, elementStyle}
        return this
    }
    // public withColumnHeaderStyle(font: TableFont, headerStyle: ColumnHeaderStyle, elementStyle: Array<ColumnStyle>): TableStyleBuilder {
    //     this.columnHeader = {font, headerStyle, elementStyle}
    //     return this
    // }

    public withoutColumnHeaderStyle(): TableStyleBuilder {
        this.columnHeader = emptyColumnHeaderInfo
        return this
    }

    public withRowHeaderStyle(font: TableFont, headerStyle: RowHeaderStyle, elementStyle: Array<RowStyle>): TableStyleBuilder {
        this.rowHeader = {font, headerStyle, elementStyle}
        return this
    }
    // public withRowHeaderStyle(font: TableFont, headerStyle: RowHeaderStyle, elementStyle: Array<RowStyle>): TableStyleBuilder {
    //     this.rowHeader = {font, headerStyle, elementStyle}
    //     return this
    // }

    public withoutRowHeaderStyle(): TableStyleBuilder {
        this.rowHeader = emptyRowHeaderInfo
        return this
    }

    public build(): TableStyle {
        // when the column header style is set, ensure that it is consistent with the header
        // information in the table data
        if (!isColumnHeaderStyleEmpty(this.columnHeader.headerStyle) && !this.tableData.hasColumnHeaders) {
            const message = "The column header style can only be supplied when the table data has a column header"
            console.error(message)
            throw new Error(message)
        }
        // if (this.columnHeader.elementStyle.length !== this.tableData.columnHeader.length) {
        //     const message = "The number of elements in the column header style must match the number of column header " +
        //         `elements in the table data; num_header_style: ${this.tableData.columnHeader.length}; ` +
        //         `num_table_data_header: ${this.tableData.columnHeader.length}; `
        //     console.error(message)
        //     throw new Error(message)
        // }
        // when the table data has a column header, then the style must be specified
        if (isColumnHeaderStyleEmpty(this.columnHeader.headerStyle) && this.tableData.hasColumnHeaders) {
            const message = "The column header style must be specified when the table data has a column header"
            console.error(message)
            throw new Error(message)
        }

        // when that row header style is set, ensure tha it is consistent with the header
        // information in the table data
        if (!isRowHeaderStyleEmpty(this.rowHeader.headerStyle) && this.tableData.hasRowHeaders) {
            const message = "The row header style can only be supplied when the table data has row headers"
            console.error(message)
            throw new Error(message)
        }
        // if (this.rowHeader.elementStyle.length !== this.tableData.rowHeader.length) {
        //     const message = "The number of rows in the row header style must match the number of row headers " +
        //         `rows in the table data; num_header_style: ${this.tableData.rowHeader.length}; ` +
        //         `num_table_data_header: ${this.tableData.rowHeader.length}; `
        //     console.error(message)
        //     throw new Error(message)
        // }
        // when the table data has a column header, then the style must be specified
        if (isRowHeaderStyleEmpty(this.rowHeader.headerStyle) && this.tableData.hasRowHeaders) {
            const message = "The row header style must be specified when the table data has row headers"
            console.error(message)
            throw new Error(message)
        }

        return {
            font: emptyTableFont,

            background: this.background,
            headerBackground: this.headerBackground,

            border: this.border,
            padding: this.padding,
            margin: this.margin,

            width: this.width,
            height: this.height,

            headerFont: this.columnHeader.font,
            columnHeaderStyle: this.columnHeader.headerStyle,
            columns: this.columnHeader.elementStyle,

            // rowHeaderFont: this.rowHeader.font,
            rowHeaderStyle: this.rowHeader.headerStyle,
            rows: this.rowHeader.elementStyle,
        }
    }
}

// class TableStyleColumnHeaderBuilder {
//     private readonly tableData: TableData
//
//     constructor(tableData: TableData) {
//         this.tableData = tableData
//     }
//
//     public withColumnHeaderStyle(font: TableFont, headerStyle: ColumnHeaderStyle, elementStyle: Array<ColumnStyle>): TableStyleRowHeaderBuilder {
//         if (!this.tableData.hasColumnHeaders) {
//             const message = "The column header style can only be supplied when the table data has a column header"
//             console.error(message)
//             throw new Error(message)
//         }
//         if (elementStyle.length !== this.tableData.columnHeader.length) {
//             const message = "The number of elements in the column header style must match the number of column header " +
//                 `elements in the table data; num_header_style: ${this.tableData.columnHeader.length}; ` +
//                 `num_table_data_header: ${this.tableData.columnHeader.length}; `
//             console.error(message)
//             throw new Error(message)
//         }
//         const header: ColumnHeaderInfo = {font, headerStyle, elementStyle}
//         return new TableStyleRowHeaderBuilder(this.tableData, header)
//     }
//
//     public withoutColumnHeaderStyler(): TableStyleRowHeaderBuilder {
//         if (this.tableData.hasColumnHeaders) {
//             const message = "The column header style must be specified when the table data has a column header"
//             console.error(message)
//             throw new Error(message)
//         }
//         const header: ColumnHeaderInfo = {
//             font: emptyTableFont,
//             headerStyle: emptyColumnHeaderStyle,
//             elementStyle: []
//         }
//         return new TableStyleRowHeaderBuilder(this.tableData, header)
//     }
// }

// class TableStyleRowHeaderBuilder {
//     private readonly tableData: TableData
//     private readonly columnHeader: ColumnHeaderInfo
//
//     constructor(
//         tableData: TableData,
//         columnHeader: ColumnHeaderInfo
//     ) {
//         this.tableData = tableData
//         this.columnHeader = columnHeader
//     }
//
//     public withRowHeaderStyle(font: TableFont, headerStyle: RowHeaderStyle, elementStyle: Array<RowStyle>): TableStyleDataBuilder {
//         const header: RowHeaderInfo = {font, headerStyle, elementStyle}
//         return new TableStyleDataBuilder(this.tableData, this.columnHeader, header)
//     }
//
//     public withoutRowHeaderStyle(): TableStyleDataBuilder {
//         const header: RowHeaderInfo = {
//             font: emptyTableFont,
//             headerStyle: emptyRowHeaderStyle,
//             elementStyle: []
//         }
//         return new TableStyleDataBuilder(this.tableData, this.columnHeader, header)
//     }
// }

// class TableStyleDataBuilder {
//     private readonly tableData: TableData
//     private readonly columnHeader: ColumnHeaderInfo
//     private rowHeader: RowHeaderInfo
//
//     constructor(
//         tableData: TableData,
//         columnHeader: ColumnHeaderInfo,
//         rowHeader: RowHeaderInfo
//     ) {
//         this.tableData = tableData
//         this.columnHeader = columnHeader
//         this.rowHeader = rowHeader
//     }
//
//     public withDataAsRow(data: Array<RowStyle>)
// }