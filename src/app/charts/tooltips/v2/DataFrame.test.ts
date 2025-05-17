import {
    CellCoordinate,
    ColumnCoordinate,
    DataFrame,
    newCellTag,
    newColumnTag,
    newRowTag,
    newTag,
    RowCoordinate
} from "./DataFrame";

describe("Testing data-frame behavior", () => {
    describe("Creating data-frames", () => {

        test("should create a data-frame when dimensions are valid", () => {
            const result = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ])
            expect(result.succeeded).toBe(true)
        })

        test("should not create a data-frame when dimensions are invalid", () => {
            const result = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12, 13]
            ])
            expect(result.failed).toBe(true)
        })

        test("should be able to create a data-frame for a 2D array in columnar form", () => {
            const result = DataFrame.fromColumnData([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ]).getOrThrow()
            const expected = DataFrame.from([
                [1, 4, 7, 10],
                [2, 5, 8, 11],

            ]).getOrThrow()
            expect(result.equals(expected)).toBe(true)
            expect(result.rowCount()).toEqual(3)
            expect(result.columnCount()).toEqual(4)
        })

        test("should not be able to create a data-frame for a 2D array in columnar form with invalid dimensions", () => {
            const result = DataFrame.fromColumnData([
                [1, 2, 3], // column 1
                [4, 5, 6], // column 2
                [7, 8, 9], // column 3
                [10, 11, 12, 13]  // column 4, which has 4 rows instead of 3
            ])
            expect(result.failed).toBe(true)
            expect(result.error).toEqual("All columns must have the same number of rows; min_num_rows: 3, maximum_rows: 4")
        })
    })

    describe("Getting data from data-frames", () => {

        test("should get dimensions from a data-frame", () => {
            const result = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ])
            expect(result.map(df => df.rowCount()).getOrThrow()).toEqual(4)
            expect(result.map(df => df.columnCount()).getOrThrow()).toEqual(3)
        })

        test("should retrieve element values when dimensions are valid (2, 2)", () => {
            const result = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ])
            expect(result.andThen(df => df.elementAt(2, 2)).getOrThrow()).toEqual(9)
        })

        test("should retrieve element values when dimensions are valid (0, 0)", () => {
            const result = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ])
            expect(result.andThen(df => df.elementAt(0, 0)).getOrThrow()).toEqual(1)
        })

        test("should retrieve element values when dimensions are valid (0, 2)", () => {
            const result = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ])
            expect(result.andThen(df => df.elementAt(0, 2)).getOrThrow()).toEqual(3)
        })

        test("should retrieve element values when dimensions are valid (3, 0)", () => {
            const result = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ])
            expect(result.andThen(df => df.elementAt(3, 0)).getOrThrow()).toEqual(10)
        })

        test("should retrieve element values when dimensions are valid (3, 2)", () => {
            const result = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ])
            expect(result.andThen(df => df.elementAt(3, 2)).getOrThrow()).toEqual(12)
        })

        test("should retrieve row at row index", () => {
            const result = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ])
            expect(result.andThen(df => df.rowSlice(2)).getOrThrow()).toEqual([7, 8, 9])
        })

        test("should not retrieve row if the row index is out of bounds", () => {
            const result = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ])
            expect(result.andThen(df => df.rowSlice(10)).failed).toBe(true)
        })

        test("should retrieve column at column index", () => {
            const result = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ])
            expect(result.andThen(df => df.columnsSlice(1)).getOrThrow()).toEqual([2, 5, 8, 11])
        })

        test("should be able to retrieve all the columns as slices", () => {
            const dataFrame = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
            ]).getOrThrow()
            const colSlices: Array<Array<number>> = dataFrame.columnSlices()
            expect(colSlices.length).toEqual(3)
            expect(colSlices[0]).toEqual([1, 4, 7])
            expect(colSlices[1]).toEqual([2, 5, 8])
            expect(colSlices[2]).toEqual([3, 6, 9])
        })

        test("copy should equal itself", () => {
            const dataFrame = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ]).getOrThrow()
            const copied = dataFrame.copy()
            expect(copied.equals(dataFrame)).toBe(true)
        })
    })

    describe("Testing updates to the data-frame", () => {
        test("should be able to get an updated a data-frame without changing the original", () => {
            const dataFrame = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ]).getOrThrow()
            const updated = dataFrame.setElementAt(1, 3, 1000).getOrThrow()
            expect(updated.elementAt(1, 3).getOrThrow()).toEqual(1000)
            expect(updated.equals(dataFrame)).toBe(false)
        })

        test("should be able to insert a row at beginning", () => {
            const dataFrame = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ]).getOrThrow()
            const updated = dataFrame.insertRowBefore(0, [100, 200, 300]).getOrThrow()
            expect(updated.rowCount()).toEqual(5)
            const expected = DataFrame.from([
                [100, 200, 300],
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ]).getOrThrow()
            expect(updated.equals(expected)).toBe(true)
            expect(updated.equals(dataFrame)).toBe(false)
        })

        test("should be able to insert a row before end", () => {
            const dataFrame = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ]).getOrThrow()
            const updated = dataFrame.insertRowBefore(3, [100, 200, 300]).getOrThrow()
            expect(updated.rowCount()).toEqual(5)
            const expected = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [100, 200, 300],
                [10, 11, 12]
            ]).getOrThrow()
            expect(updated.equals(expected)).toBe(true)
            expect(updated.equals(dataFrame)).toBe(false)
        })

        test("should be able to insert a row at end", () => {
            const dataFrame = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ]).getOrThrow()
            const updated = dataFrame.pushRow([100, 200, 300]).getOrThrow()
            expect(updated.rowCount()).toEqual(5)
            const expected = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12],
                [100, 200, 300]
            ]).getOrThrow()
            expect(updated.equals(expected)).toBe(true)
            expect(updated.equals(dataFrame)).toBe(false)
        })

        test("should be able to delete a row from front", () => {
            const dataFrame = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ]).getOrThrow()
            const updated = dataFrame.deleteRowAt(0).getOrThrow()
            expect(updated.rowCount()).toEqual(3)
            const expected = DataFrame.from([
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ]).getOrThrow()
            expect(updated.equals(expected)).toBe(true)
            expect(updated.equals(dataFrame)).toBe(false)
        })

        test("should be able to delete a row from middle", () => {
            const dataFrame = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ]).getOrThrow()
            const updated = dataFrame.deleteRowAt(2).getOrThrow()
            expect(updated.rowCount()).toEqual(3)
            const expected = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [10, 11, 12]
            ]).getOrThrow()
            expect(updated.equals(expected)).toBe(true)
            expect(updated.equals(dataFrame)).toBe(false)
        })

        test("should be able to delete a row from end", () => {
            const dataFrame = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ]).getOrThrow()
            const updated = dataFrame.deleteRowAt(3).getOrThrow()
            expect(updated.rowCount()).toEqual(3)
            const expected = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
            ]).getOrThrow()
            expect(updated.equals(expected)).toBe(true)
            expect(updated.equals(dataFrame)).toBe(false)
        })

        test("should be able to insert a column at beginning", () => {
            const dataFrame = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ]).getOrThrow()
            const updated = dataFrame.insertColumnBefore(0, [100, 200, 300, 400]).getOrThrow()
            expect(updated.columnCount()).toEqual(4)
            const expected = DataFrame.from([
                [100, 1, 2, 3],
                [200, 4, 5, 6],
                [300, 7, 8, 9],
                [400, 10, 11, 12]
            ]).getOrThrow()
            expect(updated.equals(expected)).toBe(true)
            expect(updated.equals(dataFrame)).toBe(false)
        })

        test("should be able to insert a column at the end", () => {
            const dataFrame = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ]).getOrThrow()
            const updated = dataFrame.pushColumn([100, 200, 300, 400]).getOrThrow()
            expect(updated.columnCount()).toEqual(4)
            const expected = DataFrame.from([
                [1, 2, 3, 100],
                [4, 5, 6, 200],
                [7, 8, 9, 300],
                [10, 11, 12, 400]
            ]).getOrThrow()
            expect(updated.equals(expected)).toBe(true)
            expect(updated.equals(dataFrame)).toBe(false)
        })

        test("should be able to delete a column from beginning", () => {
            const dataFrame = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ]).getOrThrow()
            const updated = dataFrame.deleteColumnAt(0).getOrThrow()
            expect(updated.columnCount()).toEqual(2)
            const expected = DataFrame.from([
                [2, 3],
                [5, 6],
                [8, 9],
                [11, 12]
            ]).getOrThrow()
            expect(updated.equals(expected)).toBe(true)
            expect(updated.equals(dataFrame)).toBe(false)
        })
    })

    describe("Manipulating data-frames", () => {
        test("should be able to transpose a data-frame", () => {
            const dataFrame = DataFrame.from([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
            ]).getOrThrow()
            const expected = DataFrame.from([
                [1, 4, 7, 10],
                [2, 5, 8, 11],
                [3, 6, 9, 12]
            ]).getOrThrow()
            const transposed = dataFrame.transpose()
            expect(transposed.rowCount()).toEqual(3)
            expect(transposed.columnCount()).toEqual(4)
            expect(transposed.equals(expected)).toBe(true)
        })
    })
})

describe("Testing tag classes", () => {
    describe("Testing factory methods for creating tags of various types", () => {
        test("should be able to create a new row tag", () => {
            const tag = newRowTag<string>("headers-name", "header-value", RowCoordinate.of(3))
            expect(tag.id).toEqual(`tag-headers-name-(3, *)`)
            expect(tag.name).toEqual("headers-name")
            expect(tag.value).toEqual("header-value")
        })

        test("should be able to create a new column tag", () => {
            const tag = newColumnTag<string>("headers-name", "header-value", ColumnCoordinate.of(3))
            expect(tag.id).toEqual(`tag-headers-name-(*, 3)`)
            expect(tag.name).toEqual("headers-name")
            expect(tag.value).toEqual("header-value")
        })

        test("should be able to create a new cell tag", () => {
            const tag = newTag<string, CellCoordinate>("headers-name", "header-value", CellCoordinate.of(3, 14))
            expect(tag.id).toEqual(`tag-headers-name-(3, 14)`)
            expect(tag.name).toEqual("headers-name")
            expect(tag.value).toEqual("header-value")
        })

        test("should be able to create a new cell tag", () => {
            const tag = newCellTag<string>("headers-name", "header-value", CellCoordinate.of(3, 14))
            expect(tag.id).toEqual(`tag-headers-name-(3, 14)`)
            expect(tag.name).toEqual("headers-name")
            expect(tag.value).toEqual("header-value")
        })
    })

    describe("Testing adding tags to the Tags object", () => {

    })
})