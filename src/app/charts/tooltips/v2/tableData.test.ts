import {DataFrame} from "data-frame-ts"
import {TableData} from "./tableData";


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
        const tableData = TableData.fromDataFrame<string>(data)
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
        const tableData = TableData.fromDataFrame<string>(data)
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
        const tableData = TableData.fromDataFrame<string>(data)
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
        const tableData = TableData.fromDataFrame<string>(data)
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
        const tableData = TableData.fromDataFrame<string>(data)
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
        const tableData = TableData.fromDataFrame<string>(data)
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
        const tableData = TableData.fromDataFrame<string>(data)
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
        const tableData = TableData.fromDataFrame<string | number>(data)
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
            .map(df => TableData.fromDataFrame<string>(df))
            .flatMap(table => table.withColumnHeader(['a', 'b']))
        expect(result.failed).toBeTruthy()
        expect(result.error).toEqual("(DataFrame::insertRowBefore) The row must have the same number of elements as the data has columns. num_rows: 2; num_columns: 2")

        result = DataFrame.fromColumnData([['a1'], ['a2'], ['a3']])
            .map(df => TableData.fromDataFrame<string>(df))
            .flatMap(table => table.withColumnHeader(['a', 'b']))
        expect(result.failed).toBeTruthy()
        expect(result.error).toEqual("(DataFrame::insertRowBefore) The row must have the same number of elements as the data has columns. num_rows: 1; num_columns: 2")
    })

    test('should throw error when the rows do not all have the same number of columns', () => {
        let result = DataFrame.from([['a1', 'a2'], ['b2']])
            .map(df => TableData.fromDataFrame<string>(df))
            .flatMap(table => table.withColumnHeader(['a', 'b']))
        expect(result.failed).toBeTruthy()
        expect(result.error).toEqual("(DataFrame.validateDimensions) All rows must have the same number of columns; min_num_columns: 1, maximum_columns: 2")

        result = DataFrame.fromColumnData([['a1'], ['a2', 'b2']])
            .map(df => TableData.fromDataFrame<string>(df))
            .flatMap(table => table.withColumnHeader(['a', 'b']))
        expect(result.failed).toBeTruthy()
        expect(result.error).toEqual("(DataFrame.validateDimensions) All columns must have the same number of rows; min_num_rows: 1, maximum_rows: 2")
    })

    test('should be able to create a table of numbers when no formatter is specified', () => {
        const tableData = TableData.fromDataFrame<number>(DataFrame.from([[11, 12, 13], [21, 22, 23]]).getOrThrow())
        expect(tableData.tableRowCount()).toEqual(2)
        expect(tableData.data().flatMap(df => df.rowSlice(0).map(row => row.length)).getOrThrow()).toEqual(3)
        expect(tableData.data().flatMap(df => df.rowSlice(1).map(row => row.length)).getOrThrow()).toEqual(3)
    })

    describe('retrieving information about the table', () => {
        const columnHeader = ['A', 'B', 'C', 'D', 'E']
        const rowHeader = ['one', 'two', 'three', 'four']
        const footer = ['a10', 'b10', 'c10', 'd10', 'e10']
        const data = DataFrame.from([
            ['a1', 'b1', 'c1', 'd1', 'e1'],
            ['a2', 'b2', 'c2', 'd2', 'e2'],
            ['a3', 'b3', 'c3', 'd3', 'e3'],
            ['a4', 'b4', 'c4', 'd4', 'e4'],
        ]).getOrThrow()

        const tableData = TableData.fromDataFrame<string>(data)
            .withColumnHeader(columnHeader)
            .flatMap(table => table.withRowHeader(rowHeader))
            .flatMap(table => table.withFooter(footer))
            .getOrThrow()

        test("should be able to get the column header", () => {
            expect(tableData.columnHeader().getOrThrow()).toEqual(columnHeader)
        })

        test("should be able to get the row header", () => {
            expect(tableData.rowHeader().getOrThrow()).toEqual(rowHeader)
        })

        test("should be able to get the footer", () => {
            expect(tableData.footer().getOrThrow()).toEqual(footer)
        })

        test("should be able to get the data", () => {
            expect(tableData.data().getOrThrow().equals(data)).toBeTruthy()
        })

        test("should be able to get the table row count", () => {
            expect(tableData.tableRowCount()).toEqual(4 + 1 + 1) // data + column_header + footer
        })

        test("should be able to get the table column count", () => {
            expect(tableData.tableColumnCount()).toEqual(5 + 1) // data + row_header
        })

        test("should be able to determine whether the table has a column header", () => {
            expect(tableData.hasColumnHeader()).toBeTruthy()
        })

        test("should be able to determine whether the table has a row header", () => {
            expect(tableData.hasRowHeader()).toBeTruthy()
        })

        test("should be able to determine whether the table has a footer", () => {
            expect(tableData.hasFooter()).toBeTruthy()
        })
    })
})