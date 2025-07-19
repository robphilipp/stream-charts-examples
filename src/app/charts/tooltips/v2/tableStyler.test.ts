import {TableData} from "./tableData";
import {DataFrame} from "data-frame-ts"
import {defaultFormatter} from "../tableData";
import {TableFormatter} from "./tableFormatter";
import {
    CellStyle,
    defaultCellStyle,
    defaultColumnHeaderStyle, defaultFooterStyle,
    defaultRowHeaderStyle,
    FooterStyle,
    StyledTable,
    Styling,
    TableStyler
} from "./tableStyler";
import {ColumnHeaderStyle, defaultTableBorder, defaultTableMargin, defaultTablePadding} from "./tableStyler";
import {defaultTableFont} from "./tableUtils";
import {RowHeaderStyle} from "./tableStyler";


describe('styling data tables', () => {
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
    const footer = ['A', 'B', 'C', 'D', 'E']

    describe('adding basic table styles', () => {
        const formattedTableData = TableData.fromDataFrame<string | number | Date>(data)
            .withColumnHeader(columnHeader)
            .flatMap(td => td.withRowHeader(rowHeader))
            .flatMap(td => td.withFooter(footer))
            .flatMap(td => TableFormatter.fromTableData(td)
                // add the default formatter for the column header, at the highest priority so that
                // it is the one that applies to the row representing the column header
                .addRowFormatter(0, defaultFormatter, 100)
                // formatter for the footer
                .flatMap(tf => tf.addRowFormatter(5, defaultFormatter, 100))
                .flatMap(tf => tf.addColumnFormatter(0, defaultFormatter, 100))
                // add the column formatters for each column at the default (lowest) priority
                .flatMap(tf => tf.addColumnFormatter(1, value => (value as Date).toLocaleDateString()))
                .flatMap(tf => tf.addColumnFormatter(2, value => defaultFormatter(value)))
                .flatMap(tf => tf.addColumnFormatter(4, value => `$ ${(value as number).toFixed(2)}`))
                .flatMap(tf => tf.addColumnFormatter(5, value => `${(value as number).toFixed(0)}`))
                .flatMap(tf => tf.addCellFormatter(3, 3, value => (value as string).toUpperCase(), 1))
                // format the table into a new TableData object
                .flatMap(tf => tf.formatTable())
            )
            .getOrThrow()

        describe('set and retrieve global table styles', () => {

            const styledTable: StyledTable<string> = TableStyler.fromTableData(formattedTableData)
                .withTableBackground({color: 'grey', opacity: 0.15})
                .withTableFont({color: 'blue', size: 13.5})
                .withBorder({opacity: 0})
                .withDimensions(1300, 500)
                .withPadding({top: 10})
                .withMargin({left: 10, right: 10})
                .styleTable()

            test('should be able to retrieve the background', () => {
                expect(styledTable.tableBackground()).toEqual({color: 'grey', opacity: 0.15})
            })

            test('should be able to retrieve the font', () => {
                expect(styledTable.tableFont()).toEqual({...defaultTableFont, color: 'blue', size: 13.5})
            })

            test('should be able to retrieve the border', () => {
                expect(styledTable.tableBorder()).toEqual({...defaultTableBorder, opacity: 0})
            })

            test('should be able to retrieve the dimensions', () => {
                expect(styledTable.tableDimensions()).toEqual({width: 1300, height: 500})
            })

            test('should be able to retrieve the padding', () => {
                expect(styledTable.tablePadding()).toEqual({...defaultTablePadding, top: 10})
            })

            test('should be able to retrieve the margin', () => {
                expect(styledTable.tableMargin()).toEqual({...defaultTableMargin, left: 10, right: 10})
            })
        })

        test('should be able to set and retrieve style for the column header', () => {
            const styledTable: StyledTable<string> = TableStyler.fromTableData(formattedTableData)
                .withColumnHeaderStyle({font: {...defaultTableFont, size: 16, weight: 800}})
                .styleTable()

            expect(styledTable.columnHeaderStyle().getOrThrow()).toEqual({
                style: {
                    ...defaultColumnHeaderStyle,
                    font: {...defaultTableFont, size: 16, weight: 800},
                },
                priority: Infinity
            } as Styling<ColumnHeaderStyle>)
        })

        test('should be able to set and retrieve style for the row header', () => {
            const styledTable: StyledTable<string> = TableStyler.fromTableData(formattedTableData)
                .withRowHeaderStyle({font: {...defaultTableFont, size: 16, weight: 800}})
                .styleTable()

            expect(styledTable.rowHeaderStyle().getOrThrow()).toEqual({
                style: {
                    ...defaultRowHeaderStyle,
                    font: {...defaultTableFont, size: 16, weight: 800},
                },
                priority: Infinity
            } as Styling<RowHeaderStyle>)
        })

        test('should be able to set and retrieve style for the footer', () => {
            const styledTable: StyledTable<string> = TableStyler.fromTableData(formattedTableData)
                .withFooterStyle({font: {...defaultTableFont, size: 16, weight: 800}})
                .styleTable()

            expect(styledTable.footerStyle().getOrThrow()).toEqual({
                style: {
                    ...defaultFooterStyle,
                    font: {...defaultTableFont, size: 16, weight: 800},
                },
                priority: Infinity
            } as Styling<FooterStyle>)
        })

        describe('retrieve the cell style with highest priority', () => {
            const styledTable: StyledTable<string> = TableStyler.fromTableData(formattedTableData)
                .withColumnHeaderStyle({font: {...defaultTableFont, size: 16, weight: 800}})
                .withCellStyle(2, 3, {font: {...defaultTableFont, size: 12, weight: 600}}, 100)
                .withRowStyle(2, {font: {...defaultTableFont, size: 14, weight: 700}}, 50)
                .withRowHeaderStyle({font: {...defaultTableFont, size: 15, weight: 650}})
                .styleTable()

            function expectDefaultCellStyleFor(row: number, column: number) {
                expect(styledTable.stylesFor(row, column).getOrThrow()).toEqual(defaultCellStyle)
            }

            test('should get the default cell style for cells with no available style', () => {
                const unstyledRows = [1, 3, 4, 5]   // row 0 is the column header, row 2 has a row-style
                const unstyledColumns = [1, 2, 3, 4, 5] // column 0 is the row header
                for (const row of unstyledRows) {
                    for (const column of unstyledColumns) {
                        expectDefaultCellStyleFor(row, column)
                    }
                }
            })

            test('should get cell style for (2, 3) is the highest priority', () => {
                expect(styledTable.stylesFor(2, 3).getOrThrow()).toEqual({
                    ...defaultCellStyle,
                    font: {...defaultTableFont, size: 12, weight: 600},
                } as CellStyle)
            })

            test('should get column header style for (0, 3) is the highest priority', () => {
                // column header style for (0, 3) is the highest priority
                expect(styledTable.stylesFor(0, 3).getOrThrow()).toEqual({
                    ...defaultCellStyle,
                    font: {...defaultTableFont, size: 16, weight: 800},
                } as CellStyle)
            })

            test('should return a failure when getting a style for a column index that is too large', () => {
                const result = styledTable.stylesFor(1, 6)
                expect(result.failed).toBeTruthy()
                expect(result.error).toEqual("(StyledTable::stylesFor) Invalid row and/or column index; row_index: 1; column_index: 6; valid_row_index: [0, 6); valid_column_index: [0, 6)")
            })

            test('should return a failure when getting a style for a column index that is less than 0', () => {
                const result = styledTable.stylesFor(3, -1)
                expect(result.failed).toBeTruthy()
                expect(result.error).toEqual("(StyledTable::stylesFor) Invalid row and/or column index; row_index: 3; column_index: -1; valid_row_index: [0, 6); valid_column_index: [0, 6)")

            })

            test('should return a failure when getting a style for a row index that is less than 0', () => {
                const result = styledTable.stylesFor(-1, 3)
                expect(result.failed).toBeTruthy()
                expect(result.error).toEqual("(StyledTable::stylesFor) Invalid row and/or column index; row_index: -1; column_index: 3; valid_row_index: [0, 6); valid_column_index: [0, 6)")
            })

            test('should return a failure when getting a style for a row index that is too large', () => {
                const result = styledTable.stylesFor(6, 3)
                expect(result.failed).toBeTruthy()
                expect(result.error).toEqual("(StyledTable::stylesFor) Invalid row and/or column index; row_index: 6; column_index: 3; valid_row_index: [0, 6); valid_column_index: [0, 6)")
            })

            test('should get the row header style for (1, 0) because table has row header style', () => {
                expect(styledTable.stylesFor(1, 0).getOrThrow()).toEqual({
                    ...defaultCellStyle,
                    font: {...defaultTableFont, size: 15, weight: 650}
                } as CellStyle)
            })
        })
    })
})