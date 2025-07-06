import {DataFrame, Tag, TagCoordinate, TagValue} from "data-frame-ts";
import {failureResult, Result, successResult} from "result-fn";
import {Index, indexFrom} from "data-frame-ts/dist/DataFrame";

/*
 | formatting
 */

/**
 * Type representing a formatter function
 */
export type Formatter<D> = (value: D) => string

/**
 * Default formatter that converts a {@link value} of type `V` to a string
 * @param value The value to convert
 * @return a string representation of the {@link value}
 */
export function defaultFormatter<D>(value: D): string {
    return value === undefined || value === null ? '' : `${value}`
}

export type Formatting<V> = {
    formatter: Formatter<V>,
    priority: number
}

export function defaultFormatting<D>(): Formatting<D> {
    return {
        formatter: defaultFormatter<D>,
        priority: 0
    }
}

export enum TableFormatter {
    CELL = "cell-formatter",
    COLUMN = "column-formatter",
    ROW = "row-formatter"
}

export function isFormattingTag(tag: Tag<TagValue, TagCoordinate>): boolean {
    return (tag.name === TableFormatter.COLUMN ||
            tag.name === TableFormatter.ROW ||
            tag.name === TableFormatter.CELL) &&
        tag.value.hasOwnProperty("formatter") &&
        tag.value.hasOwnProperty("priority")
}


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

/**
 * Factory function to create table data.
 */
export function createTableData<V>(data: DataFrame<V>): TableData<V> {
    return new TableData<V>(data)
}

/**
 * Represents the table data, row and column headers, and footers
 */
export class TableData<V> {
    /**
     * The matrix of data, including row, column headers, and footers, if they exist
     */
    constructor(private readonly dataFrame: DataFrame<V>) {
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
            .flatMap(df => df.tagRow<Formatting<V>>(0, TableFormatter.ROW, formatting))
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
            .flatMap(df => df.tagColumn<Formatting<V>>(0, TableFormatter.COLUMN, formatting))
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
            .flatMap(df => df.tagColumn<Formatting<V>>(0, TableFormatter.ROW, formatting))
            // convert it to the row-header builder
            .map(df => new TableData<V>(df))
    }

    hasColumnHeader(): boolean {
        return this.dataFrame.rowTagsFor(0).some(tag => tag.value === TableTagType.COLUMN_HEADER)
    }

    hasRowHeader(): boolean {
        return this.dataFrame.columnTagsFor(0).some(tag => tag.value === TableTagType.ROW_HEADER)
    }

    hasFooter(): boolean {
        return this.dataFrame.rowTagsFor(this.dataFrame.rowCount() - 1).some(tag => tag.value === TableTagType.FOOTER)
    }

    dataRowCount(): number {
        return this.dataFrame.rowCount() - (this.hasColumnHeader() ? 1 : 0) - (this.hasFooter() ? 1 : 0)
    }

    dataColumnCount(): number {
        return this.dataFrame.columnCount() - (this.hasRowHeader() ? 1 : 0)
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
     * Formatters convert the column value types to formatted strings. The formatter used to format a given
     * cell depends on the priority of each formatter associated with that cell. The formatter with the
     * highest priority is used. If two or more formatters for a given cell have the same priority, the selected
     * formatter is indeterminant.
     * @param columnIndex The index of the column to which to add the formatter
     * @param formatter The formatter
     * @param [priority = 0] The priority of this formatter. If cells have more than one associated formatter,
     * the one with the highest priority number is used.
     */
    addColumnFormatter(columnIndex: number, formatter: Formatter<V>, priority: number = 0): Result<TableData<V>, string> {
        return this.dataFrame
            .tagColumn<Formatting<V>>(columnIndex, TableFormatter.COLUMN, {formatter, priority})
            .map(data => new TableData<V>(data))
    }

    addRowFormatter(rowIndex: number, formatter: Formatter<V>, priority: number = 0): Result<TableData<V>, string> {
        return this.dataFrame
            .tagRow<Formatting<V>>(rowIndex, TableFormatter.ROW, {formatter, priority})
            .map(data => new TableData<V>(data))
    }

    addCellFormatter(rowIndex: number, columnIndex: number, formatter: Formatter<V>, priority: number = 0): Result<TableData<V>, string> {
        return this.dataFrame
            .tagCell(rowIndex, columnIndex, TableFormatter.CELL, {formatter, priority})
            .map(data => new TableData<V>(data))
    }

    /**
     * Formats the table headers, footer, and values using the formatters that have been added
     * to this `TableData<V>` object and returns a new `TableData<string>` object where all the
     * elements have been converted to a formatted string.
     * @return a new `TableData<string>` object where all the elements have been converted to a
     * formatted string.
     * @example
     * ```typescript
     * function dateTimeFor(day: number, hour: number): Date {
     *   return new Date(2021, 1, day, hour, 0, 0, 0);
     * }
     *
     * // the headers for the table
     * const columnHeader = ['Date-Time', 'Customer ID', 'Product ID', 'Purchase Price', 'Amount']
     * const rowHeader = [1, 2, 3, 4]
     *
     * // this is the actual data used to creat the data table (in row-form)
     * const data = DataFrame.from<string | number | Date>([
     *     [dateTimeFor(1, 1), 12345, 'gnm-f234', 123.45,  4],
     *     [dateTimeFor(2, 2), 23456, 'gnm-g234',  23.45,  5],
     *     [dateTimeFor(3, 3), 34567, 'gnm-h234',   3.65, 40],
     *     [dateTimeFor(4, 4), 45678, 'gnm-i234', 314.15,  9],
     * ]).getOrThrow()
     *
     * // this is what we expect that formatted data to look like
     * const expectedData = DataFrame.from<string>([
     *     ['2/1/2021', '12345', 'gnm-f234', '$ 123.45',  '4'],
     *     ['2/2/2021', '23456', 'gnm-g234',  '$ 23.45',  '5'],
     *     ['2/3/2021', '34567', 'gnm-h234',   '$ 3.65', '40'],
     *     ['2/4/2021', '45678', 'gnm-i234', '$ 314.15',  '9'],
     * ]).getOrThrow()
     *
     * // 1. create a data-table that has a column-header and a row-header and mixed-type
     * //    data (number, string, Date)
     * // 2. add formatters for the row and column headers (at highest priority)
     * // 3. add formatters for some of the other data columns
     * // 4. format the table
     * const tableData = createTableData<string | number | Date>(data)
     *     .withColumnHeader(columnHeader)
     *     .flatMap(table => table.withRowHeader(rowHeader))
     *     // add the default formatter for the column header, at the highest priority so that
     *     // it is the one that applies to the row representing the column header
     *     .flatMap(td => td.addRowFormatter(0, defaultFormatter, Infinity))
     *     // add the default formatter for the row header, at the highest priority so that
     *     // it is the one that applies to the column representing the row header
     *     .flatMap(td => td.addColumnFormatter(0, defaultFormatter, Infinity))
     *     // add the column formatters for each column at the default (lowest) priority
     *     // (notice that the columns are shifted by one for the columns because the row-header
     *     // occupies the first column (index=0))
     *     .flatMap(td => td.addColumnFormatter(1, value => (value as Date).toLocaleDateString()))
     *     .flatMap(td => td.addColumnFormatter(2, value => defaultFormatter(value)))
     *     .flatMap(td => td.addColumnFormatter(4, value => `$ ${(value as number).toFixed(2)}`))
     *     .flatMap(td => td.addColumnFormatter(5, value => `${(value as number).toFixed(0)}`))
     *     // format the table data and get back a TableData<string>
     *     .map(td => td.formatTable())
     *     .getOrThrow()
     *
     * // the column header of the formatted table should be the same as the one specified
     * expect(tableData.columnHeader().getOrThrow()).toEqual(columnHeader)
     *
     * // the row header of the formatted table should be the same as the one specified
     * expect(tableData.rowHeader().getOrThrow()).toEqual(rowHeader.map(hdr => defaultFormatter(hdr)))
     *
     * // the data should be equal to the expected data
     * expect(tableData.data().map(df => df.equals(expectedData)).getOrThrow()).toBeTruthy()
     * ```
     */
    formatTable<C extends TagCoordinate>(): Result<TableData<string>, string> {
        const formattingFailures: Array<string> = []
        const formattedDataFrame = this.dataFrame
            .mapElements<string>((elem, row, col) => {
                const tags = this.dataFrame
                    .tagsFor(row, col)
                    .filter(tag => isFormattingTag(tag)) as Array<Tag<Formatting<V>, C>>
                const sorted = tags
                    .sort((t1: Tag<Formatting<V>, C>, t2: Tag<Formatting<V>, C>) => t2.value.priority - t1.value.priority)
                if (sorted.length > 0) {
                    const formatter = sorted[0].value.formatter
                    try {
                        return formatter(elem)
                    } catch (e) {
                        formattingFailures.push(
                            `(TableData::formatTable) Failed to format cell (${row}, ${col}); value: ${elem}; error: ${e}`
                        )
                    }
                }
                return defaultFormatter<V>(elem)
            })
        if (formattingFailures.length === 0) {
            return successResult(createTableData<string>(formattedDataFrame))
        }
        return failureResult(formattingFailures.concat('').join('\n'))
    }
}
