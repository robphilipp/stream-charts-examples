import {createTableData} from "./tableData";
import {DataFrame} from "./DataFrame";

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
        expect(tableData.data.rowCount()).toEqual(2)
        expect(tableData.data.rowSlice(0).map(row => row.length).getOrDefault(-1)).toEqual(3)
        expect(tableData.data.rowSlice(1).map(row => row.length).getOrDefault(-1)).toEqual(3)
    })
})