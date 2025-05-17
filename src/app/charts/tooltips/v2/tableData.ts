/*
 * To build
 */

import {failureResult, Result, successResult} from "result-fn";
import {DataFrame} from "./DataFrame";

export interface HeaderElement {
    readonly name: string
    readonly label: string
    readonly formatter: (value: any) => string
}

/**
 *
 * @param value
 */
export const defaultFormatter: <D>(value: D) => string = value => `${value}`

export type Row = Array<any>
type HeaderElementWithNameRequired = { name: string } & Partial<Omit<HeaderElement, 'name'>>

/**
 * Represents the table data, row and column headers, data formatters,
 */
export interface TableData<V> {
// export interface TableData {
    /**
     * The matrix of data, including row and column headers, if they
     * exist (see {@link hasRowHeaders}, {@link hasColumnHeaders}, {@link numRows}, {@link numColumns})
     */
    readonly data: DataFrame<V>
    // readonly data: Array<Row>

    readonly hasColumnHeaders: boolean
    readonly hasRowHeaders: boolean
    readonly hasFooter: boolean

    /**
     * Function that returns the total number of rows, including a row of column
     * headers, if it exists (see {@link hasColumnHeaders})
     */
    readonly numRows: () => number
    /**
     * Function that returns the total number of columns, including column of row
     * headers, if it exists (see {@link hasRowHeaders})
     */
    readonly numColumns: () => number
}

/**
 * Entry point for the builder to create table data. From here, you can specify the
 * header information, then the data, and then the footers.
 */
export function createTableData(): TableDataColumnHeaderBuilder {
    return new TableDataColumnHeaderBuilder()
}

class TableDataColumnHeaderBuilder {

    /**
     *
     * @param columnInfo
     */
    public withColumnHeader(columnInfo: Array<string> | Array<HeaderElementWithNameRequired>): TableDataRowHeaderBuilder {
        // conform the header elements to the header element type
        const elements: Array<HeaderElement> = columnInfo
            .map((element: string | Partial<HeaderElement>) => (typeof element === "string") ?
                ({name: element, label: element, formatter: defaultFormatter}) :
                ({
                    name: element.name,
                    label: (element.label || element.name),
                    formatter: (element.formatter || defaultFormatter)
                } as HeaderElement)
            )
        return new TableDataRowHeaderBuilder(elements)
    }

    /**
     * Create a table-data builder without a header (strange, but ok)
     */
    public withoutHeaders(): TableDataBuilder {
        return new TableDataBuilder(undefined, undefined)
    }

    /**
     * Create a table-data builder without a header (strange, but ok)
     */
    public withoutColumnsHeader(): TableDataRowHeaderBuilder {
        return new TableDataRowHeaderBuilder(undefined)
    }

}

class TableDataRowHeaderBuilder {
    readonly columnHeader: Array<HeaderElement>

    /**
     *
     * @param header
     */
    constructor(header?: Array<HeaderElement>) {
        this.columnHeader = header || []
    }

    public withRowHeader(rowInfo: Array<string> | Array<HeaderElementWithNameRequired>): TableDataBuilder {
        const elements: Array<HeaderElement> = rowInfo
            .map((element: string | Partial<HeaderElement>) => (typeof element === "string") ?
                ({name: element, label: element, formatter: defaultFormatter}) :
                ({
                    name: element.name,
                    label: (element.label || element.name),
                    formatter: (element.formatter || defaultFormatter)
                } as HeaderElement)
            )
        return new TableDataBuilder(this.columnHeader, elements)
    }

    public withoutRowHeader(): TableDataBuilder {
        return new TableDataBuilder(this.columnHeader, undefined)
    }
}

/**
 *
 */
class TableDataBuilder<V> {
    readonly columnHeader: Array<HeaderElement>
    readonly rowHeader: Array<HeaderElement>

    /**
     *
     * @param columnHeader
     * @param rowHeader
     */
    constructor(columnHeader?: Array<HeaderElement>, rowHeader?: Array<HeaderElement>) {
        this.columnHeader = columnHeader || []
        this.rowHeader = rowHeader || []
    }

    /**
     *
     * @param data
     */
    public withDataAsRow(data: Array<Row>): TableDataFooterBuilder {
        // ensure that when the row header is specified, that the number of rows matches the row header
        if (this.rowHeader.length !== 0 && this.rowHeader.length !== data.length) {
            const message = "The data must have the same number of rows as the row headers. Cannot construct table data." +
                `num_row_headers: ${this.rowHeader.length}; num_rows: ${data.length}`
            console.error(message)
            throw new Error(message)
        }

        // calculate the number of columns in each row to ensure that all rows have the same
        // number of columns
        const numColumns: Array<number> = data.map(row => row.length)
        const minColumns = Math.min(...numColumns)
        if (minColumns !== Math.max(...numColumns)) {
            const message = `All rows must have the same number of columns. Cannot construct table data. ` +
                `num_columns: [${numColumns}]`
            console.error(message)
            throw new Error(message)
        }

        // make sure that when the header data is already set, the number of columns equals
        // the number of columns of the data
        if (this.columnHeader.length !== 0 && this.columnHeader.length !== minColumns) {
            const message = `The data must have the same number of columns as the header. Cannot construct table data.` +
                `num_header_columns: ${this.columnHeader.length}; num_data_columns: ${minColumns}`
            console.error(message)
            throw new Error(message)
        }

        const formattedData = data
            .map(row => row
                .map((elem, columnIndex) => {
                    const headerElem = this.columnHeader[columnIndex]
                    return headerElem ? headerElem.formatter(elem) : defaultFormatter(elem)
                })
            )

        return new TableDataFooterBuilder(this.columnHeader, this.rowHeader, formattedData)
    }

    /**
     *
     * @param data
     */
    public withDataAsColumns(data: Array<Array<any>>): TableDataFooterBuilder {
        // make sure that when the header data is already set, the number of columns equals
        // the number of columns of the data
        if (this.columnHeader.length !== 0 && this.columnHeader.length !== data.length) {
            const message = "The data must have the same number of columns as the header. Cannot construct table data." +
                `num_header_columns: ${this.columnHeader.length}; num_data_columns: ${data.length}`
            console.error(message)
            throw new Error(message)
        }

        // ensure that each column has the same number of rows
        const numRows = data.map(column => column.length)
        const minRows = Math.min(...numRows)
        if (minRows !== Math.max(...numRows)) {
            const message = "All data columns must have the same number of rows. Cannot construct table data." +
                `num_rows: [${numRows}]`
            console.error(message)
            throw new Error(message)
        }

        // transpose the data
        const rows = new Array<Array<string>>()
        for (let rowIndex = 0; rowIndex < minRows; rowIndex++) {
            const row = new Array<string>()
            for (let columnIndex = 0; columnIndex < data.length; columnIndex++) {
                const formatter = this.columnHeader[columnIndex].formatter
                row.push(formatter(data[columnIndex][rowIndex]))
            }
            rows.push(row)
        }

        return new TableDataFooterBuilder(this.columnHeader, this.rowHeader, rows)
    }
}

/**
 *
 */
class TableDataFooterBuilder<V> {
    readonly columnHeader: Array<HeaderElement>
    readonly rowHeader: Array<HeaderElement>
    readonly data: DataFrame<V>
    // readonly data: Array<Row>

    /**
     *
     * @param columnHeader
     * @param rowHeader
     * @param data
     */
    constructor(columnHeader: Array<HeaderElement>, rowHeader: Array<HeaderElement>, data: DataFrame<V>) {
    // constructor(columnHeader: Array<HeaderElement>, rowHeader: Array<HeaderElement>, data: Array<Row>) {
        this.columnHeader = columnHeader
        this.rowHeader = rowHeader
        this.data = data
    }

    /**
     *
     */
    public withoutFooter(): TableData<V> {
        const data = makeHeadersPartOfTableData(this.columnHeader, this.rowHeader, this.data, []).getOrThrow()
        return {
            data: data,

            hasRowHeaders: this.rowHeader.length > 0,
            hasColumnHeaders: this.columnHeader.length > 0,
            hasFooter: false,

            numRows: () => data.length,
            numColumns: () => numColumnsFromRows(data),
        }
    }

    /**
     *
     * @param footer
     */
    public withFooter(footer: Array<string>): TableData {
        // make sure that when the header data is already set, the number of columns equals
        // the number of columns of the data
        if (this.data.length !== 0 && footer.length !== numColumnsFromRows(this.data)) {
            const message = "The footer must have the same number of columns as the data. Cannot construct table data." +
                `num_data_columns: ${numColumnsFromRows(this.data)}; num_footer_columns: ${footer.length}`;
            console.error(message)
            throw new Error(message)
        }

        // not really needed (todo remove me)
        if (this.columnHeader.length !== 0 && footer.length !== this.columnHeader.length) {
            const message = "The footer must have the same number of columns as the header. Cannot construct table data." +
                `num_header_columns: ${this.columnHeader.length}; num_footer_columns: ${footer.length}`;
            console.error(message)
            throw new Error(message)
        }

        const data = makeHeadersPartOfTableData(this.columnHeader, this.rowHeader, this.data, footer).getOrThrow()

        return {
            data: data,

            hasRowHeaders: this.rowHeader.length > 0,
            hasColumnHeaders: this.columnHeader.length > 0,
            hasFooter: footer.length > 0,

            numRows: () => this.data.length,
            numColumns: () => numColumnsFromRows(data),
        }

    }
}

/**
 * Creates a matrix by adding the column headers and row headers to the data matrix. Makes
 * a copy of the data before modifying the structure.
 * @param columnHeader The column headers (this is a row). The number of column header elements
 * must equal the number of columns (not including the row-header column)
 * @param rowHeader The row headers (this is a column). The number of row header elements must
 * equal the number of rows (not including the column header or the footer)
 * @param data The matrix of data, where each element in the array is a row, which is an array
 * of elements.
 * @param footer An array holding the footer elements. The number of footer elements must be
 * equal to the number of columns (not including the row-header column).
 * @return A matrix where the first row is the column headers, if specified, and the first
 * column is a header for the rows, if specified.
 */
function makeHeadersPartOfTableData(
    columnHeader: Array<HeaderElement>,
    rowHeader: Array<HeaderElement>,
    data: Array<Row>,
    footer: Array<string>
): Result<Array<Row>, string> {
    if (rowHeader.length > 0 && data.length !== rowHeader.length) {
        return failureResult("Cannot merge headers because the number of row-headers does not equal the number of rows; " +
            `num_row_headers: ${rowHeader.length}; num_rows: ${data.length}`
        )
    }
    if (columnHeader.length > 0 && numColumnsFromRows(data) !== columnHeader.length) {
        return failureResult("Cannot merge headers because the number of column-headers does not equal the number of columns; " +
            `num_column_headers: ${rowHeader.length}; num_columns: ${numColumnsFromRows(data)}`
        )
    }

    const newData: Array<Row> = data.map(row => row.slice())

    // when the table has a row representing the column headers, insert the converted
    // header as the first row
    if (columnHeader.length > 0) {
        newData.unshift(columnHeader.map(elem => elem.label))
    }

    // when each row has a header, then insert the header for each row as the first
    // element of the row, making a column of row headers. if a column header was also
    // specified, then the first row header is empty
    if (rowHeader.length > 0) {
        const rowHeaders = rowHeader.map(elem => elem.label)
        if (columnHeader.length > 0) {
            rowHeaders.unshift("")
        }
        newData.forEach((row, index) => row.unshift(rowHeaders[index]))
    }

    // add the footer if it is specified, and if it has the correct number of elements
    if (footer.length > 0) {
        if (footer.length !== columnHeader.length) {
            return failureResult("Cannot merge footer because the number of footer elements does not equal the number of columns; " +
                `num_footer_elements: ${footer.length}; num_columns: ${columnHeader.length}`
            )
        }
        const newFooter =  (rowHeader.length > 0) ? ["", ...footer] : footer.slice()
        newData.push(newFooter)
    }

    return successResult(newData);
}


/**
 *
 * @param data
 */
function numColumnsFromRows(data: Array<Row>): number {
    const numColumns: Array<number> = data.map(row => row.length)
    return Math.min(...numColumns)
}
