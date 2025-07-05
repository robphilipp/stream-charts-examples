import {DataFrame} from "data-frame-ts";
import {failureResult, Result} from "result-fn";
import {indexFrom} from "data-frame-ts/dist/DataFrame";

/**
 * Guided builders for constructing a {@link TableData} object. Supports row-headers and column-headers
 * as tags on the underlying {@link DataFrame}.
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

export enum TableFormatter {
    // COLUMN_HEADER = "column-header-formatter",
    // ROW_HEADER = "row-header-formatter",
    FOOTER = "footer-formatter",
    COLUMN = "column-formatter",
    ROW = "row-formatter"
}

/**
 * Entry point for the builder to create table data. From here, you can specify the
 * header information, then the data, and then the footers.
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
        if(this.dataFrame.columnTagsFor(0).some(tag => tag.value === TableTagType.ROW_HEADER)) {
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
        if(this.dataFrame.columnTagsFor(0).some(tag => tag.value === TableTagType.ROW_HEADER)) {
            updatedFooter.unshift(undefined as V)
        }
        return this.dataFrame
            // add the foot row to the end
            .pushRow(updatedFooter)
            // tag the row as a footer and tag the formatter for the footer
            .flatMap(df => df.tagRow(df.rowCount() - 1, "footer", TableTagType.FOOTER))
            .flatMap(df => df.tagColumn<Formatting<V>>(0, TableFormatter.FOOTER, formatting))
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

    columnHeader(): Result<Array<V>, string> {
        if (this.hasColumnHeader()) {
            const startColumn = this.hasRowHeader() ? 1 : 0
            return this.dataFrame.rowSlice(0).map(row => row.slice(startColumn))
        }
        return failureResult("(TableData::columnHeader) No column header")
    }

    rowHeader(): Result<Array<V>, string> {
        if (this.hasRowHeader()) {
            const startRow = this.hasColumnHeader() ? 1 : 0
            const endRow = this.hasFooter() ? this.dataFrame.rowCount() - 1 : this.dataFrame.rowCount()
            return this.dataFrame.columnSlice(0).map(row => row.slice(startRow, endRow))
        }
        return failureResult("(TableData::rowHeader) No row header")
    }

    footer(): Result<Array<V>, string> {
        if (this.hasFooter()) {
            const startColumn = this.hasRowHeader() ? 1 : 0
            return this.dataFrame.rowSlice(this.dataFrame.rowCount() - 1).map(row => row.slice(startColumn))
        }
        return failureResult("(TableData::footer) No footer")
    }

    data(): Result<DataFrame<V>, string> {
        const startRow = this.hasColumnHeader() ? 1 : 0
        const endRow = this.hasFooter() ? this.dataFrame.rowCount() - 2 : this.dataFrame.rowCount() - 1
        const startColumn = this.hasRowHeader() ? 1 : 0
        return this.dataFrame.subFrame(indexFrom(startRow, startColumn), indexFrom(endRow, this.dataFrame.columnCount() - 1))
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

    /**
     * Formats the table headers, footer, and values using the formatters that have been added
     * to this `TableData<V>` object and returns a new `TableData<string>` object where all the
     * elements have been converted to a formatted string.
     * @return a new `TableData<string>` object where all the elements have been converted to a
     * formatted string.
     */
    // formatTable(): TableData<string> {
    //
    // }
}
