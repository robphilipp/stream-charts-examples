import {SvgTable} from "./table";
import defaultFormatter = SvgTable.defaultFormatter;

describe('creating and manipulating table data', () => {

    test('should be able to create a simple table from row data without a footer', () => {
        const header = ['A', 'B', 'C', 'D', 'E'];
        const data = [
            ['a1', 'b1', 'c1', 'd1', 'e1'],
            ['a2', 'b2', 'c2', 'd2', 'e2'],
            ['a3', 'b3', 'c3', 'd3', 'e3'],
            ['a4', 'b4', 'c4', 'd4', 'e4'],
        ]
        const tableData = SvgTable.Data.withHeader(header).withDataAsRow(data).withoutFooter()
        expect(tableData.header).toHaveLength(5)
        expect(tableData.data).toHaveLength(4)
        expect(tableData.footer).toHaveLength(0)

        expect(tableData.data[0]).toEqual(['a1', 'b1', 'c1', 'd1', 'e1'])
        expect(tableData.data[1]).toEqual(['a2', 'b2', 'c2', 'd2', 'e2'])
        expect(tableData.data[2]).toEqual(['a3', 'b3', 'c3', 'd3', 'e3'])
        expect(tableData.data[3]).toEqual(['a4', 'b4', 'c4', 'd4', 'e4'])
    });

    test('should be able to create a simple table from column data without a footer', () => {
        const header = ['A', 'B', 'C', 'D'];
        const data = [
            ['a1', 'b1', 'c1', 'd1', 'e1'],
            ['a2', 'b2', 'c2', 'd2', 'e2'],
            ['a3', 'b3', 'c3', 'd3', 'e3'],
            ['a4', 'b4', 'c4', 'd4', 'e4'],
        ]
        const tableData = SvgTable.Data.withHeader(header).withDataAsColumns(data).withoutFooter()
        expect(tableData.header).toHaveLength(4)
        expect(tableData.data).toHaveLength(5)
        expect(tableData.footer).toHaveLength(0)

        expect(tableData.data[0]).toEqual(['a1', 'a2', 'a3', 'a4'])
        expect(tableData.data[1]).toEqual(['b1', 'b2', 'b3', 'b4'])
        expect(tableData.data[2]).toEqual(['c1', 'c2', 'c3', 'c4'])
        expect(tableData.data[3]).toEqual(['d1', 'd2', 'd3', 'd4'])
        expect(tableData.data[4]).toEqual(['e1', 'e2', 'e3', 'e4'])

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
        const tableData = SvgTable.Data.withHeader(header).withDataAsColumns(data).withoutFooter()
        expect(tableData.header).toHaveLength(4)
        expect(tableData.data).toHaveLength(5)
        expect(tableData.footer).toHaveLength(0)

        expect(tableData.data[0]).toEqual(['a1', '1', 'a3', 'a4'])
        expect(tableData.data[1]).toEqual(['b1', '2', 'b3', 'b4'])
        expect(tableData.data[2]).toEqual(['c1', '3', 'c3', 'c4'])
        expect(tableData.data[3]).toEqual(['d1', '4', 'd3', 'd4'])
        expect(tableData.data[4]).toEqual(['e1', '5', 'e3', 'e4'])

    });
})