import {DataFrame} from "data-frame-ts";
import {failureResult, Result} from "result-fn";
import {indexFrom} from "data-frame-ts/dist/DataFrame";
import {index} from "d3";

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
    COLUMN_HEADER = "column-header-formatter",
    ROW_HEADER = "row-header-formatter",
    FOOTER = "footer-formatter"
}

/**
 * Represents the table data, row and column headers, and footers
 */
export class TableData<V> {
    /**
     * The matrix of data, including row, column headers, and footers, if they exist
     */
    constructor(private readonly data: DataFrame<V>) {}

    hasColumnHeader(): boolean {
        return this.data.rowTagsFor(0).some(tag => tag.value === TableTagType.COLUMN_HEADER)
    }

    hasRowHeader(): boolean {
        return this.data.columnTagsFor(0).some(tag => tag.value === TableTagType.ROW_HEADER)
    }

    hasFooter(): boolean {
        return this.data.rowTagsFor(this.data.rowCount() - 1).some(tag => tag.value === TableTagType.FOOTER)
    }

    dataRowCount(): number {
        return this.data.rowCount() - (this.hasColumnHeader() ? 1 : 0) - (this.hasFooter() ? 1 : 0)
    }

    dataColumnCount(): number {
        return this.data.columnCount() - (this.hasRowHeader() ? 1 : 0)
    }

    tableRowCount(): number {
        return this.data.rowCount()
    }

    tableColumnCount(): number {
        return this.data.columnCount()
    }

    getColumnHeader(): Result<Array<V>, string> {
        if (this.hasColumnHeader()) {
            const startColumn = this.hasRowHeader() ? 1 : 0
            return this.data.rowSlice(0).map(row => row.slice(startColumn))
        }
        return failureResult("(TableData::columnHeader) No column header")
    }

    getRowHeader(): Result<Array<V>, string> {
        if (this.hasRowHeader()) {
            const startRow = this.hasColumnHeader() ? 1 : 0
            const endRow = this.hasFooter() ? this.data.rowCount() - 1 : this.data.rowCount()
            return this.data.columnSlice(0).map(row => row.slice(startRow, endRow))
        }
        return failureResult("(TableData::rowHeader) No row header")
    }

    getFooter(): Result<Array<V>, string> {
        if (this.hasFooter()) {
            const startColumn = this.hasRowHeader() ? 1 : 0
            return this.data.rowSlice(this.data.rowCount() - 1).map(row => row.slice(startColumn))
        }
        return failureResult("(TableData::footer) No footer")
    }

    getData(): Result<DataFrame<V>, string> {
        const startRow = this.hasColumnHeader() ? 1 : 0
        const endRow = this.hasFooter() ? this.data.rowCount() - 2 : this.data.rowCount() - 1
        const startColumn = this.hasRowHeader() ? 1 : 0
        return this.data.subFrame(indexFrom(startRow, startColumn), indexFrom(endRow, this.data.columnCount() - 1))
    }
}

/**
 * Entry point for the builder to create table data. From here, you can specify the
 * header information, then the data, and then the footers.
 */
export function createTableData<V>(data: DataFrame<V>): TableDataColumnHeaderBuilder<V> {
    return new TableDataColumnHeaderBuilder<V>(data)
}

/**
 * The second step in the guide build for creating the {@link TableData} object. This builder
 * step allows the developer to specify whether to use column headers. As a convenience, the developer
 * can also specify their desire not to use any headers.
 */
class TableDataColumnHeaderBuilder<V> {

    constructor(private readonly data: DataFrame<V>) {
    }

    // todo use the column-header formatter in the last "format" step
    /**
     * Would like to use a column-header where each element in the column-header is the name of the column.
     * Note that the specified column {@link header} determines the number of data columns in the table. This
     * means that you must specify a header for each data column. No need to account for a possible column
     * containing row-headers. The builder will take care of any adjustments needed for that.
     * @param header An array describing the columns in the table.
     * @param formatter The formatter for the row that represents the column-header. Note that the column
     * header should not account for a possible column containing row-headers. The builder will take care
     * of any adjustments needed for that.
     * @return A {@link TableDataRowHeaderBuilder} which represents the next step in the guided builder
     */
    public withColumnHeader(header: Array<V>, formatter: Formatter<V> = defaultFormatter<V>): TableDataFooterBuilder<V> {
        return this.data
            .insertRowBefore(0, header)
            .flatMap(df => df.tagRow(0, "column-header", TableTagType.COLUMN_HEADER))
            .flatMap(df => df.tagRow<Formatter<V>>(0, TableFormatter.COLUMN_HEADER, formatter))
            .map(df => new TableDataFooterBuilder<V>(df))
            .getOrThrow()
    }

    public withoutHeaders(): TableDataFooterBuilder<V> {
        return new TableDataFooterBuilder<V>(this.data.copy())
    }
}

/**
 * This is the next step in the
 */
class TableDataRowHeaderBuilder<V> {

    constructor(private readonly data: DataFrame<V>) {
    }

    public withRowHeader(header: Array<V>, formatter: Formatter<V> = defaultFormatter<V>): TableData<V> {
        // when the there is a row-header and/or footer, we adjust the (row) header by adding
        // empty elements so that the length of the (row) header matches the number of rows,
        // including the column header and the footer
        const updatedHeader = header.slice()
        // recall that a column-header is a row, specifically the first row
        if (this.data.rowTagsFor(0).some(tag => tag.value === TableTagType.COLUMN_HEADER)) {
            updatedHeader.unshift(undefined as V)
        }
        if (this.data.rowTagsFor(this.data.rowCount() - 1).some(tag => tag.value === TableTagType.FOOTER)) {
            updatedHeader.push(undefined as V)
        }
        return this.data
            // insert the updated header as the first column of the data-frame
            .insertColumnBefore(0, updatedHeader)
            // tag the column as the row header, and as having the formatter
            .flatMap(df => df.tagColumn(0, "row-header", TableTagType.ROW_HEADER))
            .flatMap(df => df.tagColumn<Formatter<V>>(0, TableFormatter.ROW_HEADER, formatter))
            .map(df => new TableData<V>(df))
            .getOrThrow()
    }

    public withoutRowHeader(): TableData<V> {
        return new TableData<V>(this.data)
    }

}

/**
 *
 */
class TableDataFooterBuilder<V> {

    /**
     *
     */
    constructor(private readonly data: DataFrame<V>) {
    }

    /**
     *
     */
    public withoutFooter(): TableDataRowHeaderBuilder<V> {
        return new TableDataRowHeaderBuilder<V>(this.data)
    }

    public withFooter(footer: Array<V>, formatter: Formatter<V> = defaultFormatter<V>): TableDataRowHeaderBuilder<V> {
        return this.data
            // add the foot row to the end
            .pushRow(footer)
            // tag the row as a footer and tag the formatter for the footer
            .flatMap(df => df.tagRow(df.rowCount() - 1, "footer", TableTagType.FOOTER))
            .flatMap(df => df.tagColumn<Formatter<V>>(0, TableFormatter.FOOTER, formatter))
            // convert it to the row-header builder
            .map(df => new TableDataRowHeaderBuilder<V>(df))
            // unwrap
            .getOrThrow()
    }
}
