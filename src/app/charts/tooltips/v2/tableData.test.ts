import {createTableData} from "./tableData";

describe('creating and manipulating table data', () => {

    test('should be able to create a simple table from row data without a footer', () => {
        const columnHeader = ['A', 'B', 'C', 'D', 'E']
        const rowHeader = ['one', 'two', 'three', 'four']
        const data = [
            ['a1', 'b1', 'c1', 'd1', 'e1'],
            ['a2', 'b2', 'c2', 'd2', 'e2'],
            ['a3', 'b3', 'c3', 'd3', 'e3'],
            ['a4', 'b4', 'c4', 'd4', 'e4'],
        ]
        const tableData = createTableData().withColumnHeader(columnHeader).withRowHeader(rowHeader).withDataAsRow(data).withoutFooter()
        expect(tableData.hasColumnHeaders).toBeTruthy()
        expect(tableData.numRows()).toBe(data.length + 1)
        expect(tableData.hasFooter).toBeFalsy()
        expect(tableData.numColumns()).toEqual(data[0].length + 1)

        expect(tableData.data[0]).toEqual([     '', 'A', 'B', 'C', 'D', 'E'])
        expect(tableData.data[1]).toEqual([  'one', 'a1', 'b1', 'c1', 'd1', 'e1'])
        expect(tableData.data[2]).toEqual([  'two', 'a2', 'b2', 'c2', 'd2', 'e2'])
        expect(tableData.data[3]).toEqual(['three', 'a3', 'b3', 'c3', 'd3', 'e3'])
        expect(tableData.data[4]).toEqual([ 'four', 'a4', 'b4', 'c4', 'd4', 'e4'])
    });

    test('should be able to create a simple table from column data without a footer', () => {
        const columnHeader = ['A', 'B', 'C', 'D'];
        const rowHeader = ['one', 'two', 'three', 'four', 'five']
        const data = [
            ['a1', 'b1', 'c1', 'd1', 'e1'],
            ['a2', 'b2', 'c2', 'd2', 'e2'],
            ['a3', 'b3', 'c3', 'd3', 'e3'],
            ['a4', 'b4', 'c4', 'd4', 'e4'],
        ]
        const tableData = createTableData()
            .withColumnHeader(columnHeader)
            .withRowHeader(rowHeader)
            .withDataAsColumns(data)
            .withoutFooter()
        expect(tableData.hasRowHeaders).toBeTruthy()
        expect(tableData.numRows()).toEqual(data[0].length + 1)
        expect(tableData.hasFooter).toBeFalsy()
        expect(tableData.numColumns()).toEqual(data.length + 1)

        expect(tableData.data[0]).toEqual(['', 'A', 'B', 'C', 'D'])
        expect(tableData.data[1]).toEqual(['one', 'a1', 'a2', 'a3', 'a4'])
        expect(tableData.data[2]).toEqual(['two', 'b1', 'b2', 'b3', 'b4'])
        expect(tableData.data[3]).toEqual(['three', 'c1', 'c2', 'c3', 'c4'])
        expect(tableData.data[4]).toEqual(['four', 'd1', 'd2', 'd3', 'd4'])
        expect(tableData.data[5]).toEqual(['five', 'e1', 'e2', 'e3', 'e4'])

    });

    test('should be able to create a table from column data without a footer', () => {
        const header = [
            {name: 'a', label: 'A'},
            {name: 'b', label: 'B', formatter: (value: number) => `${value / 10}`},
            {name: 'c', label: 'C'},
            {name: 'd', label: 'D'},
        ];
        const data = [
            ['a1', 'b1', 'c1', 'd1', 'e1'],
            [10, 20, 30, 40, 50],
            ['a3', 'b3', 'c3', 'd3', 'e3'],
            ['a4', 'b4', 'c4', 'd4', 'e4'],
        ]
        const tableData = createTableData()
            .withColumnHeader(header)
            .withoutRowHeader()
            .withDataAsColumns(data)
            .withoutFooter()
        expect(tableData.numRows()).toBe(data[0].length + 1)
        expect(tableData.hasFooter).toBeFalsy()
        expect(tableData.numColumns()).toEqual(data.length)

        expect(tableData.data[0]).toEqual(['A', 'B', 'C', 'D'])
        expect(tableData.data[1]).toEqual(['a1', '1', 'a3', 'a4'])
        expect(tableData.data[2]).toEqual(['b1', '2', 'b3', 'b4'])
        expect(tableData.data[3]).toEqual(['c1', '3', 'c3', 'c4'])
        expect(tableData.data[4]).toEqual(['d1', '4', 'd3', 'd4'])
        expect(tableData.data[5]).toEqual(['e1', '5', 'e3', 'e4'])
    });

    test('should throw error when the data dimensions are inconsistent with the header dimensions', () => {
        expect(
            () => createTableData()
                .withColumnHeader(['a', 'b'])
                .withoutRowHeader()
                .withDataAsRow([['a1'], ['a2']])
                .withoutFooter()
        ).toThrow("The data must have the same number of columns as the header. Cannot construct table data.num_header_columns: 2; num_data_columns: 1")

        expect(
            () => createTableData()
                .withColumnHeader(['a', 'b'])
                .withoutRowHeader()
                .withDataAsColumns([['a1'], ['a2'], ['a3']])
                .withoutFooter())
            .toThrow("The data must have the same number of columns as the header. Cannot construct table data.num_header_columns: 2; num_data_columns: 3")
    })

    test('should throw error when the rows do not all have the same number of columns', () => {
        expect(
            () => createTableData()
                .withColumnHeader(['a', 'b'])
                .withoutRowHeader()
                .withDataAsRow([['a1', 'a2'], ['b2']])
                .withoutFooter()
        ).toThrow("All rows must have the same number of columns. Cannot construct table data. num_columns: [2,1]")

        expect(
            () => createTableData()
                .withColumnHeader(['a', 'b'])
                .withoutRowHeader()
                .withDataAsColumns([['a1'], ['a2', 'b2']])
                .withoutFooter()
        ).toThrow("All data columns must have the same number of rows. Cannot construct table data.num_rows: [1,2]")
    })

    test('should be able to create a table of numbers when no formatter is specified', () => {
        const tableData = createTableData()
            .withoutHeaders()
            .withDataAsRow([[11, 12, 13], [21, 22, 23]])
            .withoutFooter()
        expect(tableData.data.length).toEqual(2)
        expect(tableData.data[0].length).toEqual(3)
        expect(tableData.data[1].length).toEqual(3)
    })
})