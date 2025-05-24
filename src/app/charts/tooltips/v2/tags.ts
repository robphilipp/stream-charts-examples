import {failureResult, Result, successResult} from "result-fn";

export interface TagCoordinate {
    equals: (other: TagCoordinate) => boolean
    toString: () => string
}

export interface TagValue {
    toString: () => string
}

type TagPredicate<V extends TagValue, C extends TagCoordinate> = (name: string, value: V, coordinate: C) => boolean
export type Tag<V extends TagValue, C extends TagCoordinate> = {
    readonly id: string
    readonly name: string
    readonly value: V
    readonly coordinate: C
    meetsCondition: (predicate: TagPredicate<V, C>) => boolean
    toString: () => string
    // meetsCondition: (predicate: (value: TagValue) => boolean) => TagValue | undefined
    // map: <T>(transform: (value: TagValue) => T) => T
    // equals: (other: TagValue) => boolean
}

export type RowTag<T extends TagValue> = Tag<T, RowCoordinate>
export type ColumnTag<T extends TagValue> = Tag<T, ColumnCoordinate>
export type CellTag<T extends TagValue> = Tag<T, CellCoordinate>

export function newTag<V extends TagValue, C extends TagCoordinate>(
    name: string,
    value: V,
    coordinate: C
): Tag<V, C> {

    return {
        id: `tag-${name}-${coordinate.toString().replace(/ /g, "")}`,
        name,
        value,
        coordinate,
        meetsCondition: predicate => predicate(name, value, coordinate),
        toString: () => `${name}:${value.toString()}:${coordinate.toString().replace(/ /g, "")}`
    }
}

export function newRowTag<T extends TagValue>(name: string, value: T, coordinate: RowCoordinate): RowTag<T> {
    return newTag<T, RowCoordinate>(name, value, coordinate)
}

export function newColumnTag<T extends TagValue>(name: string, value: T, coordinate: ColumnCoordinate): ColumnTag<T> {
    return newTag<T, ColumnCoordinate>(name, value, coordinate)
}

export function newCellTag<T extends TagValue>(name: string, value: T, coordinate: CellCoordinate): CellTag<T> {
    return newTag<T, CellCoordinate>(name, value, coordinate)
}

// export interface Taggable<V extends TagValue, C extends TagCoordinate> {
//     addTag(name: string, value: V, coordinate: C): string
//
//     removeTag(id: string): void
//
//     hasTag(name: string): boolean
//
//     hasTagFor(name: string, coordinate: C): boolean
//
//     uniqueTagFor(name: string, coordinate: C): Result<Tag<V, C>, string>
//
//     tagsFor(coordinate: C): Array<Tag<V, C>>
// }
//
// export interface WithTags<O, T extends TagValue, C extends TagCoordinate> extends Taggable<T, C> {
//     thingBeingTagged: O
//     tags: Tags<T, C>
// }

export class Tags<T extends TagValue, C extends TagCoordinate> {
    private readonly tags: Array<Tag<T, C>>

    constructor() {
        this.tags = []
    }

    public hasTagFor(name: string, coordinate: C): boolean {
        return this.tags.some(tag => tag.name === name && tag.coordinate.equals(coordinate))
    }

    public hasTag(name: string): boolean {
        return this.tags.some(tag => tag.name === name)
    }

    public tagFor(name: string, coordinate: C): Result<Tag<T, C>, string> {
        return this.uniqueTagFor(name, coordinate).map(tag => tag)
    }

    public idForTag(name: string, coordinate: C): Result<string, string> {
        return this.uniqueTagFor(name, coordinate).map(tag => tag.id)
    }

    public addTag(name: string, value: T, coordinate: C): Tag<T, C> {
        return this.tagFor(name, coordinate)
            .getOr(() => {
                const tag = newTag(name, value, coordinate)
                this.tags.push(tag)
                return tag
            })
    }

    public removeTag(id: string): void {
        const index = this.tags.findIndex(tag => tag.id === id)
        if (index >= 0) {
            this.tags.splice(index, 1)
        }
    }

    public tagsFor(coordinate: C): Array<Tag<T, C>> {
        return this.tags.filter(tag => tag.coordinate.equals(coordinate))
    }

    public uniqueTagFor(name: string, coordinate: C): Result<Tag<T, C>, string> {
        const tags = this.tags.filter(tag => tag.name === name && tag.coordinate.equals(coordinate))
        if (tags.length === 0) {
            return failureResult(`No tag with name ${name} found for coordinate ${coordinate.toString}`)
        }
        if (tags.length > 1) {
            return failureResult(`Multiple tags with name ${name} found for coordinate ${coordinate.toString}`)
        }
        return successResult(tags[0])
    }
}

export type RowTags<T extends TagValue> = Tags<T, RowCoordinate>
export type ColumnTags<T extends TagValue> = Tags<T, ColumnCoordinate>
export type CellTags<T extends TagValue> = Tags<T, CellCoordinate>

export class RowCoordinate implements TagCoordinate {
    private constructor(private readonly row: number) {
    }

    public static of(row: number): RowCoordinate {
        return new RowCoordinate(row)
    }

    public equals(other: TagCoordinate): boolean {
        return other instanceof RowCoordinate && this.row === other.row
    }

    public toString(): string {
        return `(${this.row}, *)`
    }
}

export class ColumnCoordinate implements TagCoordinate {
    private constructor(private readonly column: number) {
    }

    public static of(column: number): ColumnCoordinate {
        return new ColumnCoordinate(column)
    }

    public equals(other: TagCoordinate): boolean {
        return other instanceof ColumnCoordinate && this.column === other.column
    }

    public toString(): string {
        return `(*, ${this.column})`
    }
}

export class CellCoordinate implements TagCoordinate {
    private constructor(private readonly row: number, private readonly column: number) {
    }

    public static of(row: number, column: number): CellCoordinate {
        return new CellCoordinate(row, column)
    }

    public equals(other: TagCoordinate): boolean {
        return other instanceof CellCoordinate && this.row === other.row && this.column === other.column
    }

    public toString(): string {
        return `(${this.row}, ${this.column})`
    }
}
