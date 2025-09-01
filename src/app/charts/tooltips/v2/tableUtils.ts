import {failureResult, Result, successResult} from "result-fn";
import {
    ElementPlacementInfo,
    TableDataPlacementInfo,
    TableDimensions,
} from "./tableSvg";
import {TableData} from "./tableData";
import * as d3 from "d3";
// import {select} from 'd3';
import {TooltipStyle} from "./tooltipUtils";
import {Background, Padding, TableFont, StyledTable} from "./tableStyler";

export type Anchor = "center" | "left" | "right"
export type ColumnInfo = { width: number, offset: number, anchor: Anchor }
export type ColumnWidthInfo = {
    header: ColumnInfo
    columns: Array<ColumnInfo>
}

export type RowInfo = { height: number, offset: number }
export type RowHeightInfo = {
    header: RowInfo
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
export function areTableDimensionsValid<V>(style: Partial<StyledTable<V>>, data: TableData<V>): boolean {
    return validateTableDimensions(style, data).succeeded
}

/**
 * Checks that the table's data-info rows all have the same number of columns. Prefer the {@link validateInfoDimensions}
 * function.
 * @param tableInfo The row widths and column heights, offsets, and text-selections
 * @return `true` if the table dimensions are valid, and `false` otherwise
 */
export function areInfoDimensionsValid(tableInfo: TableDataPlacementInfo): boolean {
    return validateInfoDimensions(tableInfo).succeeded
}

/**
 * Checks the dimensions of the table against the number of data rows and columns.
 * @param style The table style holding (width, height, default column-widths, and default row-heights)
 * @param data The table data
 * @return A {@link Result} that evaluates to `true` if the table dimensions are valid, and `false` otherwise
 */
export function validateTableDimensions<V>(style: Partial<StyledTable<V>>, data: TableData<V>): Result<string, string> {
    //
    // check that the number of rows and columns match the number of data rows and columns
    if (style.rowStyles && style.rowStyles.length > 0 && style.rowStyles.length !== data.numRows()) {
        const message = "The number of row-heights specified must equal the number of rows. Cannot render table" +
            `num_row_heights: ${style.rowStyles.length}; num_rows: ${data.numRows}`
        console.warn(message)
        return failureResult(message)
    }
    if (style.columnStyles && style.columnStyles.length > 0 && style.columnStyles.length !== data.numColumns()) {
        const message = "The number of column-widths specified must equal the number of columns. Cannot render table" +
            `num_column_widths: ${style.columnStyles.length}; num_columns: ${data.numColumns}`
        console.warn(message)
        return failureResult(message)
    }

    //
    // check that the pixel dimensions work out when the table width and height are specified
    //
    // when the width is specified, then it must be at least the sum of the min-column widths
    const sumMinimumColumnsWidths = style.columnStyles?.reduce((sum, column) => sum + column.dimension.minWidth, 0) || Infinity
    if (style.dimension?.width && style.dimension.width > 0 && style.dimension.width < sumMinimumColumnsWidths) {
        const message = "The specified table width is less than the sum of the minimum column widths. Cannot render table" +
            `table_width: ${style.dimension.width}; sum_minimum_column_widths: ${sumMinimumColumnsWidths}`
        console.warn(message)
        return failureResult(message)
    }

    // when the height is specified, then it must be at least the sum of the min-row heights
    const sumMinimumRowHeights = style.rowStyles?.reduce((sum, row) => sum + row.dimension.minHeight, 0) || Infinity
    if (style.dimension?.height && style.dimension.height > 0 && style.dimension.height < sumMinimumRowHeights) {
        const message = "The specified table height is less than the sum of the minimum row heights. Cannot render table" +
            `table_height: ${style.dimension.height}; sum_minimum_heights: ${sumMinimumRowHeights}`
        console.warn(message)
        return failureResult(message)
    }

    //
    // when the data has row-headers, and the row-header width is not specified,
    // then check if there is enough space for the row-headers based on a proportional column width.
    // if not, the user should really specify the row-header width for the column
    if (style.rowHeaderStyle?.dimension.width && style.dimension?.width && style.columnStyles) {
        if (data.hasRowHeader && style.rowHeaderStyle.dimension.width <= 0 && (style.dimension.width - sumMinimumColumnsWidths) < style.dimension.width / (style.columnStyles.length + 1)) {
            const message = "The data has row-headers and no row-header width was specified. In addition, there isn't enough " +
                "width left over after the minimum widths for each data column are summed. This check is done based on a" +
                "on an uniform allocation calculation. If you need less width for the row-header column, then please specify" +
                "the row-header-width. " +
                `has_row_headers: ${data.hasRowHeader}; table_width: ${style.dimension.width} px; sum_minimum_column_widths: ${sumMinimumColumnsWidths} px; ` +
                `remaining_width_for_row_headers: ${style.dimension.width - sumMinimumColumnsWidths} px`
            console.warn(message)
            return failureResult(message)
        }
        if (data.hasRowHeader && style.rowHeaderStyle.dimension.width > 0 && style.dimension.width - sumMinimumColumnsWidths < style.rowHeaderStyle.dimension.width) {
            const message = "The sum of the minimum columns widths, plus the row-header width, is greater than the specified table width. " +
                "Cannot render table. " +
                `table_width: ${style.dimension.width} px; sum_minimum_column_widths: ${sumMinimumColumnsWidths} px; row_header_width: ${style.rowHeaderStyle.dimension.width} px; `
            console.warn(message)
            return failureResult(message)
        }
    }

    // check that there is enough space for the column headers
    if (style.columnHeaderStyle?.dimension.height && style.dimension?.height && style.rowStyles) {
        if (data.hasColumnHeader && style.columnHeaderStyle.dimension.height <= 0 && (style.dimension.height - sumMinimumRowHeights) < style.dimension.height / (style.rowStyles.length + 1)) {
            const message = "The data has column-headers and no column-header height was specified. In addition, there isn't enough " +
                "height left over after the minimum heights for each data row are summed. This check is done based on a" +
                "on an uniform allocation calculation. If you need less height for the column-header row, then please specify" +
                "the column-header-height. " +
                `has_column_headers: ${data.hasColumnHeader}; table_height: ${style.dimension.height} px; sum_minimum_row_heights: ${sumMinimumRowHeights} px; ` +
                `remaining_height_for_column_headers: ${style.dimension.height - sumMinimumRowHeights} px`
            console.warn(message)
            return failureResult(message)
        }
        if (data.hasColumnHeader && style.columnHeaderStyle.dimension.height > 0 && style.dimension.height - sumMinimumRowHeights < style.columnHeaderStyle.dimension.height) {
            const message = "The sum of the minimum row heights, plus the column-header height, is greater than the specified table height. " +
                "Cannot render table. " +
                `table_height: ${style.dimension.height} px; sum_minimum_row_heights: ${sumMinimumRowHeights} px; column_header_height: ${style.columnHeaderStyle.dimension.height} px; `
            console.warn(message)
            return failureResult(message)
        }
    }

    // passes all the tests
    return successResult("")
}

/**
 * Checks that the table's data-info rows all have the same number of columns, that when the column
 * header is specified, that it has the same number of columns as the data, and that when the row
 * headers are specified they have the same number of rows as the data.
 *
 * @param tableInfo The row widths and column heights, offsets, and text-selections
 * @return A {@link Result} that evaluates to `true` if the table dimensions are valid, and `false` otherwise
 */
export function validateInfoDimensions(tableInfo: TableDataPlacementInfo): Result<TableDataPlacementInfo, string> {
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

    // todo (when the is a header row, we add an extra empty row-header, and this breaks the
    //    check below
    const expectedRows = columnHeaderInfo.length > 0 ? dataInfo.length + 1 : dataInfo.length
    if (rowHeaderInfo.length > 0 && (rowHeaderInfo.length !== expectedRows)) {
    // if (rowHeaderInfo.length > 0 && (rowHeaderInfo.length !== dataInfo.length)) {
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
    return successResult(tableInfo)
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
    tableInfo: TableDataPlacementInfo,
    tableStyle: Partial<StyledTable>,
    tableWidth: number = 0
): ColumnWidthInfo {
    const {rowHeaderStyle, padding = {left: 5}, margin = {left: 5}} = tableStyle
    const {left: leftPadding, right: rightPadding} = rowHeaderStyle?.padding ?? {left: 5, right: 5}
    const rowHeaderWidth = Math.max(
        ...tableInfo.rowHeaders.map(header => header.textWidth + leftPadding + rightPadding)
    )
    const numColumns = Math.max(...tableInfo.data.map(row => row.length))

    // when the min and max column widths are specified, and have the right size, then use
    // them, otherwise, set default values so that the min and max widths do not come into play
    const columnStyles = tableStyle.columnStyles
    let minMaxWidths = columnStyles?.map(
        col => ({
            minWidth: col.dimension.minWidth,
            maxWidth: col.dimension.maxWidth,
            leftPadding: col.padding.left,
            rightPadding: col.padding.right,
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
        (colMax: Array<ColumnInfo>, row: Array<ElementPlacementInfo>) => {
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
                        colMax[i].offset = colMax[i].width - rightPadding
                        colMax[i].anchor = "right"
                        break
                    case "left":
                        colMax[i].offset = rightPadding
                        colMax[i].anchor = "left"
                        break
                    default:
                        colMax[i].offset = colMax[i].width / 2
                        colMax[i].anchor = "center"
                }
            }

            return colMax
        },
        // new Array<ColumnInfo>(numColumns).map(_ => ({width: 0, offset: 0, anchor: "center" as Anchor}))
        new Array<ColumnInfo>(numColumns).fill({width: 0, offset: 0, anchor: "center" as Anchor})
    )

    // when the table width has been specified, then scale the column widths to fit
    if (tableWidth > 0 && isFinite(tableWidth)) {
        // calculate the sum of the column widths and scale the columns to fit the table
        const totalWidth = rowHeaderWidth + columnWidths.reduce(
            (sum, colInfo) => sum + colInfo.width,
            0
        );
        if (totalWidth !== tableWidth) {
            const scale = tableWidth / totalWidth
            return {
                // headerWidth: rowHeaderWidth * scale,
                header: {
                    width: rowHeaderWidth * scale,
                    offset: rowHeaderWidth * scale / 2,
                    // offset: margin.left + padding.left + leftPadding,
                    anchor: "center"    // todo this should be a specified value
                },
                columns: columnWidths.map(colInfo => ({
                    width: colInfo.width * scale,
                    offset: colInfo.offset,
                    anchor: colInfo.anchor
                })),
            }
        }
    }

    return {
        // headerWidth: rowHeaderWidth,
        header: {
            width: rowHeaderWidth,
            offset: rowHeaderWidth / 2,
            // offset: margin.left + padding.left + leftPadding,
            anchor: "center"    // todo this should be a specified value
        },
        columns: columnWidths
    }
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
    tableInfo: TableDataPlacementInfo,
    tableStyle: Partial<StyledTable>,
    tableHeight: number = 0
): RowHeightInfo {
    const {columnHeaderStyle} = tableStyle
    const {bottom: bottomPadding, top: topPadding} = columnHeaderStyle?.padding ?? {top: 5, bottom: 5}
    const columnHeaderHeight = Math.max(...tableInfo.columnHeaders
        .map(header => header.textHeight + bottomPadding + topPadding)
    )
    // the number of data rows (there may also be a column-header row)
    const numRows = tableInfo.data.length

    // when the min and max row heights are specified, and have the right size, then use
    // them, otherwise, set the default values so that the min and max heights do not come into play
    const rowStyles = tableStyle.rowStyles
    let minMaxHeights = rowStyles?.map(
        row => ({
            minHeight: row.dimension.minHeight,
            maxHeight: row.dimension.maxHeight,
            bottomPadding: row.padding.bottom,
            topPadding: row.padding.top
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
                header: {
                    height: columnHeaderHeight * scale,
                    offset: (columnHeaderHeight - bottomPadding) * scale
                },
                rows: rowHeights.map(rowInfo => ({
                    height: rowInfo.height * scale,
                    offset: rowInfo.offset
                })),
            }
        }
    }

    return {
        // headerHeight: columnHeaderHeight,
        header: {
            height: columnHeaderHeight,
            offset: columnHeaderHeight - bottomPadding,
        },
        rows: rowHeights
    }
}

export function calculateTableCellDimensions(
    tableStyle: Partial<StyledTable>,
    tableInfo: TableDataPlacementInfo,
    tableData: TableData,
): Result<TableDimensions, string> {
    // use width and height if specified and calculate based on that, otherwise, free-form baby
    const tableWidth = tableStyle.dimension?.width ?? Infinity;
    const tableHeight = tableStyle.dimension?.height ?? Infinity;

    return validateTableDimensions(tableStyle, tableData)
        .andThen(() => validateInfoDimensions(tableInfo))
        .map(() => {
            const rowInfo = calculateRowMaxHeights(tableInfo, tableStyle, tableHeight)
            const columnInfo = calculateColumnMaxWidths(tableInfo, tableStyle, tableWidth)
            const totalWidth = columnInfo.header.width + columnInfo.columns.reduce((sum, colInfo) => sum + colInfo.width + colInfo.offset, 0);
            const totalHeight = rowInfo.header.height + rowInfo.rows.reduce((sum, rInfo) => sum + rInfo.height + rInfo.offset, 0);

            return {
                width: isFinite(tableWidth) ? totalWidth : totalWidth,
                height: isFinite(tableHeight) ? tableHeight : totalHeight,
                rows: rowInfo,
                columns: columnInfo
            }
        })
}

export type TableSelection = d3.Selection<SVGGElement, any, null, undefined>
export type TableElementSelection =  d3.Selection<SVGTextElement, any, null, undefined>

export type TableInfo = {
    rowHeaders: Array<ElementPlacementInfo>,
    columnHeaders: Array<ElementPlacementInfo>,
    data: Array<Array<ElementPlacementInfo>>
}


/**
 * Sets the (x, y) coordinates for each text element in the table based on the row widths,
 * column heights, and the text offset and anchor
 * @param tableInfo
 * @param tableSelection
 * @param tableDimensions
 */
export function placeTableCellsRelativeToTable(
    tableInfo: Array<Array<ElementPlacementInfo>>,
    tableSelection: TableSelection,
    tableDimensions: TableDimensions
): Result<TableSelection, string> {
    const {rows, columns} = tableDimensions
    const {rows: rowInfos} = rows
    const {columns: columnInfos} = columns

    let currentRowY = 0
    const hasColumnHeaders = tableInfo.length > rowInfos.length
    for(let rowIndex = 0; rowIndex < tableInfo.length; rowIndex++) {
        // holds the x-coordinate of the current left border of the table column
        let currentColumnX = 0;

        // when there are column headers, row 0 in the tableInfo represents a header,
        // and so the index into the rowInfos is the rowIndex - 1
        const rowIndexOffset = hasColumnHeaders ? -1 : 0

        // holds the y-coordinate of the bottom of the current table row
        currentRowY += (hasColumnHeaders && rowIndex === 0) ? rows.header.height : rowInfos[rowIndex + rowIndexOffset].height
        const rowY = currentRowY

        const hasRowHeaders = tableInfo[rowIndex].length > columnInfos.length
        for (let columnIndex = 0; columnIndex < tableInfo[rowIndex].length; columnIndex++) {

            // when there are row headers, column 0 in the tableInfo represents a header,
            // and so the index in to the columnInfos is the columnIndex - 1
            const columnIndexOffset = hasRowHeaders ? -1 : 0

            currentColumnX += (hasRowHeaders && columnIndex === 0) ? columns.header.width : columnInfos[columnIndex + columnIndexOffset].width
            const columnX = currentColumnX
            tableInfo[rowIndex][columnIndex].selection
                .attr('anchor', (hasRowHeaders && columnIndex === 0) ? columns.header.anchor : columnInfos[columnIndex + columnIndexOffset].anchor)
                .attr('x', () => (hasRowHeaders && columnIndex === 0) ? columns.header.offset : columnInfos[columnIndex + columnIndexOffset].offset + columnX)
                .attr('y', () => (hasColumnHeaders && rowIndex === 0) ? rows.header.offset : rowInfos[rowIndex + rowIndexOffset].offset + rowY)
                // todo need to have the text alignment here, create or use a mapping function, get all the offset
                //   correct for the alignments
                // .attr('text-anchor', () => (hasColumnHeaders && rowIndex === 0) ? "start" : "end")
        }
    }

    return successResult(tableSelection)
}

export function translateTableToTooltipLocation(
    tableSelection: TableSelection,
    coordinates: [x: number, y: number]
): void {
    const [x, y] = coordinates
    tableSelection.attr('transform', `translate(${x}, ${y})`)   // use the tooltipX and tooltipY functions as reference
}

export const defaultTableFont: TableFont = {
    size: 13,
    color: '#d2933f',
    family: 'sans-serif',
    weight: 250,
}

export function headerTableFontFrom(tableFont: TableFont): TableFont {
    return {
        size: tableFont.size + 1,
        color: tableFont.color,
        family: tableFont.family,
        weight: tableFont.weight + 550,
    }
}

export const defaultHeaderTableFont: TableFont = headerTableFontFrom(defaultTableFont)

export const defaultTableBackground: Background = {
    color: '#202020',
    opacity: 0.8,
}

export function headerTableBackground(tableBackground: Background): Background {
    return {
        color: tableBackground.color,
        opacity: tableBackground.opacity,
    }
}

export const defaultHeaderTableBackground: Background = headerTableBackground(defaultTableBackground)

export function tableStyleFrom(tooltipStyle: TooltipStyle): StyledTable {
    const tableFont: TableFont = {
        family: tooltipStyle.fontFamily,
        color: tooltipStyle.fontColor,
        size: tooltipStyle.fontSize,
        weight: tooltipStyle.fontWeight
    }

    const tableBackground: Background = {
        color: tooltipStyle.backgroundColor,
        opacity: tooltipStyle.backgroundOpacity,
    }

    const tablePadding: Padding = {
        left: tooltipStyle.paddingLeft,
        right: tooltipStyle.paddingRight,
        top: tooltipStyle.paddingTop,
        bottom: tooltipStyle.paddingBottom
    }

    return {
        font: tableFont,
        background: tableBackground,
        border: {
            color: tooltipStyle.borderColor,
            opacity: tooltipStyle.borderOpacity,
            width: tooltipStyle.borderWidth,
            radius: tooltipStyle.borderRadius
        },
        dimension: {width: Infinity, height: Infinity},
        padding: tablePadding,
        margin: {left: 0, right: 0, top: 0, bottom: 0},

        rowHeaderStyle: {font: tableFont, background: tableBackground, dimension: {width: 0}, padding: {left: 0, right: 0}, alignText: "center"},
        columnHeaderStyle: {font: tableFont, background: tableBackground, dimension: {height: 0}, padding: {bottom: 0, top: 0}, alignText: "center"},

        rowStyles: [],
        columnStyles: []
    }
}