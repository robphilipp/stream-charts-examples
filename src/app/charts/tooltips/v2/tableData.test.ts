import {createTableData, defaultFormatter, TableData} from "./tableData";
import {DataFrame} from "data-frame-ts"

describe('creating and manipulating table data', () => {

    test('should be able to create a simple table from row data without a footer', () => {
        const columnHeader = ['A', 'B', 'C', 'D', 'E']
        const rowHeader = ['one', 'two', 'three', 'four']
        const data = DataFrame.from([
            ['a1', 'b1', 'c1', 'd1', 'e1'],
            ['a2', 'b2', 'c2', 'd2', 'e2'],
            ['a3', 'b3', 'c3', 'd3', 'e3'],
            ['a4', 'b4', 'c4', 'd4', 'e4'],
        ]).getOrThrow()
        const tableData = createTableData<string>()
            .withColumnHeader(columnHeader)
            .withRowHeader(rowHeader)
            .withData(data)
            .withoutFooter()
            .withoutFormatData()
        expect(tableData.hasColumnHeaders).toBeTruthy()
        expect(tableData.data.rowCount()).toBe(4 + 1)
        expect(tableData.hasFooter).toBeFalsy()
        expect(tableData.data.columnCount()).toEqual(5 + 1)

        expect(tableData.data.rowSlice(0).getOrThrow()).toEqual([     undefined, 'A', 'B', 'C', 'D', 'E'])
        expect(tableData.data.rowSlice(1).getOrThrow()).toEqual([  'one', 'a1', 'b1', 'c1', 'd1', 'e1'])
        expect(tableData.data.rowSlice(2).getOrThrow()).toEqual([  'two', 'a2', 'b2', 'c2', 'd2', 'e2'])
        expect(tableData.data.rowSlice(3).getOrThrow()).toEqual(['three', 'a3', 'b3', 'c3', 'd3', 'e3'])
        expect(tableData.data.rowSlice(4).getOrThrow()).toEqual([ 'four', 'a4', 'b4', 'c4', 'd4', 'e4'])
    });

    test('should be able to create a simple table from row data with a footer', () => {
        const columnHeader = ['A', 'B', 'C', 'D', 'E']
        const rowHeader = ['one', 'two', 'three', 'four']
        const footer = ['total', 'a10', 'b10', 'c10', 'd10', 'e10']
        const data = DataFrame.from([
            ['a1', 'b1', 'c1', 'd1', 'e1'],
            ['a2', 'b2', 'c2', 'd2', 'e2'],
            ['a3', 'b3', 'c3', 'd3', 'e3'],
            ['a4', 'b4', 'c4', 'd4', 'e4'],
        ]).getOrThrow()
        const tableData = createTableData<string>()
            .withColumnHeader(columnHeader)
            .withRowHeader(rowHeader)
            .withData(data)
            .withFooter(footer)
            .withoutFormatData()
        expect(tableData.hasColumnHeaders).toBeTruthy()
        expect(tableData.data.rowCount()).toBe(/*data*/ 4 + /*header*/ 1 + /*footer*/ 1)
        expect(tableData.hasFooter).toBeTruthy()
        expect(tableData.data.columnCount()).toEqual(/*data*/ 5 + /*header*/ 1)

        expect(tableData.data.rowSlice(0).getOrThrow()).toEqual([ undefined, 'A', 'B', 'C', 'D', 'E'])
        expect(tableData.data.rowSlice(1).getOrThrow()).toEqual([     'one', 'a1', 'b1', 'c1', 'd1', 'e1'])
        expect(tableData.data.rowSlice(2).getOrThrow()).toEqual([     'two', 'a2', 'b2', 'c2', 'd2', 'e2'])
        expect(tableData.data.rowSlice(3).getOrThrow()).toEqual([   'three', 'a3', 'b3', 'c3', 'd3', 'e3'])
        expect(tableData.data.rowSlice(4).getOrThrow()).toEqual([    'four', 'a4', 'b4', 'c4', 'd4', 'e4'])
        expect(tableData.data.rowSlice(5).getOrThrow()).toEqual([   'total', 'a10', 'b10', 'c10', 'd10', 'e10'])
    });

    test('should be able to create a simple table from row data with a footer with no header', () => {
        const columnHeader = ['A', 'B', 'C', 'D', 'E']
        const rowHeader = ['one', 'two', 'three', 'four']
        const footer = ['a10', 'b10', 'c10', 'd10', 'e10']
        const data = DataFrame.from([
            ['a1', 'b1', 'c1', 'd1', 'e1'],
            ['a2', 'b2', 'c2', 'd2', 'e2'],
            ['a3', 'b3', 'c3', 'd3', 'e3'],
            ['a4', 'b4', 'c4', 'd4', 'e4'],
        ]).getOrThrow()
        const tableData = createTableData<string>()
            .withColumnHeader(columnHeader)
            .withRowHeader(rowHeader)
            .withData(data)
            .withFooter(footer)
            .withoutFormatData()
        expect(tableData.hasColumnHeaders).toBeTruthy()
        expect(tableData.data.rowCount()).toBe(/*data*/ 4 + /*header*/ 1 + /*footer*/ 1)
        expect(tableData.hasFooter).toBeTruthy()
        expect(tableData.data.columnCount()).toEqual(/*data*/ 5 + /*header*/ 1)

        expect(tableData.data.rowSlice(0).getOrThrow()).toEqual([ undefined, 'A', 'B', 'C', 'D', 'E'])
        expect(tableData.data.rowSlice(1).getOrThrow()).toEqual([     'one', 'a1', 'b1', 'c1', 'd1', 'e1'])
        expect(tableData.data.rowSlice(2).getOrThrow()).toEqual([     'two', 'a2', 'b2', 'c2', 'd2', 'e2'])
        expect(tableData.data.rowSlice(3).getOrThrow()).toEqual([   'three', 'a3', 'b3', 'c3', 'd3', 'e3'])
        expect(tableData.data.rowSlice(4).getOrThrow()).toEqual([    'four', 'a4', 'b4', 'c4', 'd4', 'e4'])
        expect(tableData.data.rowSlice(5).getOrThrow()).toEqual([ undefined, 'a10', 'b10', 'c10', 'd10', 'e10'])
    });

    test('should be able to create a simple table from column data without a footer', () => {
        const columnHeader = ['A', 'B', 'C', 'D'];
        const rowHeader = ['one', 'two', 'three', 'four', 'five']
        const data = DataFrame.fromColumnData([
            ['a1', 'b1', 'c1', 'd1', 'e1'],
            ['a2', 'b2', 'c2', 'd2', 'e2'],
            ['a3', 'b3', 'c3', 'd3', 'e3'],
            ['a4', 'b4', 'c4', 'd4', 'e4'],
        ]).getOrThrow()
        const tableData = createTableData<string>()
            .withColumnHeader(columnHeader)
            .withRowHeader(rowHeader)
            .withData(data)
            .withoutFooter()
            .withoutFormatData()
        expect(tableData.hasRowHeaders).toBeTruthy()
        expect(tableData.data.rowCount()).toEqual(5 + 1) // the thing is transposed
        expect(tableData.hasFooter).toBeFalsy()
        expect(tableData.data.columnCount()).toEqual(4 + 1)

        expect(tableData.data.rowSlice(0).getOrThrow()).toEqual([undefined, 'A', 'B', 'C', 'D'])
        expect(tableData.data.rowSlice(1).getOrThrow()).toEqual(['one', 'a1', 'a2', 'a3', 'a4'])
        expect(tableData.data.rowSlice(2).getOrThrow()).toEqual(['two', 'b1', 'b2', 'b3', 'b4'])
        expect(tableData.data.rowSlice(3).getOrThrow()).toEqual(['three', 'c1', 'c2', 'c3', 'c4'])
        expect(tableData.data.rowSlice(4).getOrThrow()).toEqual(['four', 'd1', 'd2', 'd3', 'd4'])
        expect(tableData.data.rowSlice(5).getOrThrow()).toEqual(['five', 'e1', 'e2', 'e3', 'e4'])

    });

    test('should be able to create a table from column data without a footer', () => {
        const header = ['A', 'B', 'C', 'D'];
        const data = DataFrame.fromColumnData<string | number>([
            ['a1', 'b1', 'c1', 'd1', 'e1'],
            [10, 20, 30, 40, 50],
            ['a3', 'b3', 'c3', 'd3', 'e3'],
            ['a4', 'b4', 'c4', 'd4', 'e4'],
        ]).getOrThrow()
        const tableData = createTableData<string | number>()
            .withColumnHeader(header)
            .withoutRowHeader()
            .withData(data)
            .withoutFooter()
            .withoutFormatData()
        expect(tableData.data.rowCount()).toBe(6)
        expect(tableData.hasFooter).toBeFalsy()
        expect(tableData.data.columnCount()).toEqual(4)

        expect(tableData.data.rowSlice(0).getOrThrow()).toEqual(['A', 'B', 'C', 'D'])
        expect(tableData.data.rowSlice(1).getOrThrow()).toEqual(['a1', 10, 'a3', 'a4'])
        expect(tableData.data.rowSlice(2).getOrThrow()).toEqual(['b1', 20, 'b3', 'b4'])
        expect(tableData.data.rowSlice(3).getOrThrow()).toEqual(['c1', 30, 'c3', 'c4'])
        expect(tableData.data.rowSlice(4).getOrThrow()).toEqual(['d1', 40, 'd3', 'd4'])
        expect(tableData.data.rowSlice(5).getOrThrow()).toEqual(['e1', 50, 'e3', 'e4'])
    });

    test('should throw error when the data dimensions are inconsistent with the header dimensions', () => {
        expect(
            () => createTableData<string>()
                .withColumnHeader(['a', 'b'])
                .withoutRowHeader()
                .withData(DataFrame.from([['a1'], ['a2']]).getOrThrow())
                .withoutFooter()
        ).toThrow("The data must have the same number of columns as the column header. Cannot construct table data.num_header_columns: 2; num_data_columns: 1")

        expect(
            () => createTableData<string>()
                .withColumnHeader(['a', 'b'])
                .withoutRowHeader()
                .withData(DataFrame.fromColumnData([['a1'], ['a2'], ['a3']]).getOrThrow())
                .withoutFooter())
            .toThrow("The data must have the same number of columns as the column header. Cannot construct table data.num_header_columns: 2; num_data_columns: 3")
    })

    test('should throw error when the rows do not all have the same number of columns', () => {
        expect(
            () => createTableData<string>()
                .withColumnHeader(['a', 'b'])
                .withoutRowHeader()
                .withData(DataFrame.from([['a1', 'a2'], ['b2']]).getOrThrow())
                .withoutFooter()
        ).toThrow("All rows must have the same number of columns; min_num_columns: 1, maximum_columns: 2")

        expect(
            () => createTableData<string>()
                .withColumnHeader(['a', 'b'])
                .withoutRowHeader()
                .withData(DataFrame.fromColumnData([['a1'], ['a2', 'b2']]).getOrThrow())
                .withoutFooter()
        ).toThrow("All columns must have the same number of rows; min_num_rows: 1, maximum_rows: 2")
    })

    test('should be able to create a table of numbers when no formatter is specified', () => {
        const tableData = createTableData<number>()
            .withoutHeaders()
            .withData(DataFrame.from([[11, 12, 13], [21, 22, 23]]).getOrThrow())
            .withoutFooter()
            .withoutFormatData()
        expect(tableData.data.rowCount()).toEqual(2)
        expect(tableData.data.rowSlice(0).map(row => row.length).getOrDefault(-1)).toEqual(3)
        expect(tableData.data.rowSlice(1).map(row => row.length).getOrDefault(-1)).toEqual(3)
    })

    describe('creating tables with mixed data types', () => {
        function dateTime(day: number, hour: number): Date {
          return new Date(2021, 1, day, hour, 0, 0, 0);
        }

        test('should be able to create a table with string headers and numeric values', () => {
            const columnHeader = ['Date-Time', 'Customer ID', 'Product ID', 'Purchase Price', 'Amount']

            const data = DataFrame.from<string | number | Date>([
                [dateTime(1, 1), 12345, 'gnm-f234', 123.45,  4],
                [dateTime(2, 2), 23456, 'gnm-g234',  23.45,  5],
                [dateTime(3, 3), 34567, 'gnm-h234',   3.65, 40],
                [dateTime(4, 4), 45678, 'gnm-i234', 314.15,  9],
            ]).getOrThrow()

            const expected = DataFrame.from<string | number | Date>([
                ['Date-Time', 'Customer ID', 'Product ID', 'Purchase Price', 'Amount'],
                ['2/1/2021', '12345', 'gnm-f234', '$ 123.45',  '4'],
                ['2/2/2021', '23456', 'gnm-g234',  '$ 23.45',  '5'],
                ['2/3/2021', '34567', 'gnm-h234',   '$ 3.65', '40'],
                ['2/4/2021', '45678', 'gnm-i234', '$ 314.15',  '9'],
            ]).getOrThrow()

            const formatters = new Map<number, (value: any) => string>([
                [0, (value: Date) => value.toLocaleDateString()],
                [1, (value: number) => defaultFormatter(value)],
                [3, (value: number) => `$ ${value.toFixed(2)}`],
                [4, (value: number) => `${value.toFixed(0)}`],
            ])

            const tableData: TableData<string> = createTableData<string | number | Date>()
                .withColumnHeader(columnHeader)
                .withoutRowHeader()
                .withData(data)
                .withoutFooter()
                .withFormatData(formatters)

            expect(tableData.data).toEqual(expected)
            expect(tableData.data.columnCount()).toEqual(5)
            expect(tableData.data.rowCount()).toEqual(/*data*/4 + /*header*/ 1)
            expect(tableData.hasColumnHeaders).toBeTruthy()
            expect(tableData.hasRowHeaders).toBeFalsy()
            expect(tableData.hasFooter).toBeFalsy()
        })

        test('should be able to create a table with string column and row headers and numeric values', () => {
            const columnHeader = ['Date-Time', 'Customer ID', 'Product ID', 'Purchase Price', 'Amount']
            const rowHeader = [1, 2, 3, 4]

            const data = DataFrame.from<string | number | Date>([
                [dateTime(1, 1), 12345, 'gnm-f234', 123.45,  4],
                [dateTime(2, 2), 23456, 'gnm-g234',  23.45,  5],
                [dateTime(3, 3), 34567, 'gnm-h234',   3.65, 40],
                [dateTime(4, 4), 45678, 'gnm-i234', 314.15,  9],
            ]).getOrThrow()

            const expected = DataFrame.from<string | number | Date>([
                ['', 'Date-Time', 'Customer ID', 'Product ID', 'Purchase Price', 'Amount'],
                ['1', '2/1/2021', '12345', 'gnm-f234', '$ 123.45',  '4'],
                ['2', '2/2/2021', '23456', 'gnm-g234',  '$ 23.45',  '5'],
                ['3', '2/3/2021', '34567', 'gnm-h234',   '$ 3.65', '40'],
                ['4', '2/4/2021', '45678', 'gnm-i234', '$ 314.15',  '9'],
            ]).getOrThrow()

            // the column index for the formatter must be adjusted for the row-header
            const formatters = new Map<number, (value: any) => string>([
                [1, (value: Date) => value.toLocaleDateString()],
                [2, (value: number) => defaultFormatter(value)],
                [4, (value: number) => `$ ${value.toFixed(2)}`],
            ])

            const tableData: TableData<string> = createTableData<string | number | Date>()
                .withColumnHeader(columnHeader)
                .withRowHeader(rowHeader)
                .withData(data)
                .withoutFooter()
                .withFormatData(formatters)

            expect(tableData.data).toEqual(expected)
            expect(tableData.data.columnCount()).toEqual(/*data*/ 5 + /*row-header*/ 1)
            expect(tableData.data.rowCount()).toEqual(/*data*/ 4 + /*column-header*/ 1)
            expect(tableData.hasColumnHeaders).toBeTruthy()
            expect(tableData.hasRowHeaders).toBeTruthy()
            expect(tableData.hasFooter).toBeFalsy()
        })
    })
})