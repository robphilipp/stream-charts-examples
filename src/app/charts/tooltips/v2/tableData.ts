import {successResult} from "result-fn";
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
     * The matrix of data, including row and column headers, if they exist
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
        const dataFrame = successResult<DataFrame<V>, string>(data)
            .flatMap((df: DataFrame<V>) =>  (columnHeader.length > 0) ?
                df.insertRowBefore(0, columnHeader) :
                successResult(df)
            )
            .flatMap((df: DataFrame<V>) => {
                if (rowHeader.length > 0) {
                    if (columnHeader.length > 0) {
                        const updatedRowHeader = rowHeader.slice()
                        updatedRowHeader.unshift(undefined as V)
                        return df.insertColumnBefore(0, updatedRowHeader)
                    } else {
                        return df.insertColumnBefore(0, rowHeader)
                    }
                }
                return successResult(df)
            })
            .flatMap(df => df.tagRow(0, "column-header", TableTagType.COLUMN_HEADER))
            .flatMap(df => df.tagColumn(0, "row-header", TableTagType.ROW_HEADER))
            .getOrThrow()

        return {
            data: dataFrame,
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
        // wrong method called
        if (footer.length === 0) {
            return this.withoutFooter()
        }

        // make a copy of the footer so that we can adjust it without changing the input data
        const tableFooter = footer.slice()

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
        if ((tableFooter.length !== data.columnCount() + (rowHeader.length > 0 ? 1 : 0) && tableFooter.length !== data.columnCount())) {
            const message = "The footer must have the same number of columns as the data. Cannot construct table data." +
                `num_data_columns: ${data.columnCount()}; row_header_columns: ${rowHeader.length > 0 ? 1 : 0}; `+
                `num_footer_columns: ${tableFooter.length}`;
            console.error(message)
            throw new Error(message)
        }

        // when the footer doesn't have a row header and it needs on, then add an undefined as a placeholder
        if (tableFooter.length > 0 && rowHeader.length > 0 && (tableFooter.length === data.columnCount() - 1 || tableFooter.length === data.columnCount())) {
            tableFooter.unshift(undefined as V)
        }

        // add the column header
        const dataFrame = successResult(data)
            // when there is a column header, then insert the column header before the data
            .conditionalFlatMap(() => columnHeader.length > 0, df => df.insertRowBefore(0, columnHeader))
            // adjust the row header and add it, under the possibility that adding the column has failed
            .conditionalFlatMap(() => rowHeader.length > 0, df => {
                if (columnHeader.length > 0) {
                    const updatedRowHeader = rowHeader.slice()
                    updatedRowHeader.unshift(undefined as V)
                    return df.insertColumnBefore(0, updatedRowHeader)
                }
                return df.insertColumnBefore(0, rowHeader)
            })
            // add the footer to the end
            .flatMap(df => df.pushRow(tableFooter))
            // add the tags to the data-frame for the column headers, row headers, and footer
            .flatMap(df => df.tagRow(0, "column-header", TableTagType.COLUMN_HEADER))
            .flatMap(df => df.tagColumn(0, "row-header", TableTagType.ROW_HEADER))
            .flatMap(df => df.tagRow(df.rowCount()-1, "footer", TableTagType.FOOTER))
            .getOrThrow()

        return {
            data: dataFrame,
            hasRowHeaders: rowHeader.length > 0,
            hasColumnHeaders: columnHeader.length > 0,
            hasFooter: tableFooter.length > 0,
        }
    }
}
