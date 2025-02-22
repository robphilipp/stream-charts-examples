import {SvgTableView} from "./tableSvg";
import {TextSelection} from "../d3types";
import {SvgTableData} from "./tableData";
import {Option} from "prelude-ts";
import {failureResult, Result, successResult} from "result-fn";

export namespace TableUtils {
    import TableDimensions = SvgTableView.TableDimensions;
    import TableStyle = SvgTableView.TableStyle;
    import TableData = SvgTableData.TableData;
    import ElementInfo = SvgTableView.ElementInfo;
    import TableDataInfo = SvgTableView.TableDataInfo;
    import TableInfo = SvgTableView.TableDataInfo;

    export function textWidthOf(elem: TextSelection): number {
        return elem.node()?.getBBox()?.width || 0
    }

    export function textHeightOf(elem: TextSelection): number {
        return elem.node()?.getBBox()?.height || 0
    }

    export function spacesWidthFor(spaces: number, text: TextSelection): number {
        return spaces * textWidthOf(text) / text.text().length
    }


    /**
     * Checks the dimensions of the table against the number of data rows and columns. Throws an
     * error if the dimensions don't match.
     * @param style The table style holding (width, height, default column-widths, and default row-heights)
     * @param data The table data
     */
    export function areTableDimensionsValid(style: Partial<TableStyle>, data: TableData): boolean {
        //
        // check that the number of rows and columns match the number of data rows and columns
        if (style.rows && style.rows.length > 0 && style.rows.length !== data.numRows) {
            const message = "The number of row-heights specified must equal the number of rows. Cannot render table" +
                `num_row_heights: ${style.rows.length}; num_rows: ${data.numRows}`
            console.error(message)
            return false
        }
        if (style.columns && style.columns.length > 0 && style.columns.length !== data.numColumns) {
            const message = "The number of column-widths specified must equal the number of columns. Cannot render table" +
                `num_column_widths: ${style.columns.length}; num_columns: ${data.numColumns}`
            console.error(message)
            return false
        }

        //
        // check that the pixel dimensions work out when the table width and height are specified
        //
        // when the width is specified, then it must be at least the sum of the min-column widths
        const sumMinimumColumnsWidths = style.columns?.reduce((sum, column) => sum + column.minWidth, 0) || Infinity
        if (style.width && style.width > 0 && style.width < sumMinimumColumnsWidths) {
            const message = "The specified table width is less than the sum of the minimum column widths. Cannot render table" +
                `table_width: ${style.width}; sum_minimum_column_widths: ${sumMinimumColumnsWidths}`
            console.error(message)
            return false
        }

        // when the height is specified, then it must be at least the sum of the min-row heights
        const sumMinimumRowHeights = style.rows?.reduce((sum, row) => sum + row.minHeight, 0) || Infinity
        if (style.height && style.height > 0 && style.height < sumMinimumRowHeights) {
            const message = "The specified table height is less than the sum of the minimum row heights. Cannot render table" +
                `table_height: ${style.height}; sum_minimum_heights: ${sumMinimumRowHeights}`
            console.error(message)
            return false
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
                console.error(message)
                return false
            }
            if (data.hasRowHeaders && style.rowHeaderWidth > 0 && style.width - sumMinimumColumnsWidths < style.rowHeaderWidth) {
                const message = "The sum of the minimum columns widths, plus the row-header width, is greater than the specified table width. " +
                    "Cannot render table. " +
                    `table_width: ${style.width} px; sum_minimum_column_widths: ${sumMinimumColumnsWidths} px; row_header_width: ${style.rowHeaderWidth} px; `
                console.error(message)
                return false
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
                console.error(message)
                return false
            }
            if (data.hasColumnHeaders && style.columnHeaderHeight > 0 && style.height - sumMinimumRowHeights < style.columnHeaderHeight) {
                const message = "The sum of the minimum row heights, plus the column-header height, is greater than the specified table height. " +
                    "Cannot render table. " +
                    `table_height: ${style.height} px; sum_minimum_row_heights: ${sumMinimumRowHeights} px; column_header_height: ${style.columnHeaderHeight} px; `
                console.error(message)
                return false
            }
        }

        // passes all the tests
        return true
    }

    export function areInfoDimensionsValid(tableInfo: TableInfo): boolean {
        const {rowHeaders: rowHeaderInfo, columnHeaders: columnHeaderInfo, data: dataInfo} = tableInfo
        // check that the data-info rows all have the same number of columns
        const numColumns = dataInfo.map(row => row.length)
        const minColumns = Math.min(...numColumns)
        const maxColumns = Math.max(...numColumns)
        if (minColumns !== maxColumns) {
            const message = "Not all the rows have the same number of columns. This is confusing. Cannot render table. " +
                `num_columns: [${numColumns}]]`
            console.error(message)
            return false
        }

        if (rowHeaderInfo.length !== dataInfo.length) {
            const message = "The number of row headers must equal the number of rows. Cannot render table. " +
                `num_row_headers: ${rowHeaderInfo.length}; num_rows: ${dataInfo.length}`
            console.error(message)
            return false
        }

        if (columnHeaderInfo.length !== dataInfo[0].length) {
            const message = "The number of columns headers must equal the number of columns. Cannot render table. " +
                `num_column_headers: ${columnHeaderInfo.length}; num_columns: ${dataInfo[0].length}`
            console.error(message)
            return false
        }
        return true
    }

    /**
     * Checks the dimensions of the table against the number of data rows and columns. Throws an
     * error if the dimensions don't match.
     * @param style The table style holding (width, height, default column-widths, and default row-heights)
     * @param data The table data
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

    export function validateInfoDimensions(tableInfo: TableInfo): Result<string, string> {
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

    type ColumnMaxWidthInfo = {
        header: number
        columns: Array<number>
    }

    type RowMaxHeightInfo = {
        header: number
        rows: Array<number>
    }

    /**
     * Calculates the column widths for each column and the column holding the row headers.
     * The width of each column based on the largest item in the column, and the
     * table style that holds the max and min widths for each column
     * @param tableInfo
     * @param tableStyle
     * @param tableWidth The total width of the table to which to scale the columns. Set to zero or
     * Infinity if you do not wish to scale the columns to the table width
     * @private
     */
    function calculateColumnMaxWidths(
        tableInfo: TableDataInfo,
        tableStyle: Partial<TableStyle>,
        tableWidth: number = 0
    ): ColumnMaxWidthInfo {
        const {rowHeaderLeftPadding = 5, rowHeaderRightPadding = 5} = tableStyle
        const rowHeaderWidth = Math.max(...tableInfo.rowHeaders
            .map(header => header.textWidth + rowHeaderLeftPadding + rowHeaderRightPadding)
        )
        const numColumns = Math.max(...tableInfo.data.map(row => row.length))

        // when the min and max column widths are specified, and have the right size, then use
        // them, otherwise, set default values so that the min and max widths do not come into play
        const columnStyles = tableStyle.columns
        let minMaxWidths = columnStyles?.map(
            col => ({minWidth: col.minWidth, maxWidth: col.maxWidth, leftPadding: col.leftPadding, rightPadding: col.rightPadding}),
        )
        if (columnStyles === undefined || columnStyles.length !== numColumns) {
            minMaxWidths = new Array(numColumns)
            minMaxWidths.fill({minWidth: 0, maxWidth: Infinity, leftPadding: 5, rightPadding: 5})
        }

        // calculate the bounded widths
        const columnWidths = tableInfo.data.reduce(
            (colMax: Array<number>, row: Array<ElementInfo>) => {
                for (let i = 0; i < row.length; ++i) {
                    // cannot be undefined, and has the same number of columns as the rows
                    const {minWidth, maxWidth, leftPadding, rightPadding} = minMaxWidths![i]

                    // bound the width of the column
                    if (row[i].textWidth > colMax[i]) {
                        colMax[i] = Math.min(maxWidth, Math.max(row[i].textWidth + leftPadding + rightPadding, minWidth))
                    }
                }
                return colMax
            },
            new Array<number>(numColumns).map(_ => 0)
        )

        // when the table width has been specified, then scale the column widths to fit
        if (tableWidth > 0 && isFinite(tableWidth)) {
            // calculate the sum of the column widths and scale the columns to fit the table
            const totalWidth = rowHeaderWidth + columnWidths.reduce((sum, width) => sum + width, 0);
            if (totalWidth !== tableWidth) {
                const scale = tableWidth / totalWidth
                return {
                    header: rowHeaderWidth * scale,
                    columns: columnWidths.map(width => width * scale),
                }
            }
        }

        return {header: rowHeaderWidth, columns: columnWidths}
    }

    function calculateRowMaxHeights(
        tableInfo: TableDataInfo,
        tableStyle: Partial<TableStyle>,
        tableHeight: number = 0
    ): RowMaxHeightInfo {
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
            row => ({minHeight: row.minHeight, maxHeight: row.maxHeight, bottomPadding: row.bottomPadding, topPadding: row.topPadding})
        )
        if (rowStyles === undefined || rowStyles.length !== numRows) {
            minMaxHeights = new Array(numRows)
            minMaxHeights.fill({minHeight: 0, maxHeight: Infinity, bottomPadding: 5, topPadding: 5})
        }

        // calculate the bounded heights
        const rowHeights = tableInfo.data.map(row => Math.max(...row.map(elem => elem.textHeight)))

        // when the table height is specified, then scale the rows to fit
        if (tableHeight > 0 && isFinite(tableHeight)) {
            const totalHeight = columnHeaderHeight + rowHeights.reduce((sum, height) => sum + height, 0);
            if (totalHeight !== tableHeight) {
                const scale = tableHeight / totalHeight
                return {
                    header: columnHeaderHeight * scale,
                    rows: rowHeights.map(height => height * scale),
                }
            }
        }

        return {header: 0, rows: []}
    }

    export function calculateTableCellDimensions(
        tableStyle: Partial<TableStyle>,
        tableInfo: TableInfo,
        tableData: TableData,
    ): Result<TableDimensions, string> {
        // use width and height if specified and calculate based on that, otherwise, free-form baby
        const tableWidth = tableStyle.width ?? Infinity;
        const tableHeight = tableStyle.height ?? Infinity;

        return validateTableDimensions(tableStyle, tableData)
            .andThen(() => validateInfoDimensions(tableInfo))
            // calculate the max-widths for each column, including the row-headers (column)
            .map(() => ({
                maxWidths: calculateColumnMaxWidths(tableInfo, tableStyle, tableWidth),
                maxHeights: calculateRowMaxHeights(tableInfo, tableStyle, tableHeight)
            }))
            //
            .andThen(() => failureResult("todo: get rid of this one"))
        // if (!areTableDimensionsValid(tableStyle, tableData)) {
        //     // return Option.none<TableDimensions>()
        //     return failureResult()
        // }
        //
        // if (!areInfoDimensionsValid(tableInfo)) {
        //     // return Option.none<TableDimensions>()
        //     return failureResult()
        // }
        //
        // // find the max column width for each column, for all the rows in the column, including the row headers
        // const {header: headerColumnWidth, columns: dataColumnWidths} = calculateColumnMaxWidths(tableInfo, tableStyle, tableWidth)
        //
        // // find the max row height for each row, for all the columns in the row, including the column headers
        //
        // // calculate the row text-offsets for each column, depending on the text-alignment and padding
        //
        // // calculate the column text-offset, depending on the padding
        //
        // return Option.none<TableDimensions>()
    }
}