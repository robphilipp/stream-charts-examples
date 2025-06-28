import {successResult} from "result-fn";
import {DataFrame} from "data-frame-ts";

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
     * The matrix of data, including row and column headers, if they exist
     */
    constructor(private readonly data: DataFrame<V>) {}

    hasColumnHeaders(): boolean {
        return this.data.rowTagsFor(0).some(tag => tag.value === TableTagType.COLUMN_HEADER)
    }

    hasRowHeaders(): boolean {
        return this.data.rowTagsFor(0).some(tag => tag.value === TableTagType.ROW_HEADER)
    }

    hasFooter(): boolean {
        return this.data.rowTagsFor(this.data.rowCount() - 1).some(tag => tag.value === TableTagType.FOOTER)
    }
}

/**
 * Entry point for the builder to create table data. From here, you can specify the
 * header information, then the data, and then the footers.
 */
export function createTableData<V>(data: DataFrame<V>): TableDataColumnHeaderBuilder<V> {
    return new TableDataColumnHeaderBuilder<V>(data)
    // return new TableDataColumnHeaderBuilder<V>()
}

/**
 * The second step in the guide build for creating the {@link TableData} object. This builder
 * step allows the developer to specify whether to use column headers. As a convenience, the developer
 * can also specify their desire not to use any headers.
 */
class TableDataColumnHeaderBuilder<V> {
    private readonly data: DataFrame<V>;

    constructor(data: DataFrame<V>) {
        this.data = data
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

    // public withColumnHeader(header: Array<V>, formatter: Formatter<V> = defaultFormatter<V>): TableDataRowHeaderBuilder<V> {
    //     return new TableDataRowHeaderBuilder<V>({columnHeader: header, columnHeaderFormatter: formatter})
    // }

    /**
     * Create a table-data builder without a header (strange, but ok)
     */
    // public withoutHeaders(): TableDataBuilder<V> {
    //     return new TableDataBuilder({
    public withoutHeaders(): TableDataFooterBuilder<V> {
        return new TableDataFooterBuilder<V>(this.data)
    }        // return new TableDataFooterBuilder<V>({
    //     columnHeader: [],
    //     columnHeaderFormatter: defaultFormatter<V>,
    //     rowHeader: [],
    //     rowHeaderFormatter: defaultFormatter<V>
    // } as RowColHeadersData<V>)
    // }

    // /**
    //  * Create a table-data builder without a header (strange, but ok)
    //  */
    // public withoutColumnsHeader(): TableDataRowHeaderBuilder<V> {
    //     return new TableDataRowHeaderBuilder<V>({
    //         columnHeader: [],
    //         columnHeaderFormatter: defaultFormatter<V>
    //     })
    // }
}

/**
 * The bag of stuff created by the guided builder process
 */
type ColumnHeaders<V> = {
    columnHeader: Array<V>,
    columnHeaderFormatter: Formatter<V>
}

/**
 * This is the next step in the
 */
class TableDataRowHeaderBuilder<V> {
    // readonly headers: ColumnHeaders<V>
    private readonly data: DataFrame<V>

    constructor(data: DataFrame<V>) {
        this.data = data
    }

    // constructor(header: ColumnHeaders<V>) {
    //     this.headers = header
    // }

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

    // public withRowHeader(header: Array<V>, formatter: Formatter<V> = defaultFormatter<V>): TableDataFooterBuilder<V> {
    //     this.data
    //     return this.data
    //         .insertColumnBefore(0, header)
    //         .flatMap(df => df.tagRow(0, "row-header", TableTagType.ROW_HEADER))
    //         .flatMap(df => df.tagRow<Formatter<V>>(0, "row-header-formatter", formatter))
    //         .map(df => new TableDataFooterBuilder<V>(df))
    //         .getOrThrow()
    //     // return new TableDataFooterBuilder<V>()
    // }

    public withoutRowHeader(): TableData<V> {
        return new TableData<V>(this.data)
    }

    // public withoutRowHeader(): TableDataBuilder<V> {
    //     return new TableDataBuilder({...this.headers, rowHeader: [], rowHeaderFormatter: defaultFormatter})
    // }
    // public withRowHeader(header: Array<V>, formatter: Formatter<V> = defaultFormatter<V>): TableDataBuilder<V> {
    //     return new TableDataBuilder({...this.headers, rowHeader: header, rowHeaderFormatter: formatter})
    // }
    //
    // public withoutRowHeader(): TableDataBuilder<V> {
    //     return new TableDataBuilder({...this.headers, rowHeader: [], rowHeaderFormatter: defaultFormatter})
    // }
}

type RowColumnHeaders<V> = ColumnHeaders<V> & {
    rowHeader: Array<V>
    rowHeaderFormatter: Formatter<V>
}

// /**
//  *
//  */
// class TableDataBuilder<V> {
//     readonly headers: RowColumnHeaders<V>
//
//     /**
//      *
//      */
//     constructor(headers: RowColumnHeaders<V>) {
//         this.headers = headers
//     }
//
//     /**
//      *
//      */
//     public withData(data: DataFrame<V>, columnFormatters: Array<Formatter<V>> = []): TableDataFooterBuilder<V> {
//         return new TableDataFooterBuilder<V>({
//             ...this.headers,
//             data: data,
//             dataFormatters: columnFormatters
//         })
//     }
// }

type RowColHeadersData<V> = ColumnHeaders<V> & RowColumnHeaders<V> & {
    data: DataFrame<V>
    dataFormatters: Array<Formatter<V>>
}

/**
 *
 */
class TableDataFooterBuilder<V> {
    // readonly headersAndData: RowColHeadersData<V>

    /**
     *
     */
    constructor(private readonly data: DataFrame<V>) {
    }

    // constructor(headersAndData: RowColHeadersData<V>) {
    //     this.headersAndData = headersAndData
    // }

    /**
     *
     */
    public withoutFooter(): TableDataRowHeaderBuilder<V> {
        return new TableDataRowHeaderBuilder<V>(this.data)
    }

    // /**
    //  *
    //  */
    // public withoutFooter(): TableDataFormatterBuilder<V> {
    //     const {rowHeader, columnHeader, data} = this.headersAndData
    //     // convert the data-frame to a data-frame of strings using the column formatters
    //     if (rowHeader.length > 0 && this.headersAndData.rowHeader.length !== data.rowCount()) {
    //         const message = "The data must have the same number of rows as the row headers. Cannot construct table data." +
    //             `num_row_headers: ${rowHeader.length}; num_rows: ${data.rowCount()}`
    //         console.error(message)
    //         throw new Error(message)
    //     }
    //     if (columnHeader.length > 0 && columnHeader.length !== data.columnCount()) {
    //         const message = "The data must have the same number of columns as the column header. Cannot construct table data." +
    //             `num_header_columns: ${columnHeader.length}; num_data_columns: ${data.columnCount()}`
    //         console.error(message)
    //         throw new Error(message)
    //     }
    //     // add the column header
    //     const dataFrame = successResult<DataFrame<V>, string>(data)
    //         .flatMap((df: DataFrame<V>) => (columnHeader.length > 0) ?
    //             df.insertRowBefore(0, columnHeader) :
    //             successResult(df)
    //         )
    //         .flatMap((df: DataFrame<V>) => {
    //             if (rowHeader.length > 0) {
    //                 if (columnHeader.length > 0) {
    //                     const updatedRowHeader = rowHeader.slice()
    //                     updatedRowHeader.unshift(undefined as V)
    //                     return df.insertColumnBefore(0, updatedRowHeader)
    //                 } else {
    //                     return df.insertColumnBefore(0, rowHeader)
    //                 }
    //             }
    //             return successResult(df)
    //         })
    //         // todo, why are these done unconditionally? shouldn't we only add these tags when a row/column header are known to be present?
    //         .flatMap(df => df.tagRow(0, "column-header", TableTagType.COLUMN_HEADER))
    //         .flatMap(df => df.tagColumn(0, "row-header", TableTagType.ROW_HEADER))
    //         .getOrThrow()
    //
    //     const tableData: TableData<V> = {
    //         data: dataFrame,
    //         hasRowHeaders: rowHeader.length > 0,
    //         hasColumnHeaders: columnHeader.length > 0,
    //         hasFooter: false,
    //     }
    //
    //     return new TableDataFormatterBuilder<V>(tableData)
    // }

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

    // /**
    //  *
    //  * @param footer
    //  */
    // public withFooter(footer: Array<V>): TableDataFormatterBuilder<V> {
    //     // wrong method called
    //     if (footer.length === 0) {
    //         return this.withoutFooter()
    //     }
    //
    //     // make a copy of the footer so that we can adjust it without changing the input data
    //     const tableFooter = footer.slice()
    //
    //     const {rowHeader, columnHeader, data} = this.headersAndData
    //     // convert the data-frame to a data-frame of strings using the column formatters
    //     if (rowHeader.length > 0 && this.headersAndData.rowHeader.length !== data.rowCount()) {
    //         const message = "The data must have the same number of rows as the row headers. Cannot construct table data." +
    //             `num_row_headers: ${rowHeader.length}; num_rows: ${data.rowCount()}`
    //         console.error(message)
    //         throw new Error(message)
    //     }
    //     if (columnHeader.length > 0 && columnHeader.length !== data.columnCount()) {
    //         const message = "The data must have the same number of columns as the column header. Cannot construct table data." +
    //             `num_header_columns: ${columnHeader.length}; num_data_columns: ${data.columnCount()}`
    //         console.error(message)
    //         throw new Error(message)
    //     }
    //     if ((tableFooter.length !== data.columnCount() + (rowHeader.length > 0 ? 1 : 0) && tableFooter.length !== data.columnCount())) {
    //         const message = "The footer must have the same number of columns as the data. Cannot construct table data." +
    //             `num_data_columns: ${data.columnCount()}; row_header_columns: ${rowHeader.length > 0 ? 1 : 0}; ` +
    //             `num_footer_columns: ${tableFooter.length}`;
    //         console.error(message)
    //         throw new Error(message)
    //     }
    //
    //     // when the footer doesn't have a row header and it needs on, then add an undefined as a placeholder
    //     if (tableFooter.length > 0 && rowHeader.length > 0 && (tableFooter.length === data.columnCount() - 1 || tableFooter.length === data.columnCount())) {
    //         tableFooter.unshift(undefined as V)
    //     }
    //
    //     // add the column header
    //     const dataFrame = successResult(data)
    //         // when there is a column header, then insert the column header before the data
    //         .conditionalFlatMap(() => columnHeader.length > 0, df => df.insertRowBefore(0, columnHeader))
    //         // adjust the row header and add it, under the possibility that adding the column has failed
    //         .conditionalFlatMap(() => rowHeader.length > 0, df => {
    //             if (columnHeader.length > 0) {
    //                 const updatedRowHeader = rowHeader.slice()
    //                 updatedRowHeader.unshift(undefined as V)
    //                 return df.insertColumnBefore(0, updatedRowHeader)
    //             }
    //             return df.insertColumnBefore(0, rowHeader)
    //         })
    //         // add the footer to the end
    //         .flatMap(df => df.pushRow(tableFooter))
    //         // add the tags to the data-frame for the column headers, row headers, and footer
    //         // todo, why are these done unconditionally? shouldn't we only add these tags when a row/column header are known to be present?
    //         .flatMap(df => df.tagRow(0, "column-header", TableTagType.COLUMN_HEADER))
    //         .flatMap(df => df.tagColumn(0, "row-header", TableTagType.ROW_HEADER))
    //         .flatMap(df => df.tagRow(df.rowCount() - 1, "footer", TableTagType.FOOTER))
    //         .getOrThrow()
    //
    //     const tableData: TableData<V> = {
    //         data: dataFrame,
    //         hasRowHeaders: rowHeader.length > 0,
    //         hasColumnHeaders: columnHeader.length > 0,
    //         hasFooter: tableFooter.length > 0,
    //     }
    //
    //     return new TableDataFormatterBuilder<V>(tableData)
    // }
}

// /**
//  * At the end of the build process, you may want to format the data to a string representation, or not. Your choice.
//  * This formatter-builder allows you to specify formatters for each column in the data table you've created.
//  */
// class TableDataFormatterBuilder<V> {
//     // readonly tableData: TableData<V>
//
//     constructor(private readonly data: DataFrame<V>) {
//     }
//
//     // /**
//     //  * @param tableData The table data so far
//     //  */
//     // constructor(tableData: TableData<V>) {
//     //     this.tableData = tableData
//     // }
//
//     /**
//      * Do NOT apply any formatting, and leave the {@link TableData} in its specified types
//      * @return the unchanged {@link TableData}
//      * @see withFormattedData
//      */
//     public build(): TableData<V> {
//         return this.tableData
//     }
//
//     /**
//      * Note that at the end of this process, the {@link TableData<V>} is converted to a {@link TableData<string>}, where
//      * the string holds the formatted data. Column headers, which are expected to be strings, are, for safety, formatted
//      * by the {@link defaultFormatter}.
//      * @param columnFormatters A map of (column-index, formatter) where the column-index is the index of the column
//      * to which to apply the formatter. When the data has row-headers, then a column-index of 0 would refer to the
//      * column of row-headers. Any columns for which no formatter is specified will use the {@link defaultFormatter}
//      * @return The {@link TableData} where each element has been converted to a string based on the specified formater.
//      * @see build
//      */
//     public withFormattedData(columnFormatters: Map<number, (value: V) => string>): TableDataFormatterBuilder<string> {
//         const minValidIndex = this.tableData.hasRowHeaders ? 1 : 0
//         const maxValidIndex = this.tableData.data.columnCount()
//
//         const minIndex = Array.from(columnFormatters.keys())
//             .reduce((min, index) => Math.min(min, index), Infinity)
//         const maxIndex = Array.from(columnFormatters.keys())
//             .reduce((max, index) => Math.max(max, index), -Infinity)
//
//         if (minIndex < minValidIndex) {
//             throw Error(`Column formatter indexes must be in [${minValidIndex}, ${maxValidIndex}); found index: ${minIndex}`)
//         }
//         if (maxIndex > maxValidIndex) {
//             throw Error(`Column formatter indexes must be in [${minValidIndex}, ${maxValidIndex}); found index: ${maxIndex}`)
//         }
//
//         // convert all the elements to strings using the column formatters supplied
//         const formattedColumns = this.tableData.data.columnSlices().map((column, index) => {
//             // grab the formatter for the column, or if no formatter exists, grab a default formatter
//             const formatter: (value: V) => string = columnFormatters.get(index) || defaultFormatter<V>
//             // format the column, accounting for the possible column header
//             if (this.tableData.hasColumnHeaders) {
//                 const adjustedColumn = column.slice(1).map(value => formatter(value))
//                 adjustedColumn.unshift(defaultFormatter(column[0]))
//                 return adjustedColumn
//             }
//             return column.map(value => formatter(value))
//         })
//
//         // return DataFrame.fromColumnData<string>(formattedColumns)
//         //     .map(df => ({
//         //         data: df,
//         //         hasRowHeaders: this.tableData.hasRowHeaders,
//         //         hasColumnHeaders: this.tableData.hasColumnHeaders,
//         //         hasFooter: this.tableData.hasFooter,
//         //     }))
//         //     .getOrThrow()
//         const formattedTableData = DataFrame.fromColumnData<string>(formattedColumns)
//             .map(df => ({
//                 data: df,
//                 hasRowHeaders: this.tableData.hasRowHeaders,
//                 hasColumnHeaders: this.tableData.hasColumnHeaders,
//                 hasFooter: this.tableData.hasFooter,
//             }))
//             .getOrThrow()
//
//         return new TableDataFormatterBuilder<string>(formattedTableData)
//     }
// }