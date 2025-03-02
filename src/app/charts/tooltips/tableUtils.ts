import {failureResult, Result, successResult} from "result-fn";
import {ElementInfo, TableDataInfo, TableDimensions, TableStyle} from "./tableSvg";
import {TableData} from "./tableData";

export type Anchor = "center" | "left" | "right"
export type ColumnInfo = { width: number, offset: number, anchor: Anchor }
export type ColumnWidthInfo = {
    headerWidth: number
    columns: Array<ColumnInfo>
}

export type RowInfo = { height: number, offset: number }
export type RowHeightInfo = {
    headerHeight: number
    rows: Array<RowInfo>
}

// export function textWidthOf(elem: TextSelection): number {
//     return elem.node()?.getBBox()?.width || 0
// }
//
// export function textHeightOf(elem: TextSelection): number {
//     return elem.node()?.getBBox()?.height || 0
// }
//
// export function spacesWidthFor(spaces: number, text: TextSelection): number {
//     return spaces * textWidthOf(text) / text.text().length
// }


/**
 * Checks the dimensions of the table against the number of data rows and columns. Prefer the
 * {@link validateTableDimensions} function.
 * @param style The table style holding (width, height, default column-widths, and default row-heights)
 * @param data The table data
 * @return `true` if the table dimensions are valid, and `false` otherwise
 */
export function areTableDimensionsValid(style: Partial<TableStyle>, data: TableData): boolean {
    return validateTableDimensions(style, data).succeeded
}

/**
 * Checks that the table's data-info rows all have the same number of columns. Prefer the {@link validateInfoDimensions}
 * function.
 * @param tableInfo The row widths and column heights, offsets, and text-selections
 * @return `true` if the table dimensions are valid, and `false` otherwise
 */
export function areInfoDimensionsValid(tableInfo: TableDataInfo): boolean {
    return validateInfoDimensions(tableInfo).succeeded
}

/**
 * Checks the dimensions of the table against the number of data rows and columns.
 * @param style The table style holding (width, height, default column-widths, and default row-heights)
 * @param data The table data
 * @return A {@link Result} that evaluates to `true` if the table dimensions are valid, and `false` otherwise
 */
export function validateTableDimensions(style: Partial<TableStyle>, data: TableData): Result<string, string> {
    //
    // check that the number of rows and columns match the number of data rows and columns
    if (style.rows && style.rows.length > 0 && style.rows.length !== data.numRows) {
        const message = "The number of row-heights specified must equal the number of rows. Cannot render table" +
            `num_row_heights: ${style.rows.length}; num_rows: ${data.numRows}`
        console.warn(message)
        return failureResult(message)
    }
    if (style.columns && style.columns.length > 0 && style.columns.length !== data.numColumns) {
        const message = "The number of column-widths specified must equal the number of columns. Cannot render table" +
            `num_column_widths: ${style.columns.length}; num_columns: ${data.numColumns}`
        console.warn(message)
        return failureResult(message)
    }

    //
    // check that the pixel dimensions work out when the table width and height are specified
    //
    // when the width is specified, then it must be at least the sum of the min-column widths
    const sumMinimumColumnsWidths = style.columns?.reduce((sum, column) => sum + column.minWidth, 0) || Infinity
    if (style.width && style.width > 0 && style.width < sumMinimumColumnsWidths) {
        const message = "The specified table width is less than the sum of the minimum column widths. Cannot render table" +
            `table_width: ${style.width}; sum_minimum_column_widths: ${sumMinimumColumnsWidths}`
        console.warn(message)
        return failureResult(message)
    }

    // when the height is specified, then it must be at least the sum of the min-row heights
    const sumMinimumRowHeights = style.rows?.reduce((sum, row) => sum + row.minHeight, 0) || Infinity
    if (style.height && style.height > 0 && style.height < sumMinimumRowHeights) {
        const message = "The specified table height is less than the sum of the minimum row heights. Cannot render table" +
            `table_height: ${style.height}; sum_minimum_heights: ${sumMinimumRowHeights}`
        console.warn(message)
        return failureResult(message)
    }

    //
    // when the data has row-headers, and the row-header width is not specified,
    // then check if there is enough space for the row-headers based on a proportional column width.
    // if not, the user should really specify the row-header width for the column
    if (style.rowHeaderWidth && style.width && style.columns) {
        if (data.hasRowHeaders && style.rowHeaderWidth <= 0 && (style.width - sumMinimumColumnsWidths) < style.width / (style.columns.length + 1)) {
            const message = "The data has row-headers and no row-header width was specified. In addition, there isn't enough " +
                "width left over after the minimum widths for each data column are summed. This check is done based on a" +
                "on an uniform allocation calculation. If you need less width for the row-header column, then please specify" +
                "the row-header-width. " +
                `has_row_headers: ${data.hasRowHeaders}; table_width: ${style.width} px; sum_minimum_column_widths: ${sumMinimumColumnsWidths} px; ` +
                `remaining_width_for_row_headers: ${style.width - sumMinimumColumnsWidths} px`
            console.warn(message)
            return failureResult(message)
        }
        if (data.hasRowHeaders && style.rowHeaderWidth > 0 && style.width - sumMinimumColumnsWidths < style.rowHeaderWidth) {
            const message = "The sum of the minimum columns widths, plus the row-header width, is greater than the specified table width. " +
                "Cannot render table. " +
                `table_width: ${style.width} px; sum_minimum_column_widths: ${sumMinimumColumnsWidths} px; row_header_width: ${style.rowHeaderWidth} px; `
            console.warn(message)
            return failureResult(message)
        }
    }

    // check that there is enough space for the column headers
    if (style.columnHeaderHeight && style.height && style.rows) {
        if (data.hasColumnHeaders && style.columnHeaderHeight <= 0 && (style.height - sumMinimumRowHeights) < style.height / (style.rows.length + 1)) {
            const message = "The data has column-headers and no column-header height was specified. In addition, there isn't enough " +
                "height left over after the minimum heights for each data row are summed. This check is done based on a" +
                "on an uniform allocation calculation. If you need less height for the column-header row, then please specify" +
                "the column-header-height. " +
                `has_column_headers: ${data.hasColumnHeaders}; table_height: ${style.height} px; sum_minimum_row_heights: ${sumMinimumRowHeights} px; ` +
                `remaining_height_for_column_headers: ${style.height - sumMinimumRowHeights} px`
            console.warn(message)
            return failureResult(message)
        }
        if (data.hasColumnHeaders && style.columnHeaderHeight > 0 && style.height - sumMinimumRowHeights < style.columnHeaderHeight) {
            const message = "The sum of the minimum row heights, plus the column-header height, is greater than the specified table height. " +
                "Cannot render table. " +
                `table_height: ${style.height} px; sum_minimum_row_heights: ${sumMinimumRowHeights} px; column_header_height: ${style.columnHeaderHeight} px; `
            console.warn(message)
            return failureResult(message)
        }
    }

    // passes all the tests
    return successResult("")
}

/**
 * Checks that the table's data-info rows all have the same number of columns.
 * @param tableInfo The row widths and column heights, offsets, and text-selections
 * @return A {@link Result} that evaluates to `true` if the table dimensions are valid, and `false` otherwise
 */
export function validateInfoDimensions(tableInfo: TableDataInfo): Result<string, string> {
    const {rowHeaders: rowHeaderInfo, columnHeaders: columnHeaderInfo, data: dataInfo} = tableInfo
    // check that the data-info rows all have the same number of columns
    const numColumns = dataInfo.map(row => row.length)
    const minColumns = Math.min(...numColumns)
    const maxColumns = Math.max(...numColumns)
    if (minColumns !== maxColumns) {
        const message = "Not all the rows have the same number of columns. This is confusing. Cannot render table. " +
            `num_columns: [${numColumns}]]`
        console.warn(message)
        return failureResult(message)
    }

    if (rowHeaderInfo.length !== dataInfo.length) {
        const message = "The number of row headers must equal the number of rows. Cannot render table. " +
            `num_row_headers: ${rowHeaderInfo.length}; num_rows: ${dataInfo.length}`
        console.warn(message)
        return failureResult(message)
    }

    if (columnHeaderInfo.length !== dataInfo[0].length) {
        const message = "The number of columns headers must equal the number of columns. Cannot render table. " +
            `num_column_headers: ${columnHeaderInfo.length}; num_columns: ${dataInfo[0].length}`
        console.warn(message)
        return failureResult(message)
    }
    return successResult("")
}

/**
 * Calculates the column widths for each column and the column holding the row headers.
 * The width of each column based on the largest item in the column, and the
 * table style that holds the max and min widths for each column
 * @param tableInfo
 * @param tableStyle
 * @param tableWidth The total width of the table for which to scale the columns. Set to zero or
 * Infinity if you do not wish to scale the columns to the table width
 * @private
 */
function calculateColumnMaxWidths(
    tableInfo: TableDataInfo,
    tableStyle: Partial<TableStyle>,
    tableWidth: number = 0
): ColumnWidthInfo {
    const {rowHeaderLeftPadding = 5, rowHeaderRightPadding = 5} = tableStyle
    const rowHeaderWidth = Math.max(...tableInfo.rowHeaders
        .map(header => header.textWidth + rowHeaderLeftPadding + rowHeaderRightPadding)
    )
    const numColumns = Math.max(...tableInfo.data.map(row => row.length))

    // when the min and max column widths are specified, and have the right size, then use
    // them, otherwise, set default values so that the min and max widths do not come into play
    const columnStyles = tableStyle.columns
    let minMaxWidths = columnStyles?.map(
        col => ({
            minWidth: col.minWidth,
            maxWidth: col.maxWidth,
            leftPadding: col.leftPadding,
            rightPadding: col.rightPadding,
            align: col.alignText
        }),
    )
    if (columnStyles === undefined || columnStyles.length !== numColumns) {
        minMaxWidths = new Array(numColumns)
        minMaxWidths.fill({minWidth: 0, maxWidth: Infinity, leftPadding: 5, rightPadding: 5, align: "center"})
    }

    // the text offset is determined by the table-style

    // calculate the bounded widths
    const columnWidths = tableInfo.data.reduce(
        (colMax: Array<ColumnInfo>, row: Array<ElementInfo>) => {
            for (let i = 0; i < row.length; ++i) {
                // cannot be undefined, and has the same number of columns as the rows
                const {minWidth, maxWidth, leftPadding, rightPadding, align} = minMaxWidths![i]

                // bound the width of the column
                if (row[i].textWidth > colMax[i].width) {
                    colMax[i].width = Math.min(maxWidth, Math.max(row[i].textWidth + leftPadding + rightPadding, minWidth))
                }

                // set the text offset based on the text alignment and padding
                switch (align) {
                    case "right":
                        colMax[i].offset = leftPadding
                        colMax[i].anchor = "right"
                        break
                    case "left":
                        colMax[i].offset = rightPadding
                        colMax[i].anchor = "left"
                        break
                    default:
                        colMax[i].offset = 0
                        colMax[i].anchor = "center"
                }
            }

            return colMax
        },
        new Array<ColumnInfo>(numColumns).map(_ => ({width: 0, offset: 0, anchor: "center" as Anchor}))
    )

    // when the table width has been specified, then scale the column widths to fit
    if (tableWidth > 0 && isFinite(tableWidth)) {
        // calculate the sum of the column widths and scale the columns to fit the table
        const totalWidth = rowHeaderWidth + columnWidths.reduce((sum, colInfo) => sum + colInfo.width, 0);
        if (totalWidth !== tableWidth) {
            const scale = tableWidth / totalWidth
            return {
                headerWidth: rowHeaderWidth * scale,
                columns: columnWidths.map(colInfo => ({
                    width: colInfo.width * scale,
                    offset: colInfo.offset,
                    anchor: colInfo.anchor
                })),
            }
        }
    }

    return {headerWidth: rowHeaderWidth, columns: columnWidths}
}

/**
 * Calculates the heights of each row, accounting for the column headers (when present) and the
 * padding for each row.
 * @param tableInfo
 * @param tableStyle
 * @param tableHeight The total height of the table for which to scale the rows. Set to zero or
 * Infinity if you do not wish to scale the rows to the table height
 * @private
 */
function calculateRowMaxHeights(
    tableInfo: TableDataInfo,
    tableStyle: Partial<TableStyle>,
    tableHeight: number = 0
): RowHeightInfo {
    const {columnHeaderBottomPadding = 5, columnHeaderTopPadding = 5} = tableStyle
    const columnHeaderHeight = Math.max(...tableInfo.columnHeaders
        .map(header => header.textHeight + columnHeaderBottomPadding + columnHeaderTopPadding)
    )
    // the number of data rows (there may also be a column-header row)
    const numRows = tableInfo.data.length

    // when the min and max row heights are specified, and have the right size, then use
    // them, otherwise, set the default values so that the min and max heights do not come into play
    const rowStyles = tableStyle.rows
    let minMaxHeights = rowStyles?.map(
        row => ({
            minHeight: row.minHeight,
            maxHeight: row.maxHeight,
            bottomPadding: row.bottomPadding,
            topPadding: row.topPadding
        })
    )
    if (rowStyles === undefined || rowStyles.length !== numRows) {
        minMaxHeights = new Array(numRows)
        minMaxHeights.fill({minHeight: 0, maxHeight: Infinity, bottomPadding: 5, topPadding: 5})
    }

    // calculate the bounded heights
    const rowHeights = tableInfo.data
        .map((row, index) => ({
            height: Math.max(...row.map(elem => elem.textHeight)),
            offset: minMaxHeights![index].bottomPadding
        }))

    // when the table height is specified, then scale the rows to fit
    if (tableHeight > 0 && isFinite(tableHeight)) {
        const totalHeight = columnHeaderHeight + rowHeights.reduce((sum, rowInfo) => sum + rowInfo.height, 0);
        if (totalHeight !== tableHeight) {
            const scale = tableHeight / totalHeight
            return {
                headerHeight: columnHeaderHeight * scale,
                rows: rowHeights.map(rowInfo => ({height: rowInfo.height * scale, offset: rowInfo.offset})),
            }
        }
    }

    return {headerHeight: 0, rows: rowHeights}
}

export function calculateTableCellDimensions(
    tableStyle: Partial<TableStyle>,
    tableInfo: TableDataInfo,
    tableData: TableData,
): Result<TableDimensions, string> {
    // use width and height if specified and calculate based on that, otherwise, free-form baby
    const tableWidth = tableStyle.width ?? Infinity;
    const tableHeight = tableStyle.height ?? Infinity;

    return validateTableDimensions(tableStyle, tableData)
        .andThen(() => validateInfoDimensions(tableInfo))
        .map(() => ({
            width: tableWidth,
            height: tableHeight,
            rows: calculateRowMaxHeights(tableInfo, tableStyle, tableHeight),
            columns: calculateColumnMaxWidths(tableInfo, tableStyle, tableWidth)
        }))
}