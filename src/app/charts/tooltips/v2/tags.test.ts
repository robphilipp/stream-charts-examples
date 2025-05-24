import {newTag, RowCoordinate} from './tags'

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
})