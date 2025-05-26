import {CellCoordinate, ColumnCoordinate, newCellTag, newColumnTag, newRowTag, newTag, RowCoordinate} from './tags'

describe('tags', () => {
    describe('creating tags', () => {
        test('test', () => {
            const tag = newTag<string, RowCoordinate>("mytag", "nicetag", RowCoordinate.of(0))
            expect(tag).toBeDefined()
            expect(tag.id).toBe("tag-mytag-(0,*)")
            expect(tag.name).toBe("mytag")
            expect(tag.value).toBe("nicetag")
            expect(tag.coordinate).toEqual(RowCoordinate.of(0))
            expect(tag.toString()).toBe("mytag:nicetag:(0,*)")
        })
    })

    describe('querying tags', () => {
        test('test', () => {
            const tag = newTag<string, RowCoordinate>("my-tag", "nice-tag", RowCoordinate.of(0))
            expect(tag.meetsCondition(name => name === "my-tag")).toBeTruthy()
        })
    })


    describe("Testing tag classes", () => {
        describe("Testing factory methods for creating tags of various types", () => {
            test("should be able to create a new row tag", () => {
                const tag = newRowTag<string>("headers-name", "header-value", RowCoordinate.of(3))
                expect(tag.id).toEqual(`tag-headers-name-(3,*)`)
                expect(tag.name).toEqual("headers-name")
                expect(tag.value).toEqual("header-value")
            })

            test("should be able to create a new column tag", () => {
                const tag = newColumnTag<string>("headers-name", "header-value", ColumnCoordinate.of(3))
                expect(tag.id).toEqual(`tag-headers-name-(*,3)`)
                expect(tag.name).toEqual("headers-name")
                expect(tag.value).toEqual("header-value")
            })

            test("should be able to create a new cell tag", () => {
                const tag = newTag<string, CellCoordinate>("headers-name", "header-value", CellCoordinate.of(3, 14))
                expect(tag.id).toEqual(`tag-headers-name-(3,14)`)
                expect(tag.name).toEqual("headers-name")
                expect(tag.value).toEqual("header-value")
            })

            test("should be able to create a new cell tag", () => {
                const tag = newCellTag<string>("headers-name", "header-value", CellCoordinate.of(3, 14))
                expect(tag.id).toEqual(`tag-headers-name-(3,14)`)
                expect(tag.name).toEqual("headers-name")
                expect(tag.value).toEqual("header-value")
            })
        })

        describe("Testing adding tags to the Tags object", () => {

        })
    })
})