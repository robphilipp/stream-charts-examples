import {TableData} from "./tableData";
import {DataFrame} from "data-frame-ts"
import {defaultFormatter} from "../tableData";
import {TableFormatter} from "./tableFormatter";


describe('creating tables with mixed data types', () => {
    function dateTimeFor(day: number, hour: number): Date {
        return new Date(2021, 1, day, hour, 0, 0, 0);
    }

    const data = DataFrame.from<string | number | Date>([
        [dateTimeFor(1, 1), 12345, 'gnm-f234', 123.45, 4],
        [dateTimeFor(2, 2), 23456, 'gnm-g234', 23.45, 5],
        [dateTimeFor(3, 3), 34567, 'gnm-h234', 3.65, 40],
        [dateTimeFor(4, 4), 45678, 'gnm-i234', 314.15, 9],
    ]).getOrThrow()
    const columnHeader = ['Date-Time', 'Customer ID', 'Product ID', 'Purchase Price', 'Amount']
    const rowHeader = [1, 2, 3, 4]

    test('should be able to create a table with string headers and numeric values', () => {

        const expectedData = DataFrame.from<string>([
            ['2/1/2021', '12345', 'gnm-f234', '$ 123.45', '4'],
            ['2/2/2021', '23456', 'gnm-g234', '$ 23.45', '5'],
            ['2/3/2021', '34567', 'GNM-H234', '$ 3.65', '40'],
            ['2/4/2021', '45678', 'gnm-i234', '$ 314.15', '9'],
        ]).getOrThrow()

        const tableData = TableData.fromDataFrame<string | number | Date>(data)
            .withColumnHeader(columnHeader)
            .flatMap(tableData => TableFormatter.fromTableData(tableData)
                // add the default formatter for the column header, at the highest priority so that
                // it is the one that applies to the row representing the column header
                .addRowFormatter(0, defaultFormatter, 100)
                // add the column formatters for each column at the default (lowest) priority
                .flatMap(tf => tf.addColumnFormatter(0, value => (value as Date).toLocaleDateString()))
                .flatMap(tf => tf.addColumnFormatter(1, value => defaultFormatter(value)))
                .flatMap(tf => tf.addColumnFormatter(3, value => `$ ${(value as number).toFixed(2)}`))
                .flatMap(tf => tf.addColumnFormatter(4, value => `${(value as number).toFixed(0)}`))
                .flatMap(tf => tf.addCellFormatter(3, 2, value => (value as string).toUpperCase(), 1))
                // format the table into a new TableData object
                .flatMap(tf => tf.formatTable())
            )
            .getOrThrow()
        
        expect(tableData.columnHeader().getOrThrow()).toEqual(columnHeader)
        expect(tableData.data().map(df => df.equals(expectedData)).getOrThrow()).toBeTruthy()
        expect(tableData.tableColumnCount()).toEqual(5)
        expect(tableData.tableRowCount()).toEqual(/*data*/4 + /*header*/ 1)
        expect(tableData.hasColumnHeader()).toBeTruthy()
        expect(tableData.hasRowHeader()).toBeFalsy()
        expect(tableData.hasFooter()).toBeFalsy()
    })

    test('should be able to create a table with string column and row headers and numeric values', () => {

        const expectedData = DataFrame.from<string>([
            ['2/1/2021', '12345', 'gnm-f234', '$ 123.45', '4'],
            ['2/2/2021', '23456', 'gnm-g234', '$ 23.45', '5'],
            ['2/3/2021', '34567', 'gnm-h234', '$ 3.65', '40'],
            ['2/4/2021', '45678', 'gnm-i234', '$ 314.15', '9'],
        ]).getOrThrow()

        const tableData = TableData.fromDataFrame<string | number | Date>(data)
            .withColumnHeader(columnHeader)
            .flatMap(td => td.withRowHeader(rowHeader))
            .flatMap(tableData => TableFormatter.fromTableData(tableData)
                // add the default formatter for the column header, at the highest priority so that
                // it is the one that applies to the row representing the column header
                .addRowFormatter(0, defaultFormatter, Infinity)
                // add the default formatter for the row header, at the highest priority so that
                // it is the one that applies to the column representing the row header
                .flatMap(tf => tf.addColumnFormatter(0, defaultFormatter, Infinity))
                // add the column formatters for each column at the default (lowest) priority
                // (notice that the columns are shifted by one for the columns because the row-header
                // occupies the first column (index=0))
                .flatMap(tf => tf.addColumnFormatter(1, value => (value as Date).toLocaleDateString()))
                .flatMap(tf => tf.addColumnFormatter(2, value => defaultFormatter(value)))
                .flatMap(tf => tf.addColumnFormatter(4, value => `$ ${(value as number).toFixed(2)}`))
                .flatMap(tf => tf.addColumnFormatter(5, value => `${(value as number).toFixed(0)}`))
                // format the table data and get back a TableData<string>
                .flatMap(tf => tf.formatTable())
            )
            .getOrThrow()

        expect(tableData.columnHeader().getOrThrow()).toEqual(columnHeader)
        expect(tableData.rowHeader().getOrThrow()).toEqual(rowHeader.map(hdr => defaultFormatter(hdr)))
        expect(tableData.data().map(df => df.equals(expectedData)).getOrThrow()).toBeTruthy()
        expect(tableData.tableColumnCount()).toEqual(5 + 1) // data + row-header
        expect(tableData.tableRowCount()).toEqual(4 + 1) // data + column-header
        expect(tableData.hasColumnHeader()).toBeTruthy()
        expect(tableData.hasRowHeader()).toBeTruthy()
        expect(tableData.hasFooter()).toBeFalsy()
    })

    test('should be report failures when formatting function fails', () => {
        const columnHeader = ['Date-Time', 'Customer ID', 'Product ID', 'Purchase Price', 'Amount']

        const result = TableData.fromDataFrame<string | number | Date>(data)
            .withColumnHeader(columnHeader)
            .flatMap(tableData => TableFormatter.fromDataFrame(tableData.unwrapDataFrame())
                // add the default formatter for the column header, at the highest priority so that
                // it is the one that applies to the row representing the column header
                .addRowFormatter(0, defaultFormatter, 100)
                // add a column formatter to the incorrect column (data-type is a number) and attempt to
                // format it as if it where a string. errors will be collected for each format error
                .flatMap(tf => tf.addColumnFormatter(3, value => (value as string).toUpperCase()))
                // format the table data and get back a TableData<string>
                .flatMap(tf => tf.formatTable())
            )

        expect(result.failed).toBeTruthy()
        expect(result.error).toEqual(
            `(TableData::formatTable) Failed to format cell (1, 3); value: 123.45; error: TypeError: value.toUpperCase is not a function
(TableData::formatTable) Failed to format cell (2, 3); value: 23.45; error: TypeError: value.toUpperCase is not a function
(TableData::formatTable) Failed to format cell (3, 3); value: 3.65; error: TypeError: value.toUpperCase is not a function
(TableData::formatTable) Failed to format cell (4, 3); value: 314.15; error: TypeError: value.toUpperCase is not a function
`
        )
    })

})