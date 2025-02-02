export namespace SvgTable {

    interface HeaderElement {
        readonly name: string
        readonly label: string
        readonly formatter: (value: any) => string
    }

    /**
     *
     * @param value
     */
    export const defaultFormatter: <D>(value: D) => string = value => `${value}`

    type Row = Array<any>
    type HeaderElementWithNameRequired = { name: string } & Partial<Omit<HeaderElement, 'name'>>

    /**
     *
     */
    export namespace Data {

        /**
         *
         */
        export interface TableData {
            readonly header: Array<HeaderElement>
            readonly data: Array<Row>
            readonly footer: Array<string>
            readonly numColumns: () => number
            readonly numRows: () => number
        }

        /**
         *
         * @param columnInfo
         */
        export function withHeader(columnInfo: Array<string> | Array<HeaderElementWithNameRequired>): TableHeaderData {
            // conform the header elements to the header element type
            const elements: Array<HeaderElement> = columnInfo
                .map((element: string | Partial<HeaderElement>) => (typeof element === "string") ?
                    ({name: element, label: element, formatter: defaultFormatter}) :
                    ({
                        name: element.name,
                        label: (element.label || element.name),
                        formatter: (element.formatter || defaultFormatter)
                    })
                )
            return new TableHeaderData(elements)
        }

        /**
         *
         */
        class TableHeaderData {
            readonly header: Array<HeaderElement>

            /**
             *
             * @param header
             */
            constructor(header: Array<HeaderElement>) {
                this.header = header
            }

            /**
             *
             * @param data
             */
            public withDataAsRow(data: Array<Row>): TableHeaderDataFooter {
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
                if (this.header !== undefined && this.header.length !== minColumns) {
                    const message = `The data must have the same number of columns as the header. Cannot construct table data.` +
                        `num_header_columns: ${this.header.length}; num_data_columns: ${minColumns}`
                    console.error(message)
                    throw new Error(message)
                }

                const formattedData = data
                    .map(row => row
                        .map((elem, columnIndex) => this.header[columnIndex].formatter(elem))
                    )

                return new TableHeaderDataFooter(this.header, formattedData)
            }

            /**
             *
             * @param data
             */
            public withDataAsColumns(data: Array<Array<any>>): TableHeaderDataFooter {
                // make sure that when the header data is already set, the number of columns equals
                // the number of columns of the data
                if (this.header !== undefined && this.header.length !== data.length) {
                    const message = "The data must have the same number of columns as the header. Cannot construct table data." +
                        `num_header_columns: ${this.header.length}; num_data_columns: ${data.length}`
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
                        const formatter = this.header[columnIndex].formatter
                        row.push(formatter(data[columnIndex][rowIndex]))
                    }
                    rows.push(row)
                }

                return new TableHeaderDataFooter(this.header, rows)
            }
        }

        /**
         *
         */
        class TableHeaderDataFooter {
            readonly header: Array<HeaderElement>
            readonly data: Array<Row>

            /**
             *
             * @param header
             * @param data
             */
            constructor(header: Array<HeaderElement>, data: Array<Row>) {
                this.header = header
                this.data = data
            }

            /**
             *
             */
            public withoutFooter(): TableData {
                return {
                    header: this.header,
                    data: this.data,
                    footer: [],
                    numColumns: () => this.header.length,
                    numRows: () => this.data.length,
                }
            }

            /**
             *
             * @param footer
             */
            public withFooter(footer: Array<string>): TableData {
                // make sure that when the header data is already set, the number of columns equals
                // the number of columns of the data
                if (this.data !== undefined && footer.length !== numColumnsFromRows(this.data)) {
                    const message = "The footer must have the same number of columns as the data. Cannot construct table data." +
                        `num_data_columns: ${numColumnsFromRows(this.data)}; num_footer_columns: ${footer.length}`;
                    console.error(message)
                    throw new Error(message)
                }

                // not really needed (todo remove me)
                if (this.header !== undefined && footer.length !== this.header.length) {
                    const message = "The footer must have the same number of columns as the header. Cannot construct table data." +
                        `num_header_columns: ${this.header.length}; num_footer_columns: ${footer.length}`;
                    console.error(message)
                    throw new Error(message)
                }

                return {
                    header: this.header,
                    data: this.data,
                    footer,
                    numColumns: () => this.header.length,
                    numRows: () => this.data.length,
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
    }
}