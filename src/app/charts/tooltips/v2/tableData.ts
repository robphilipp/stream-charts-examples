/*
 * To build
 */

import {Result, successResult} from "result-fn";
import {DataFrame} from "./DataFrame";

export type Formatter<D> = (value: D) => string
/**
 *
 * @param value
 */
export function defaultFormatter<D>(value: D): string {
    return `${value}`
}

export type Row = Array<any>

export enum TableTagType {
    COLUMN_HEADER = "column-header",
    ROW_HEADER = "row-header",
    // DATA = "data",
    FOOTER = "footer"
}

/**
 * Represents the table data, row and column headers, data formatters,
 */
export interface TableData<V> {
    /**
     * The matrix of data, including row and column headers, if they
     * exist (see {@link hasRowHeaders}, {@link hasColumnHeaders}, {@link numRows}, {@link numColumns})
     */
    readonly data: DataFrame<V>

    readonly hasColumnHeaders: boolean
    readonly hasRowHeaders: boolean
    readonly hasFooter: boolean
}

/**
 * Entry point for the builder to create table data. From here, you can specify the
 * header information, then the data, and then the footers.
 */
export function createTableData<V>(): TableDataColumnHeaderBuilder<V> {
    return new TableDataColumnHeaderBuilder<V>()
}

class TableDataColumnHeaderBuilder<V> {

    /**
     *
     * @param header
     * @param formatter
     */
    public withColumnHeader(header: Array<V>, formatter: Formatter<V> = defaultFormatter<V>): TableDataRowHeaderBuilder<V> {
        return new TableDataRowHeaderBuilder<V>({columnHeader: header, columnHeaderFormatter: formatter})
    }

    /**
     * Create a table-data builder without a header (strange, but ok)
     */
    public withoutHeaders(): TableDataBuilder<V> {
        return new TableDataBuilder({
            columnHeader: [],
            columnHeaderFormatter: defaultFormatter<V>,
            rowHeader: [],
            rowHeaderFormatter: defaultFormatter<V>
        })
    }

    /**
     * Create a table-data builder without a header (strange, but ok)
     */
    public withoutColumnsHeader(): TableDataRowHeaderBuilder<V> {
        return new TableDataRowHeaderBuilder<V>({
            columnHeader: [],
            columnHeaderFormatter: defaultFormatter<V>
        })
    }

}

type ColumnHeaders<V> = {
    columnHeader: Array<V>,
    columnHeaderFormatter: Formatter<V>
}

class TableDataRowHeaderBuilder<V> {
    readonly headers: ColumnHeaders<V>

    /**
     *
     * @param header
     * @param formatter
     */
    constructor(header: ColumnHeaders<V>) {
        this.headers = header
    }

    public withRowHeader(header: Array<V>, formatter: (value: V) => string = defaultFormatter): TableDataBuilder<V> {
        return new TableDataBuilder({...this.headers, rowHeader: header, rowHeaderFormatter: formatter})
    }

    public withoutRowHeader(): TableDataBuilder<V> {
        return new TableDataBuilder({...this.headers, rowHeader: [], rowHeaderFormatter: defaultFormatter})
    }
}

type RowColumnHeaders<V> = ColumnHeaders<V> & {
    rowHeader: Array<V>
    rowHeaderFormatter: Formatter<V>
}

/**
 *
 */
class TableDataBuilder<V> {
    readonly headers: RowColumnHeaders<V>

    /**
     *
     */
    constructor(headers: RowColumnHeaders<V>) {
        this.headers = headers
    }

    /**
     *
     */
    public withData(data: DataFrame<V>, columnFormatters: Array<Formatter<V>> = []): TableDataFooterBuilder<V> {
        return new TableDataFooterBuilder<V>({
            ...this.headers,
            data: data,
            dataFormatters: columnFormatters
        })
    }
}

type RowColHeadersData<V> = ColumnHeaders<V> & RowColumnHeaders<V> & {
    data: DataFrame<V>
    dataFormatters: Array<Formatter<V>>
}

/**
 *
 */
class TableDataFooterBuilder<V> {
    readonly headersAndData: RowColHeadersData<V>

    /**
     *
     */
    constructor(headersAndData: RowColHeadersData<V>) {
        this.headersAndData = headersAndData
    }

    /**
     *
     */
    public withoutFooter(): TableData<V> {
        const {rowHeader, columnHeader, data} = this.headersAndData
        // convert the data-frame to a data-frame of strings using the column formatters
        if (rowHeader.length > 0 && this.headersAndData.rowHeader.length !== data.rowCount()) {
            const message = "The data must have the same number of rows as the row headers. Cannot construct table data." +
                `num_row_headers: ${rowHeader.length}; num_rows: ${data.rowCount()}`
            console.error(message)
            throw new Error(message)
        }
        if (columnHeader.length > 0 && columnHeader.length !== data.columnCount()) {
            const message = "The data must have the same number of columns as the column header. Cannot construct table data." +
                `num_header_columns: ${columnHeader.length}; num_data_columns: ${data.columnCount()}`
            console.error(message)
            throw new Error(message)
        }
        // add the column header
        let result: Result<DataFrame<V>, string> = successResult(data);
        if (columnHeader.length > 0) {
            result = data.insertRowBefore(0, columnHeader)
        }
        // adjust the row header and add it, under the possibility that the adding the column
        // header has failed
        if (rowHeader.length > 0) {
            if (columnHeader.length > 0) {
                const updatedRowHeader = rowHeader.slice()
                updatedRowHeader.unshift(undefined as V)
                result = result.andThen(df => df.insertColumnBefore(0, updatedRowHeader))
            } else {
                result = result.andThen(df => df.insertColumnBefore(0, rowHeader))
            }
        }
        // tag the row and column headers in the data frame
        const updated = result
            .andThen(df => df.tagRow(0, "column-header", TableTagType.COLUMN_HEADER))
            .andThen(df => df.tagColumn(0, "row-header", TableTagType.ROW_HEADER))
            .getOrThrow()

        return {
            data: updated,
            hasRowHeaders: rowHeader.length > 0,
            hasColumnHeaders: columnHeader.length > 0,
            hasFooter: false,
        }
    }

    /**
     *
     * @param footer
     */
    public withFooter(footer: Array<V>): TableData<V> {
        if (footer.length === 0) {
            return this.withoutFooter()
        }

        const {rowHeader, columnHeader, data} = this.headersAndData
        // convert the data-frame to a data-frame of strings using the column formatters
        if (rowHeader.length > 0 && this.headersAndData.rowHeader.length !== data.rowCount()) {
            const message = "The data must have the same number of rows as the row headers. Cannot construct table data." +
                `num_row_headers: ${rowHeader.length}; num_rows: ${data.rowCount()}`
            console.error(message)
            throw new Error(message)
        }
        if (columnHeader.length > 0 && columnHeader.length !== data.columnCount()) {
            const message = "The data must have the same number of columns as the column header. Cannot construct table data." +
                `num_header_columns: ${columnHeader.length}; num_data_columns: ${data.columnCount()}`
            console.error(message)
            throw new Error(message)
        }
        if (footer.length !== data.columnCount()) {
            const message = "The footer must have the same number of columns as the data. Cannot construct table data." +
                `num_data_columns: ${data.columnCount()}; num_footer_columns: ${footer.length}`;
            console.error(message)
            throw new Error(message)
        }
        // add the column header
        let result: Result<DataFrame<V>, string> = successResult(data);
        if (columnHeader.length > 0) {
            result = data.insertRowBefore(0, columnHeader)
        }
        // add the footer to the end
        result = result.andThen(df => df.pushRow(footer))
        // adjust the row header and add it, under the possibility that the adding the column
        // header has failed
        if (rowHeader.length > 0) {
            if (columnHeader.length > 0) {
                const updatedRowHeader = rowHeader.slice()
                // add an empty element to the front
                updatedRowHeader.unshift(undefined as V)
                // add an empty element to the back
                updatedRowHeader.push(undefined as V)
                result = result.andThen(df => df.insertColumnBefore(0, updatedRowHeader))
            } else {
                result = result.andThen(df => df.insertColumnBefore(0, rowHeader))
            }
        }
        const updated = result
            .andThen(df => df.tagRow(0, "column-header", TableTagType.COLUMN_HEADER))
            .andThen(df => df.tagColumn(0, "row-header", TableTagType.ROW_HEADER))
            .andThen(df => df.tagRow(df.rowCount()-1, "footer", TableTagType.FOOTER))
            .getOrThrow()

        return {
            data: updated,
            hasRowHeaders: rowHeader.length > 0,
            hasColumnHeaders: columnHeader.length > 0,
            hasFooter: false,
        }
    }
}

// /**
//  * Creates a matrix by adding the column headers and row headers to the data matrix. Makes
//  * a copy of the data before modifying the structure.
//  * @param columnHeader The column headers (this is a row). The number of column header elements
//  * must equal the number of columns (not including the row-header column)
//  * @param rowHeader The row headers (this is a column). The number of row header elements must
//  * equal the number of rows (not including the column header or the footer)
//  * @param data The matrix of data, where each element in the array is a row, which is an array
//  * of elements.
//  * @param footer An array holding the footer elements. The number of footer elements must be
//  * equal to the number of columns (not including the row-header column).
//  * @return A matrix where the first row is the column headers, if specified, and the first
//  * column is a header for the rows, if specified.
//  */
// function makeHeadersPartOfTableData(
//     columnHeader: Array<HeaderElement>,
//     rowHeader: Array<HeaderElement>,
//     data: Array<Row>,
//     footer: Array<string>
// ): Result<Array<Row>, string> {
//     if (rowHeader.length > 0 && data.length !== rowHeader.length) {
//         return failureResult("Cannot merge headers because the number of row-headers does not equal the number of rows; " +
//             `num_row_headers: ${rowHeader.length}; num_rows: ${data.length}`
//         )
//     }
//     if (columnHeader.length > 0 && numColumnsFromRows(data) !== columnHeader.length) {
//         return failureResult("Cannot merge headers because the number of column-headers does not equal the number of columns; " +
//             `num_column_headers: ${rowHeader.length}; num_columns: ${numColumnsFromRows(data)}`
//         )
//     }
//
//     const newData: Array<Row> = data.map(row => row.slice())
//
//     // when the table has a row representing the column headers, insert the converted
//     // header as the first row
//     if (columnHeader.length > 0) {
//         newData.unshift(columnHeader.map(elem => elem.label))
//     }
//
//     // when each row has a header, then insert the header for each row as the first
//     // element of the row, making a column of row headers. if a column header was also
//     // specified, then the first row header is empty
//     if (rowHeader.length > 0) {
//         const rowHeaders = rowHeader.map(elem => elem.label)
//         if (columnHeader.length > 0) {
//             rowHeaders.unshift("")
//         }
//         newData.forEach((row, index) => row.unshift(rowHeaders[index]))
//     }
//
//     // add the footer if it is specified, and if it has the correct number of elements
//     if (footer.length > 0) {
//         if (footer.length !== columnHeader.length) {
//             return failureResult("Cannot merge footer because the number of footer elements does not equal the number of columns; " +
//                 `num_footer_elements: ${footer.length}; num_columns: ${columnHeader.length}`
//             )
//         }
//         const newFooter =  (rowHeader.length > 0) ? ["", ...footer] : footer.slice()
//         newData.push(newFooter)
//     }
//
//     return successResult(newData);
// }
//
//
// /**
//  *
//  * @param data
//  */
// function numColumnsFromRows(data: Array<Row>): number {
//     const numColumns: Array<number> = data.map(row => row.length)
//     return Math.min(...numColumns)
// }
