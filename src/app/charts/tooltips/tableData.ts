/*
 * To build
 */

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
export interface TableData {
    readonly columnHeader: Array<HeaderElement>
    readonly rowHeader: Array<HeaderElement>
    readonly data: Array<Row>
    readonly footer: Array<string>
    readonly numColumns: number
    readonly numRows: number
    readonly hasColumnHeaders: boolean
    readonly hasRowHeaders: boolean
}

/**
 * Entry point for the builder to create table data. From here, you can specify the
 * header information, then the data, and then the footers.
 */
export function createTableData(): TableDataBuilder {
    return new TableDataBuilder()
}

class TableDataBuilder {

    /**
     *
     * @param columnInfo
     */
    public withColumnHeader(columnInfo: Array<string> | Array<HeaderElementWithNameRequired>): TableRowHeader {
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
        return new TableRowHeader(elements)
    }

    /**
     * Create a table-data builder without a header (strange, but ok)
     */
    public withoutHeaders(): TableHeaderData {
        return new TableHeaderData(undefined, undefined)
    }

    /**
     * Create a table-data builder without a header (strange, but ok)
     */
    public withoutColumnsHeader(): TableRowHeader {
        return new TableRowHeader(undefined)
    }

}

class TableRowHeader {
    readonly columnHeader: Array<HeaderElement>

    /**
     *
     * @param header
     */
    constructor(header?: Array<HeaderElement>) {
        this.columnHeader = header || []
    }

    public withRowHeader(rowInfo: Array<string> | Array<HeaderElementWithNameRequired>): TableHeaderData {
        const elements: Array<HeaderElement> = rowInfo
            .map((element: string | Partial<HeaderElement>) => (typeof element === "string") ?
                ({name: element, label: element, formatter: defaultFormatter}) :
                ({
                    name: element.name,
                    label: (element.label || element.name),
                    formatter: (element.formatter || defaultFormatter)
                } as HeaderElement)
            )
        return new TableHeaderData(this.columnHeader, elements)
    }

    public withoutRowHeader(): TableHeaderData {
        return new TableHeaderData(this.columnHeader, undefined)
    }
}

/**
 *
 */
class TableHeaderData {
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
    public withDataAsRow(data: Array<Row>): TableHeaderDataFooter {
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

        return new TableHeaderDataFooter(this.columnHeader, this.rowHeader, formattedData)
    }

    /**
     *
     * @param data
     */
    public withDataAsColumns(data: Array<Array<any>>): TableHeaderDataFooter {
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

        return new TableHeaderDataFooter(this.columnHeader, this.rowHeader, rows)
    }
}

/**
 *
 */
class TableHeaderDataFooter {
    readonly columnHeader: Array<HeaderElement>
    readonly rowHeader: Array<HeaderElement>
    readonly data: Array<Row>

    /**
     *
     * @param columnHeader
     * @param rowHeader
     * @param data
     */
    constructor(columnHeader: Array<HeaderElement>, rowHeader: Array<HeaderElement>, data: Array<Row>) {
        this.columnHeader = columnHeader
        this.rowHeader = rowHeader
        this.data = data
    }

    /**
     *
     */
    public withoutFooter(): TableData {
        return {
            columnHeader: this.columnHeader,
            rowHeader: this.rowHeader,
            data: this.data,
            footer: [],
            numColumns: numColumnsFromRows(this.data),
            numRows: this.data.length,
            hasColumnHeaders: this.columnHeader.length > 0,
            hasRowHeaders: this.rowHeader.length > 0,
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

        return {
            columnHeader: this.columnHeader,
            rowHeader: this.rowHeader,
            data: this.data,
            footer,
            numColumns: numColumnsFromRows(this.data),
            numRows: this.data.length,
            hasColumnHeaders: this.columnHeader.length > 0,
            hasRowHeaders: this.rowHeader.length > 0,
        }

    }
}

/**
 *
 * @param data
 */
function numColumnsFromRows(data: Array<Row>): number {
    const numColumns: Array<number> = data.map(row => row.length)
    return Math.min(...numColumns)
}
