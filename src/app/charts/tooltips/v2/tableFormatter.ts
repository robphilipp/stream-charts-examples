import {DataFrame, Tag, TagCoordinate, TagValue} from "data-frame-ts";
import {failureResult, Result, successResult} from "result-fn";
import {createTableData, TableData} from "./tableData";

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

export enum TableFormatterType {
    CELL = "cell-formatter",
    COLUMN = "column-formatter",
    ROW = "row-formatter"
}

export function isFormattingTag(tag: Tag<TagValue, TagCoordinate>): boolean {
    return (tag.name === TableFormatterType.COLUMN ||
            tag.name === TableFormatterType.ROW ||
            tag.name === TableFormatterType.CELL) &&
        tag.value.hasOwnProperty("formatter") &&
        tag.value.hasOwnProperty("priority")
}

export function createTableFormatterFrom<V>(tableData: TableData<V>): TableFormatter<V> {
    return new TableFormatter<V>(tableData.unpackDataFrame())
}

export class TableFormatter<V> {
    constructor(private readonly dataFrame: DataFrame<V>) {
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
    addColumnFormatter(columnIndex: number, formatter: Formatter<V>, priority: number = 0): Result<TableFormatter<V>, string> {
        return this.dataFrame
            .tagColumn<Formatting<V>>(columnIndex, TableFormatterType.COLUMN, {formatter, priority})
            .map(data => new TableFormatter<V>(data))
    }

    addRowFormatter(rowIndex: number, formatter: Formatter<V>, priority: number = 0): Result<TableFormatter<V>, string> {
        return this.dataFrame
            .tagRow<Formatting<V>>(rowIndex, TableFormatterType.ROW, {formatter, priority})
            .map(data => new TableFormatter<V>(data))
    }

    addCellFormatter(rowIndex: number, columnIndex: number, formatter: Formatter<V>, priority: number = 0): Result<TableFormatter<V>, string> {
        return this.dataFrame
            .tagCell(rowIndex, columnIndex, TableFormatterType.CELL, {formatter, priority})
            .map(data => new TableFormatter<V>(data))
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
        return this.formatTableInto<C, TableData<string>>(dataFrame => createTableData<string>(dataFrame))
    }

    formatTableInto<C extends TagCoordinate, D = TableData<string>>(mapper: (dataFrame: DataFrame<string>) => D): Result<D, string> {
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
            return successResult(mapper(formattedDataFrame))
        }
        return failureResult(formattingFailures.concat('').join('\n'))
    }
}