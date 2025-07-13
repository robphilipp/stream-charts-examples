import {DataFrame} from "data-frame-ts";
import {failureResult, Result} from "result-fn";
import {indexFrom} from "data-frame-ts/dist/DataFrame";
import {defaultFormatting, Formatting, TableFormatterType} from "./tableFormatter";

/**
 * Represents a row
 */
export type Row<V> = Array<V>

/**
 * The types of tags the {@link TableData} supports
 */
export enum TableTagType {
    COLUMN_HEADER = "column-header",
    ROW_HEADER = "row-header",
    FOOTER = "footer"
}

// /**
//  * Factory function to create table data.
//  */
// export function createTableData<V>(data: DataFrame<V>): TableData<V> {
//     return new TableData<V>(data)
// }

/**
 * Represents the table data, row and column headers, and footers
 */
export class TableData<V> {
    /**
     * The matrix of data, including row, column headers, and footers, if they exist
     */
    private constructor(private readonly dataFrame: DataFrame<V>) {
    }

    static fromDataFrame<V>(dataFrame: DataFrame<V>): TableData<V> {
        return new TableData<V>(dataFrame.copy())
    }

    /**
     * Adds a column-header where each element in the column-header is the name of the column.
     * Note that the specified column {@link header} determines the number of data columns in the table. This
     * means that you must specify a header for each data column. No need to account for a possible column
     * containing row-headers. The builder will take care of any adjustments needed for that.
     * @param header An array describing the columns in the table.
     * @param formatting The formatter, and its priority, for the row that represents the column-header. Note that the column
     * header should not account for a possible column containing row-headers. The builder will take care
     * of any adjustments needed for that.
     * @return A {@link TableData} which represents the next step in the guided builder
     */
    public withColumnHeader(header: Array<V>, formatting: Formatting<V> = defaultFormatting<V>()): Result<TableData<V>, string> {
        // when a row header has already been applied, then the table has grown by one column,
        // and so we need to insert an empty cell at the beginning of the column header
        const updatedHeader = header.slice()
        if (this.dataFrame.columnTagsFor(0).some(tag => tag.value === TableTagType.ROW_HEADER)) {
            updatedHeader.unshift(undefined as V)
        }

        return this.dataFrame
            .insertRowBefore(0, updatedHeader)
            .flatMap(df => df.tagRow(0, "column-header", TableTagType.COLUMN_HEADER))
            .flatMap(df => df.tagRow<Formatting<V>>(0, TableFormatterType.ROW, formatting))
            .map(df => new TableData<V>(df))
    }

    public withRowHeader(header: Array<V>, formatting: Formatting<V> = defaultFormatting<V>()): Result<TableData<V>, string> {
        // when there is a column-header and/or footer, we adjust the (row) header by adding
        // empty elements so that the length of the (row) header matches the number of rows,
        // including the column header and the footer
        const updatedHeader = header.slice()
        // recall that a column-header is a row, specifically the first row
        if (this.dataFrame.rowTagsFor(0).some(tag => tag.value === TableTagType.COLUMN_HEADER)) {
            updatedHeader.unshift(undefined as V)
        }
        if (this.dataFrame.rowTagsFor(this.dataFrame.rowCount() - 1).some(tag => tag.value === TableTagType.FOOTER)) {
            updatedHeader.push(undefined as V)
        }

        return this.dataFrame
            // insert the updated header as the first column of the data-frame
            .insertColumnBefore(0, updatedHeader)
            // tag the column as the row header, and as having the formatter
            .flatMap(df => df.tagColumn(0, "row-header", TableTagType.ROW_HEADER))
            .flatMap(df => df.tagColumn<Formatting<V>>(0, TableFormatterType.COLUMN, formatting))
            .map(df => new TableData<V>(df))
    }

    public withFooter(footer: Array<V>, formatting: Formatting<V> = defaultFormatting<V>()): Result<TableData<V>, string> {
        // when a row header has already been applied, then the table has grown by one column,
        // and so we need to insert an empty cell at the beginning of the footer
        const updatedFooter = footer.slice()
        if (this.dataFrame.columnTagsFor(0).some(tag => tag.value === TableTagType.ROW_HEADER)) {
            updatedFooter.unshift(undefined as V)
        }
        return this.dataFrame
            // add the foot row to the end
            .pushRow(updatedFooter)
            // tag the row as a footer and tag the formatter for the footer
            .flatMap(df => df.tagRow(df.rowCount() - 1, "footer", TableTagType.FOOTER))
            .flatMap(df => df.tagColumn<Formatting<V>>(0, TableFormatterType.ROW, formatting))
            // convert it to the row-header builder
            .map(df => new TableData<V>(df))
    }

    static hasColumnHeader<V>(dataFrame: DataFrame<V>): boolean {
        return dataFrame.rowTagsFor(0).some(tag => tag.value === TableTagType.COLUMN_HEADER)
    }

    static hasRowHeader<V>(dataFrame: DataFrame<V>): boolean {
        return dataFrame.columnTagsFor(0).some(tag => tag.value === TableTagType.ROW_HEADER)
    }

    static hasFooter<V>(dataFrame: DataFrame<V>): boolean {
        return dataFrame.rowTagsFor(dataFrame.rowCount() - 1).some(tag => tag.value === TableTagType.FOOTER)
    }

    static dataRowCount<V>(dataFrame: DataFrame<V>): number {
        return dataFrame.rowCount() - (TableData.hasColumnHeader(dataFrame) ? 1 : 0) - (TableData.hasFooter(dataFrame) ? 1 : 0)
    }

    static dataColumnCount<V>(dataFrame: DataFrame<V>): number {
        return dataFrame.columnCount() - (TableData.hasRowHeader(dataFrame) ? 1 : 0)
    }

    static tableRowCount<V>(dataFrame: DataFrame<V>): number {
        return dataFrame.rowCount()
    }

    static tableColumnCount<V>(dataFrame: DataFrame<V>): number {
        return dataFrame.columnCount()
    }

    hasColumnHeader(): boolean {
        // return this.dataFrame.rowTagsFor(0).some(tag => tag.value === TableTagType.COLUMN_HEADER)
        return TableData.hasColumnHeader(this.dataFrame)
    }

    hasRowHeader(): boolean {
        // return this.dataFrame.columnTagsFor(0).some(tag => tag.value === TableTagType.ROW_HEADER)
        return TableData.hasRowHeader(this.dataFrame)
    }

    hasFooter(): boolean {
        // return this.dataFrame.rowTagsFor(this.dataFrame.rowCount() - 1).some(tag => tag.value === TableTagType.FOOTER)
        return TableData.hasFooter(this.dataFrame)
    }

    dataRowCount(): number {
        // return this.dataFrame.rowCount() - (this.hasColumnHeader() ? 1 : 0) - (this.hasFooter() ? 1 : 0)
        return TableData.dataRowCount(this.dataFrame)
    }

    dataColumnCount(): number {
        // return this.dataFrame.columnCount() - (this.hasRowHeader() ? 1 : 0)
        return TableData.dataColumnCount(this.dataFrame)
    }

    tableRowCount(): number {
        return this.dataFrame.rowCount()
    }

    tableColumnCount(): number {
        return this.dataFrame.columnCount()
    }

    /**
     * @return A {@link Result} holding the column header if it exists; or a failure if no column-header exists
     * @example
     * ```typescript
     * const columnHeader = ['A', 'B', 'C', 'D', 'E']
     * const rowHeader = ['one', 'two', 'three', 'four']
     * const footer = ['a10', 'b10', 'c10', 'd10', 'e10']
     * const data = DataFrame.from([
     *     ['a1', 'b1', 'c1', 'd1', 'e1'],
     *     ['a2', 'b2', 'c2', 'd2', 'e2'],
     *     ['a3', 'b3', 'c3', 'd3', 'e3'],
     *     ['a4', 'b4', 'c4', 'd4', 'e4'],
     * ]).getOrThrow()
     *
     * // create a data-table with a column-header, row-header, footer, and data
     * const tableData = createTableData<string>(data)
     *     .withColumnHeader(columnHeader)
     *     .flatMap(table => table.withRowHeader(rowHeader))
     *     .flatMap(table => table.withFooter(footer))
     *     .getOrThrow()
     *
     * // the column-header retrieved from the table-data should equal the column-header originally set
     * expect(tableData.columnHeader().getOrThrow().equals(columnHeader)).toBeTruthy()
     * ```     */
    columnHeader(): Result<Array<V>, string> {
        if (this.hasColumnHeader()) {
            const startColumn = this.hasRowHeader() ? 1 : 0
            return this.dataFrame
                .rowSlice(0)
                .map(row => row.slice(startColumn))
                .mapFailure(err => "(TableData::columnHeader) Failed to retrieve column-header.\n" + err)
        }
        return failureResult("(TableData::columnHeader) Failed to retrieve the column-header because no column header exists.")
    }

    /**
     * @return A {@link Result} holding the row-header if it exists; or a failure if no row-header exists
     * @example
     * ```typescript
     * const columnHeader = ['A', 'B', 'C', 'D', 'E']
     * const rowHeader = ['one', 'two', 'three', 'four']
     * const footer = ['a10', 'b10', 'c10', 'd10', 'e10']
     * const data = DataFrame.from([
     *     ['a1', 'b1', 'c1', 'd1', 'e1'],
     *     ['a2', 'b2', 'c2', 'd2', 'e2'],
     *     ['a3', 'b3', 'c3', 'd3', 'e3'],
     *     ['a4', 'b4', 'c4', 'd4', 'e4'],
     * ]).getOrThrow()
     *
     * // create a data-table with a column-header, row-header, footer, and data
     * const tableData = createTableData<string>(data)
     *     .withColumnHeader(columnHeader)
     *     .flatMap(table => table.withRowHeader(rowHeader))
     *     .flatMap(table => table.withFooter(footer))
     *     .getOrThrow()
     *
     * // the row-header retrieved from the table-data should equal the row-header originally set
     * expect(tableData.rowHeader().getOrThrow().equals(rowHeader)).toBeTruthy()
     * ```     */
    rowHeader(): Result<Array<V>, string> {
        if (this.hasRowHeader()) {
            const startRow = this.hasColumnHeader() ? 1 : 0
            const endRow = this.hasFooter() ? this.dataFrame.rowCount() - 1 : this.dataFrame.rowCount()
            return this.dataFrame
                .columnSlice(0)
                .map(row => row.slice(startRow, endRow))
                .mapFailure(err => "(TableData::rowHeader) Failed to retrieve row-header.\n" + err)
        }
        return failureResult("(TableData::rowHeader) Failed to retrieve the row-header because no row header exists.")
    }

    /**
     * @return A {@link Result} holding the footer, if exists; or a failure if no footer exists
     * @example
     * ```typescript
     * const columnHeader = ['A', 'B', 'C', 'D', 'E']
     * const rowHeader = ['one', 'two', 'three', 'four']
     * const footer = ['a10', 'b10', 'c10', 'd10', 'e10']
     * const data = DataFrame.from([
     *     ['a1', 'b1', 'c1', 'd1', 'e1'],
     *     ['a2', 'b2', 'c2', 'd2', 'e2'],
     *     ['a3', 'b3', 'c3', 'd3', 'e3'],
     *     ['a4', 'b4', 'c4', 'd4', 'e4'],
     * ]).getOrThrow()
     *
     * // create a data-table with a column-header, row-header, footer, and data
     * const tableData = createTableData<string>(data)
     *     .withColumnHeader(columnHeader)
     *     .flatMap(table => table.withRowHeader(rowHeader))
     *     .flatMap(table => table.withFooter(footer))
     *     .getOrThrow()
     *
     * // the footer retrieved from the table-data should equal the footer originally set
     * expect(tableData.footer().getOrThrow().equals(footer)).toBeTruthy()
     * ```
     */
    footer(): Result<Array<V>, string> {
        if (this.hasFooter()) {
            const startColumn = this.hasRowHeader() ? 1 : 0
            return this.dataFrame
                .rowSlice(this.dataFrame.rowCount() - 1)
                .map(row => row.slice(startColumn))
                .mapFailure(err => "(TableData::footer) Failed to retrieve footer.\n" + err)
        }
        return failureResult("(TableData::footer) Failed to retrieve the footer because no footer exists.")
    }

    /**
     * Retrieves the "data" from the data-table. This excludes any column headers, row-headers, and footers.
     * @return A {@link Result} holding a {@link DataFrame} with the "data" from the data-table. This excludes any
     * column headers, row-headers, and footers.
     * @example
     * ```typescript
     * const columnHeader = ['A', 'B', 'C', 'D', 'E']
     * const rowHeader = ['one', 'two', 'three', 'four']
     * const footer = ['a10', 'b10', 'c10', 'd10', 'e10']
     * const data = DataFrame.from([
     *     ['a1', 'b1', 'c1', 'd1', 'e1'],
     *     ['a2', 'b2', 'c2', 'd2', 'e2'],
     *     ['a3', 'b3', 'c3', 'd3', 'e3'],
     *     ['a4', 'b4', 'c4', 'd4', 'e4'],
     * ]).getOrThrow()
     *
     * // create a data-table with a column-header, row-header, footer, and data
     * const tableData = createTableData<string>(data)
     *     .withColumnHeader(columnHeader)
     *     .flatMap(table => table.withRowHeader(rowHeader))
     *     .flatMap(table => table.withFooter(footer))
     *     .getOrThrow()
     *
     * // the data retrieved from the table-data should equal the data originally set
     * expect(tableData.data().getOrThrow().equals(data)).toBeTruthy()
     * ```
     */
    data(): Result<DataFrame<V>, string> {
        const startRow = this.hasColumnHeader() ? 1 : 0
        const endRow = this.hasFooter() ? this.dataFrame.rowCount() - 2 : this.dataFrame.rowCount() - 1
        const startColumn = this.hasRowHeader() ? 1 : 0
        return this.dataFrame
            .subFrame(indexFrom(startRow, startColumn), indexFrom(endRow, this.dataFrame.columnCount() - 1))
            .mapFailure(err => "(TableData::data) Failed to retrieve data.\n" + err)
    }

    /**
     * @return a copy of the {@link DataFrame} that has been prepared by this class.
     */
    unwrapDataFrame(): DataFrame<V> {
        return this.dataFrame.copy()
    }
}
