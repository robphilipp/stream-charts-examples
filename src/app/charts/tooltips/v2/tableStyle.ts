import {TableData} from "./tableData";
import {defaultTableFont} from "./tableUtils";

// todo get rid of the notion of headers once the data is set. instead, each
//    row wil have a style, and each column will have a style, and the headers
//    will just be a row with a "header-type" style
//
//    for a column, specify
//    a column will have width, alignment, background color, font, left/right
//    padding, left/right margin, left/right border
//
//    for a row specify
//    a row wil have height, background color, font, top/bottom padding, top/bottom
//    margin, top/bottom border
//
//    these get translated into cell styles where each of the cells has the
//    combined styling (background color is special).


export type TableFont = {
    size: number
    color: string
    family: string
    weight: number
}

export type Background = {
    color: string
    opacity: number
}

const defaultBackground: Background = {color: '#fff', opacity: 0}

export type Padding = {
    left: number
    right: number
    top: number
    bottom: number
}
const defaultPadding: Padding = {left: 0, right: 0, top: 0, bottom: 0}

export type Margin = {
    left: number
    right: number
    top: number
    bottom: number
}
const defaultMargin: Margin = {left: 0, right: 0, top: 0, bottom: 0}

export type Border = {
    color: string
    opacity: number
    width: number
    radius: number
}
const defaultBorder: Border = {color: 'black', radius: 0, width: 0, opacity: 0}

export type Dimension = {
    width: number
    defaultWidth: number
    minWidth: number
    maxWidth: number

    height: number
    defaultHeight: number
    minHeight: number
    maxHeight: number
}

/**
 * The style for each column (for what is not determined by each row's style).
 */
export type ColumnStyle = {
    alignText: "left" | "center" | "right"
    dimension: Pick<Dimension, "defaultWidth" | "minWidth" | "maxWidth">
    padding: Pick<Padding, "left" | "right">
}

/**
 * Note that the {@link ColumnStyle} determines the text alignment for
 * each column. Therefore, the alignment of the text in a row is determined
 * by the alignment for all the rows in the column.
 */
export type RowStyle = {
    font: TableFont
    background: Background
    dimension: Pick<Dimension, "defaultHeight" | "minHeight" | "maxHeight">
    padding: Pick<Padding, "top" | "bottom">
}

/**
 * Confusing as it may be, this is the style for the **row** that holds the
 * headers for each column. The styling for this row may differ from the
 * other rows in the table.
 */
export type ColumnHeaderStyle = {
    font: TableFont
    alignText: "left" | "right" | "center"
    dimension: Pick<Dimension, "height">
    padding: Pick<Padding, "top" | "bottom">
    background: Background
}
const defaultColumnHeaderStyle: ColumnHeaderStyle = {
    font: defaultTableFont,
    background: defaultBackground,
    alignText: "center",
    dimension: {height: 15},
    padding: defaultPadding
}

/**
 * Confusing as it may be, this is the style for the **column** that holds
 * the headers for each row. The styling for this column may differ from the
 * columns in the table.
 */
export type RowHeaderStyle = {
    font: TableFont
    alignText: "left" | "right" | "center"
    // dimension: Pick<Dimension, "width">
    padding: Pick<Padding, "left" | "right">
    background: Background
}
const defaultRowHeaderStyle: RowHeaderStyle = {
    font: defaultTableFont,
    background: defaultBackground,
    alignText: "center",
    // dimension: {width: 15},
    padding: defaultPadding
}

export type TableStyle = {
    font: TableFont

    border: Border
    background: Background

    dimension: Pick<Dimension, "width" | "height">
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
    rowStyles: Array<RowStyle>
    // the style (width bounds, padding, and text alignment) for each column
    columnStyles: Array<ColumnStyle>
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
    font: emptyTableFont,
    alignText: "center",
    dimension: {height: NaN},
    padding: {top: NaN, bottom: NaN},
    background: emptyBackground
}

function isColumnHeaderStyleEmpty(style: ColumnHeaderStyle) {
    return isNaN(style.dimension.height) && isNaN(style.padding.bottom) && isNaN(style.padding.top) &&
        style.alignText === "center" && isTableFontEmpty(style.font) && isBackgroundEmpty(style.background)
}

function hasColumnHeaderStyle(style: ColumnHeaderStyle) {
    return !isColumnHeaderStyleEmpty(style)
}

const emptyRowHeaderStyle: RowHeaderStyle = {
    font: emptyTableFont,
    alignText: "center",
    // dimension: {width: NaN},
    padding: {left: NaN, right: NaN},
    background: emptyBackground
}

function isRowHeaderStyleEmpty(style: RowHeaderStyle) {
    return (isNaN(style.padding.left) || isNaN(style.padding.right)) &&
    // return (isNaN(style.dimension.width) || isNaN(style.padding.left) || isNaN(style.padding.right)) &&
        style.alignText === "center" && isTableFontEmpty(style.font) && isBackgroundEmpty(style.background)
}

function hasRowHeaderStyle(style: RowHeaderStyle) {
    return !isRowHeaderStyleEmpty(style)
}

export function createTableStyleFor(tableData: TableData): TableStyleBuilder {
    return new TableStyleBuilder(tableData)
}

/**
 * Returns a table object of rows and columns that have the data and style for each element in the table.
 */
class TableStyleBuilder {
    private readonly tableData: TableData

    // table-level styles
    private font: TableFont
    private border: Border
    private background: Background
    private dimension: Pick<Dimension, "width" | "height">
    private padding: Padding
    private margin: Margin

    // header styles
    private columnHeaderStyle: ColumnHeaderStyle
    private rowHeaderStyle: RowHeaderStyle

    private rowStyles: Array<RowStyle>
    private columnStyles: Array<ColumnStyle>

    constructor(tableData: TableData) {
        this.tableData = tableData

        this.font = defaultTableFont
        this.border = defaultBorder
        this.background = defaultBackground
        this.dimension = {width: NaN, height: NaN}
        this.padding = defaultPadding
        this.margin = defaultMargin

        this.columnHeaderStyle = defaultColumnHeaderStyle
        this.rowHeaderStyle = defaultRowHeaderStyle

        this.rowStyles = []
        this.columnStyles = []
    }

    public withTableBackground(background: Background): TableStyleBuilder {
        this.background = background
        // default the header background to the table background unless it
        // had be set explicitly
        if (this.columnHeaderStyle.background === undefined) {
            this.columnHeaderStyle.background = background
        }
        return this
    }

    public withBorder(border: Border): TableStyleBuilder {
        this.border = border
        return this
    }

    public withDimensions(width: number, height: number): TableStyleBuilder {
        this.dimension = {width, height}
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

    public withColumnHeaderStyle(style: Partial<ColumnHeaderStyle>): TableStyleBuilder {
        this.columnHeaderStyle = {...this.columnHeaderStyle, ...style}
        return this
    }

    /**
     * Calling this function sets the column-header style to be the same as the column style for the table
     * @return A reference to this builder for chaining
     */
    public withoutColumnHeaderStyle(): TableStyleBuilder {
        this.columnHeaderStyle = emptyColumnHeaderStyle
        return this
    }

    public withRowHeaderStyle(style: Partial<RowHeaderStyle>): TableStyleBuilder {
        this.rowHeaderStyle = {...this.rowHeaderStyle, ...style}
        return this
    }

    /**
     * Calling this function sets the row-header style to be the same as the row style for the table
     * @return A reference to this builder for chaining
     */
    public withoutRowHeaderStyle(): TableStyleBuilder {
        this.rowHeaderStyle = emptyRowHeaderStyle
        return this
    }

    public withColumnStyles(styles: Array<ColumnStyle>): TableStyleBuilder {
        return this
    }

    public withRowStyles(styles: Array<RowStyle>): TableStyleBuilder {
        return this
    }

    public build(): TableStyle {
        // when the column header style is set, ensure that it is consistent with the header
        // information in the table data
        if (hasColumnHeaderStyle(this.columnHeaderStyle) && !this.tableData.hasColumnHeaders) {
            const message = "The column header style can only be supplied when the table data has a column header"
            console.error(message)
            throw new Error(message)
        }
        // if (this.columnHeaderStyle.elementStyle.length !== this.tableData.columnHeader.length) {
        //     const message = "The number of elements in the column header style must match the number of column header " +
        //         `elements in the table data; num_header_style: ${this.tableData.columnHeader.length}; ` +
        //         `num_table_data_header: ${this.tableData.columnHeader.length}; `
        //     console.error(message)
        //     throw new Error(message)
        // }
        // when the table data has a column header, then the style must be specified
        if (isColumnHeaderStyleEmpty(this.columnHeaderStyle) && this.tableData.hasColumnHeaders) {
            const message = "The column header style must be specified when the table data has a column header"
            console.error(message)
            throw new Error(message)
        }

        // when that row header style is set, ensure tha it is consistent with the header
        // information in the table data
        if (!isRowHeaderStyleEmpty(this.rowHeaderStyle) && this.tableData.hasRowHeaders) {
            const message = "The row header style can only be supplied when the table data has row headers"
            console.error(message)
            throw new Error(message)
        }
        // if (this.rowHeaderStyle.elementStyle.length !== this.tableData.rowHeader.length) {
        //     const message = "The number of rows in the row header style must match the number of row headers " +
        //         `rows in the table data; num_header_style: ${this.tableData.rowHeader.length}; ` +
        //         `num_table_data_header: ${this.tableData.rowHeader.length}; `
        //     console.error(message)
        //     throw new Error(message)
        // }
        // when the table data has a column header, then the style must be specified
        if (isRowHeaderStyleEmpty(this.rowHeaderStyle) && this.tableData.hasRowHeaders) {
            const message = "The row header style must be specified when the table data has row headers"
            console.error(message)
            throw new Error(message)
        }

        return {
            font: this.font,

            background: this.background,

            border: this.border,
            dimension: this.dimension,
            padding: this.padding,
            margin: this.margin,

            columnHeaderStyle: this.columnHeaderStyle,
            columnStyles: this.columnStyles,

            rowHeaderStyle: this.rowHeaderStyle,
            rowStyles: this.rowStyles,
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