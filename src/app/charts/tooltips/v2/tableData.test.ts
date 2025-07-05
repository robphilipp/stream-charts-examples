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
        const tableData = createTableData<string>(data)
            .withColumnHeader(columnHeader)
            .flatMap(table => table.withRowHeader(rowHeader))
            .getOrThrow()
        expect(tableData.hasColumnHeader()).toBeTruthy()
        expect(tableData.tableRowCount()).toBe(4 + 1)
        expect(tableData.dataRowCount()).toBe(4)
        expect(tableData.hasFooter()).toBeFalsy()
        expect(tableData.tableColumnCount()).toEqual(5 + 1)
        expect(tableData.dataColumnCount()).toEqual(5)

        expect(tableData.columnHeader().getOrThrow()).toEqual(['A', 'B', 'C', 'D', 'E'])
        expect(tableData.rowHeader().getOrThrow()).toEqual(['one', 'two', 'three', 'four'])
        expect(tableData.footer().getOrElse([])).toEqual([])
        expect(tableData.data().getOrThrow().rowSlices()).toEqual(data.rowSlices())
    });

    test('should be able to create a simple table from row data with a footer', () => {
        const columnHeader = ['A', 'B', 'C', 'D', 'E']
        const rowHeader = ['one', 'two', 'three', 'four']
        const footer = ['a10', 'b10', 'c10', 'd10', 'e10']
        const data = DataFrame.from([
            ['a1', 'b1', 'c1', 'd1', 'e1'],
            ['a2', 'b2', 'c2', 'd2', 'e2'],
            ['a3', 'b3', 'c3', 'd3', 'e3'],
            ['a4', 'b4', 'c4', 'd4', 'e4'],
        ]).getOrThrow()
        const tableData = createTableData<string>(data)
            .withColumnHeader(columnHeader)
            .flatMap(table => table.withFooter(footer))
            .flatMap(table => table.withRowHeader(rowHeader))
            .getOrThrow()
        expect(tableData.hasColumnHeader()).toBeTruthy()
        expect(tableData.tableRowCount()).toBe(/*data*/ 4 + /*header*/ 1 + /*footer*/ 1)
        expect(tableData.hasFooter()).toBeTruthy()
        expect(tableData.tableColumnCount()).toEqual(/*data*/ 5 + /*header*/ 1)

        expect(tableData.columnHeader().getOrThrow()).toEqual(columnHeader)
        expect(tableData.rowHeader().getOrThrow()).toEqual(rowHeader)
        expect(tableData.footer().getOrThrow()).toEqual(footer)
        expect(tableData.data().getOrThrow().rowSlices()).toEqual(data.rowSlices())
    });

    test('should be able to create a simple table from row data with a footer 2', () => {
        const columnHeader = ['A', 'B', 'C', 'D', 'E']
        const rowHeader = ['one', 'two', 'three', 'four']
        const footer = ['a10', 'b10', 'c10', 'd10', 'e10']
        const data = DataFrame.from([
            ['a1', 'b1', 'c1', 'd1', 'e1'],
            ['a2', 'b2', 'c2', 'd2', 'e2'],
            ['a3', 'b3', 'c3', 'd3', 'e3'],
            ['a4', 'b4', 'c4', 'd4', 'e4'],
        ]).getOrThrow()
        const tableData = createTableData<string>(data)
            .withColumnHeader(columnHeader)
            .flatMap(table => table.withRowHeader(rowHeader))
            .flatMap(table => table.withFooter(footer))
            .getOrThrow()
        expect(tableData.hasColumnHeader()).toBeTruthy()
        expect(tableData.tableRowCount()).toBe(/*data*/ 4 + /*header*/ 1 + /*footer*/ 1)
        expect(tableData.hasFooter()).toBeTruthy()
        expect(tableData.tableColumnCount()).toEqual(/*data*/ 5 + /*header*/ 1)

        expect(tableData.columnHeader().getOrThrow()).toEqual(columnHeader)
        expect(tableData.rowHeader().getOrThrow()).toEqual(rowHeader)
        expect(tableData.footer().getOrThrow()).toEqual(footer)
        expect(tableData.data().getOrThrow().rowSlices()).toEqual(data.rowSlices())
    });

    test('should be able to create a simple table from row data with a footer 3', () => {
        const columnHeader = ['A', 'B', 'C', 'D', 'E']
        const rowHeader = ['one', 'two', 'three', 'four']
        const footer = ['a10', 'b10', 'c10', 'd10', 'e10']
        const data = DataFrame.from([
            ['a1', 'b1', 'c1', 'd1', 'e1'],
            ['a2', 'b2', 'c2', 'd2', 'e2'],
            ['a3', 'b3', 'c3', 'd3', 'e3'],
            ['a4', 'b4', 'c4', 'd4', 'e4'],
        ]).getOrThrow()
        const tableData = createTableData<string>(data)
            .withFooter(footer)
            .flatMap(table => table.withColumnHeader(columnHeader))
            .flatMap(table => table.withRowHeader(rowHeader))
            .getOrThrow()
        expect(tableData.hasColumnHeader()).toBeTruthy()
        expect(tableData.tableRowCount()).toBe(/*data*/ 4 + /*header*/ 1 + /*footer*/ 1)
        expect(tableData.hasFooter()).toBeTruthy()
        expect(tableData.tableColumnCount()).toEqual(/*data*/ 5 + /*header*/ 1)

        expect(tableData.columnHeader().getOrThrow()).toEqual(columnHeader)
        expect(tableData.rowHeader().getOrThrow()).toEqual(rowHeader)
        expect(tableData.footer().getOrThrow()).toEqual(footer)
        expect(tableData.data().getOrThrow().rowSlices()).toEqual(data.rowSlices())
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
        const tableData = createTableData<string>(data)
            .withColumnHeader(columnHeader)
            .flatMap(table => table.withFooter(footer))
            .flatMap(table => table.withRowHeader(rowHeader))
            .getOrThrow()
        expect(tableData.hasColumnHeader()).toBeTruthy()
        expect(tableData.tableRowCount()).toBe(/*data*/ 4 + /*header*/ 1 + /*footer*/ 1)
        expect(tableData.hasFooter()).toBeTruthy()
        expect(tableData.tableColumnCount()).toEqual(/*data*/ 5 + /*header*/ 1)

        expect(tableData.columnHeader().getOrThrow()).toEqual(columnHeader)
        expect(tableData.rowHeader().getOrThrow()).toEqual(rowHeader)
        expect(tableData.footer().getOrThrow()).toEqual(footer)
        expect(tableData.data().getOrThrow().equals(data)).toBeTruthy()
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
        const tableData = createTableData<string>(data)
            .withColumnHeader(columnHeader)
            .flatMap(table => table.withRowHeader(rowHeader))
            .getOrThrow()
        expect(tableData.hasRowHeader()).toBeTruthy()
        expect(tableData.tableRowCount()).toEqual(5 + 1) // the thing is transposed
        expect(tableData.hasFooter()).toBeFalsy()
        expect(tableData.tableColumnCount()).toEqual(4 + 1)

        expect(tableData.columnHeader().getOrThrow()).toEqual(columnHeader)
        expect(tableData.rowHeader().getOrThrow()).toEqual(rowHeader)
        expect(tableData.data().getOrThrow().equals(data)).toBeTruthy()
    });

    test('should be able to create a simple table from column data without a footer 2', () => {
        const columnHeader = ['A', 'B', 'C', 'D'];
        const rowHeader = ['one', 'two', 'three', 'four', 'five']
        const data = DataFrame.fromColumnData([
            ['a1', 'b1', 'c1', 'd1', 'e1'],
            ['a2', 'b2', 'c2', 'd2', 'e2'],
            ['a3', 'b3', 'c3', 'd3', 'e3'],
            ['a4', 'b4', 'c4', 'd4', 'e4'],
        ]).getOrThrow()
        const tableData = createTableData<string>(data)
            .withRowHeader(rowHeader)
            .flatMap(table => table.withColumnHeader(columnHeader))
            .getOrThrow()
        expect(tableData.hasRowHeader()).toBeTruthy()
        expect(tableData.tableRowCount()).toEqual(5 + 1) // the thing is transposed
        expect(tableData.hasFooter()).toBeFalsy()
        expect(tableData.tableColumnCount()).toEqual(4 + 1)

        expect(tableData.columnHeader().getOrThrow()).toEqual(columnHeader)
        expect(tableData.rowHeader().getOrThrow()).toEqual(rowHeader)
        expect(tableData.data().getOrThrow().equals(data)).toBeTruthy()
    });

    test('should be able to create a table from column data without a footer', () => {
        const header = ['A', 'B', 'C', 'D'];
        const data = DataFrame.fromColumnData<string | number>([
            ['a1', 'b1', 'c1', 'd1', 'e1'],
            [10, 20, 30, 40, 50],
            ['a3', 'b3', 'c3', 'd3', 'e3'],
            ['a4', 'b4', 'c4', 'd4', 'e4'],
        ]).getOrThrow()
        const tableData = createTableData<string | number>(data)
            .withColumnHeader(header)
            .getOrThrow()
        expect(tableData.tableRowCount()).toBe(6)
        expect(tableData.hasFooter()).toBeFalsy()
        expect(tableData.tableColumnCount()).toEqual(4)

        expect(tableData.columnHeader().getOrThrow()).toEqual(header)
        expect(tableData.data().getOrThrow().equals(data)).toBeTruthy()
    });

    test('should throw error when the data dimensions are inconsistent with the header dimensions', () => {
        let result = DataFrame.from([['a1'], ['a2']])
            .map(df => createTableData<string>(df))
            .flatMap(table => table.withColumnHeader(['a', 'b']))
        expect(result.failed).toBeTruthy()
        expect(result.error).toEqual("(DataFrame::insertRowBefore) The row must have the same number of elements as the data has columns. num_rows: 2; num_columns: 2")

        result = DataFrame.fromColumnData([['a1'], ['a2'], ['a3']])
            .map(df => createTableData<string>(df))
            .flatMap(table => table.withColumnHeader(['a', 'b']))
        expect(result.failed).toBeTruthy()
        expect(result.error).toEqual("(DataFrame::insertRowBefore) The row must have the same number of elements as the data has columns. num_rows: 1; num_columns: 2")
    })

    test('should throw error when the rows do not all have the same number of columns', () => {
        let result = DataFrame.from([['a1', 'a2'], ['b2']])
            .map(df => createTableData<string>(df))
            .flatMap(table => table.withColumnHeader(['a', 'b']))
        expect(result.failed).toBeTruthy()
        expect(result.error).toEqual("(DataFrame.validateDimensions) All rows must have the same number of columns; min_num_columns: 1, maximum_columns: 2")

        result = DataFrame.fromColumnData([['a1'], ['a2', 'b2']])
            .map(df => createTableData<string>(df))
            .flatMap(table => table.withColumnHeader(['a', 'b']))
        expect(result.failed).toBeTruthy()
        expect(result.error).toEqual("(DataFrame.validateDimensions) All columns must have the same number of rows; min_num_rows: 1, maximum_rows: 2")
    })

    test('should be able to create a table of numbers when no formatter is specified', () => {
        const tableData = createTableData<number>(DataFrame.from([[11, 12, 13], [21, 22, 23]]).getOrThrow())
        expect(tableData.tableRowCount()).toEqual(2)
        expect(tableData.data().flatMap(df => df.rowSlice(0).map(row => row.length)).getOrThrow()).toEqual(3)
        expect(tableData.data().flatMap(df => df.rowSlice(1).map(row => row.length)).getOrThrow()).toEqual(3)
    })

    describe('creating tables with mixed data types', () => {
        function dateTimeFor(day: number, hour: number): Date {
          return new Date(2021, 1, day, hour, 0, 0, 0);
        }

        const data = DataFrame.from<string | number | Date>([
            [dateTimeFor(1, 1), 12345, 'gnm-f234', 123.45,  4],
            [dateTimeFor(2, 2), 23456, 'gnm-g234',  23.45,  5],
            [dateTimeFor(3, 3), 34567, 'gnm-h234',   3.65, 40],
            [dateTimeFor(4, 4), 45678, 'gnm-i234', 314.15,  9],
        ]).getOrThrow()

        test('should be able to create a table with string headers and numeric values', () => {
            const columnHeader = ['Date-Time', 'Customer ID', 'Product ID', 'Purchase Price', 'Amount']

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

            const tableData = createTableData<string | number | Date>(data)
                .withColumnHeader(columnHeader)
                .getOrThrow()

            expect(tableData.data().map(df => df.equals(expected)).getOrThrow()).toBeTruthy()
            expect(tableData.tableColumnCount()).toEqual(5)
            expect(tableData.tableRowCount()).toEqual(/*data*/4 + /*header*/ 1)
            expect(tableData.hasColumnHeader()).toBeTruthy()
            expect(tableData.hasRowHeader()).toBeFalsy()
            expect(tableData.hasFooter()).toBeFalsy()
        })

        test('should be able to create a table with string column and row headers and numeric values', () => {
            const columnHeader = ['Date-Time', 'Customer ID', 'Product ID', 'Purchase Price', 'Amount']
            const rowHeader = [1, 2, 3, 4]

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

            const tableData = createTableData<string | number | Date>(data)
                .withColumnHeader(columnHeader)
                .flatMap(table => table.withRowHeader(rowHeader))
                .getOrThrow()

            expect(tableData.data().map(df => df.equals(expected)).getOrThrow()).toBeTruthy()
            expect(tableData.tableColumnCount()).toEqual(/*data*/ 5 + /*row-header*/ 1)
            expect(tableData.tableRowCount()).toEqual(/*data*/ 4 + /*column-header*/ 1)
            expect(tableData.hasColumnHeader()).toBeTruthy()
            expect(tableData.hasRowHeader()).toBeTruthy()
            expect(tableData.hasFooter()).toBeFalsy()
        })
    })
})