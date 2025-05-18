import {failureResult, Result, successResult} from "result-fn";

export interface TagCoordinate {
    equals: (other: TagCoordinate) => boolean
    toString: () => string
}

export interface TagValue {
    toString: () => string
}

export type Tag<V extends TagValue, C extends TagCoordinate>  = {
    readonly id: string
    readonly name: string
    readonly value: V
    readonly coordinate: C
    // meetsCondition: (predicate: (value: TagValue) => boolean) => TagValue | undefined
    // map: <T>(transform: (value: TagValue) => T) => T
    // equals: (other: TagValue) => boolean
}

export type RowTag<T extends TagValue> = Tag<T, RowCoordinate>
export type ColumnTag<T extends TagValue> = Tag<T, ColumnCoordinate>
export type CallTag<T extends TagValue> = Tag<T, CellCoordinate>

export function newTag<V extends TagValue, C extends TagCoordinate>(name: string, value: V, coordinate: C): Tag<V, C> {
    return {
        id: `tag-${name}-${coordinate.toString()}`,
        name,
        value,
        coordinate
    }
}

export interface Taggable<V extends TagValue, C extends TagCoordinate> {
    addTag(name: string, value: V, coordinate: C): string
    removeTag(id: string): void
    hasTag(name: string): boolean
    hasTagFor(name: string, coordinate: C): boolean
    uniqueTagFor(name: string, coordinate: C): Result<Tag<V, C>, string>
    tagsFor(coordinate: C): Array<Tag<V, C>>
}

export interface WithTags<O, T extends TagValue, C extends TagCoordinate> extends Taggable<T, C> {
    thingBeingTagged: O
    tags: Tags<T, C>
}

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

    public idForTag(name: string, coordinate: C): Result<string, string> {
        return this.uniqueTagFor(name, coordinate).map(tag => tag.id)
    }

    public addTag(name: string, value: T, coordinate: C): string {
        return this.idForTag(name, coordinate)
            .onFailure(() => {
                const tag = newTag(name, value, coordinate)
                this.tags.push(tag)
                return tag.id
            })
            .getOrThrow()
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
    private constructor(private readonly row: number) {}

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

export function newRowTag<T extends TagValue>(name: string, value: T, coordinate: RowCoordinate): Tag<T, RowCoordinate> {
    return newTag<T, RowCoordinate>(name, value, coordinate)
}

export class ColumnCoordinate implements TagCoordinate {
    private constructor(private readonly column: number) {}

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

export function newColumnTag<T extends TagValue>(name: string, value: T, coordinate: ColumnCoordinate): Tag<T, ColumnCoordinate> {
    return newTag<T, ColumnCoordinate>(name, value, coordinate)
}

export class CellCoordinate implements TagCoordinate {
    private constructor(private readonly row: number, private readonly column: number) {}

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

export function newCellTag<T extends TagValue>(name: string, value: T, coordinate: CellCoordinate): Tag<T, CellCoordinate> {
    return newTag<T, CellCoordinate>(name, value, coordinate)
}

/**
 * Represents a two-dimensional data structure, `DataFrame`, that allows for manipulation
 * and querying of tabular data in a row-major format. The `DataFrame` is immutable for
 * immutable objects. Modifications to the rows, columns, or elements will not modify the
 * original `DataFrame`, but rather return a modified copy of the `DataFrame`.
 *
 * @template V Type of the elements stored in the data structure.
 */
export class DataFrame<V> {
    private readonly data: Array<V>
    private readonly numColumns: number
    private readonly numRows: number
    private readonly rowTags: Tags<TagValue, RowCoordinate> = new Tags<TagValue, RowCoordinate>()
    private readonly columnTags: Tags<TagValue, ColumnCoordinate> = new Tags<TagValue, ColumnCoordinate>()
    private readonly cellTags: Tags<TagValue, CellCoordinate> = new Tags<TagValue, CellCoordinate>()

    /**
     * Constructs an instance of the class with the given data, number of rows, and number of columns.
     *
     * @param data The data to initialize the instance with.
     * @param numRows The number of rows.
     * @param numColumns The number of columns.
     */
    private constructor(data: Array<V>, numRows: number, numColumns: number) {
        this.data = data
        this.numRows = numRows
        this.numColumns = numColumns
    }

    /**
     * Creates a DataFrame from a 2D array of data.
     *
     * @param data A two-dimensional array representing the data. When {@link rowForm} is true (the default value),
     * then each inner array represents a row of data, and all the rows must have the same number of elements. When
     * {@link rowForm} is false, then each inner array represents a column of data, and all columns must have the
     * same number of rows.
     * @param [rowForm=true] Whether the matrix is in row-form (each inner vector represents a row), or the matrix
     * @template T the element type
     * @return A Result object containing either a DataFrame constructed from the input data
     * or an error message if the dimensions are invalid.
     */
    static from<V>(data: Array<Array<V>>, rowForm: boolean = true): Result<DataFrame<V>, string> {
        return validateDimensions(data, rowForm)
            .map(data => new DataFrame<V>(data.flatMap(row => row), data.length, data[0].length))
            .map(df => rowForm ? df : df.transpose())
    }

    /**
     * Creates a data-frame instance from the given columnar data. In column-form, each inner array represents
     * a column of data rather than a row of data.
     *
     * @param {Array<Array<V>>} data - An array of arrays, where each inner array represents a column of data.
     * @return {Result<DataFrame<V>, string>} A Result object containing either a DataFrame instance, if
     * successful, or an error message string.
     */
    static fromColumnData<V>(data: Array<Array<V>>): Result<DataFrame<V>, string> {
        return DataFrame.from(data, false)
    }

    /**
     * Retrieves the total number of rows.
     * @return The number of rows.
     */
    public rowCount(): number {
        return this.numRows
    }

    /**
     * Retrieves the number of columns.
     * @return The total count of columns.
     */
    public columnCount(): number {
        return this.numColumns
    }

    /**
     * Creates and returns a deep copy of the current DataFrame instance.
     *
     * @return A new DataFrame instance containing the same data, number of rows, and columns as the original.
     */
    public copy(): DataFrame<V> {
        return new DataFrame(this.data.slice(), this.numRows, this.numColumns)
    }

    /**
     * Compares the current DataFrame instance with another DataFrame instance for equality.
     *
     * @param other The DataFrame instance to compare with the current instance.
     * @return A boolean indicating whether the two DataFrame instances are equal. Returns true if both have the
     * same length and identical data, otherwise false.
     */
    public equals(other: DataFrame<V>): boolean {
        return this.data.length === other.data.length && this.data.every((value, index) => value === other.data[index])
    }

    /**
     * Extracts a specific row from a 2-dimensional dataset based on the provided row index.
     * @param rowIndex The index of the row to be extracted. Must be within the range of valid row indices (0 to numRows - 1).
     * @template T the element type
     * @return A successful result containing the row data as an array if the index is valid,
     * or a failure result containing an error message if the index is out of bounds.
     */
    public rowSlice(rowIndex: number): Result<Array<V>, string> {
        if (rowIndex >= 0 && rowIndex < this.numRows) {
            return successResult(this.data.slice(rowIndex * this.numColumns, (rowIndex + 1) * this.numColumns))
        }
        return failureResult(`Row Index out of bounds; row_index: ${rowIndex}; range: (0, ${this.numRows})`)
    }

    /**
     * Retrieves all row slices of a matrix or 2D structure.
     * Each row slice is an array of elements corresponding to a single row.
     *
     * @return An array where each element is an array representing a row slice.
     */
    public rowSlices(): Array<Array<V>> {
        const rowSlices: Array<Array<V>> = []
        for (let i = 0; i < this.numRows; i++) {
            rowSlices.push(this.rowSlice(i).getOrThrow())
        }
        return rowSlices
    }

    /**
     * Extracts a slice of the specified column from a 2-dimensional dataset.
     * @param columnIndex The index of the column to extract. Must be within the range [0, this.numColumns).
     * @template T the element type
     * @return Returns a success Result containing the extracted column as an array
     * if the columnIndex is valid. Otherwise, returns a failure Result with an error message.
     */
    public columnsSlice(columnIndex: number): Result<Array<V>, string> {
        if (columnIndex >= 0 && columnIndex <= this.numColumns) {
            const column: Array<V> = []
            for (let i = columnIndex; i < this.data.length; i += this.numColumns) {
                column.push(this.data[i])
            }
            return successResult(column)
        }
        return failureResult(`Column index out of bounds; column_index: ${columnIndex}; range: (0, ${this.numColumns})`)
    }

    /**
     * Generates an array of arrays, where each inner array represents a slice of elements from
     * each column of the structure.
     *
     * @return A 2D array representing slices of elements from all columns.
     */
    public columnSlices(): Array<Array<V>> {
        const columnSlices: Array<Array<V>> = []
        for (let i = 0; i < this.numColumns; i++) {
            columnSlices.push(this.columnsSlice(i).getOrThrow())
        }
        return columnSlices
    }

    /**
     * Retrieves an element from the specified row and column indices of a grid-like data structure.
     * @param rowIndex The index of the row from which to retrieve the element.
     * @param columnIndex The index of the column from which to retrieve the element.
     * @template T the element type
     * @return A `Result` object containing the element if the indices are within bounds,
     * or an error message string if the indices are out of bounds.
     */
    public elementAt(rowIndex: number, columnIndex: number): Result<V, string> {
        if (rowIndex >= 0 && rowIndex < this.numRows && columnIndex >= 0 && columnIndex <= this.numColumns) {
            return successResult(this.data[rowIndex * this.numColumns + columnIndex])
        }
        return failureResult(`Index out of bounds; row: ${rowIndex}, column: ${columnIndex}; range: (${this.numRows}, ${this.numColumns})`)
    }

    /**
     * Updates the element at the specified row and column indices in the data frame.
     * If the indices are out of bounds, the operation results in a failure.
     *
     * @param rowIndex The zero-based index of the row to update.
     * @param columnIndex The zero-based index of the column to update.
     * @param value The value to set at the specified row and column indices.
     * @return A result object.
     *         On success, the result contains an updated DataFrame with the new value set.
     *         On failure, the result contains an error message specifying the out-of-bounds issue.
     */
    public setElementAt(rowIndex: number, columnIndex: number, value: V): Result<DataFrame<V>, string> {
        if (rowIndex >= 0 && rowIndex < this.numRows && columnIndex >= 0 && columnIndex <= this.numColumns) {
            const updated = this.data.slice()
            updated[rowIndex * this.numColumns + columnIndex] = value
            return successResult(new DataFrame(updated, this.numRows, this.numColumns))
        }
        return failureResult(`Index out of bounds; row: ${rowIndex}, column: ${columnIndex}; range: (${this.numRows}, ${this.numColumns})`)

    }

    /**
     * Inserts a new row into the DataFrame at the specified row index.
     * If the row index is out of bounds, an error result is returned.
     *
     * @param rowIndex The index at which the new row should be inserted. Must be within the range [0, numRows].
     * @param row The row data to be inserted. It must match the expected structure and length of the existing rows.
     * @return A result object that contains the updated DataFrame if successful
     * or an error message if the operation fails (e.g., due to an out-of-bounds index).
     */
    public insertRowBefore(rowIndex: number, row: Array<V>): Result<DataFrame<V>, string> {
        if (rowIndex < 0 && rowIndex >= this.numRows) {
            return failureResult(`Index out of bounds; row: ${rowIndex}; range: (0, ${this.numRows})`)
        }
        if (row.length !== this.numColumns) {
            return failureResult(`The row must have the same number of columns as the data. ` +
                `num_rows: ${this.numRows}; num_columns: ${row.length}`)
        }
        const newRows: Array<V> =
            // rows before the insert point
            this.data.slice(0, rowIndex * this.numColumns)
            .concat(row)
            // rows after the insert point
            .concat(this.data.slice(rowIndex * this.numColumns, this.data.length))
        return successResult(new DataFrame(newRows, this.numRows+1, this.numColumns))
    }

    public pushRow(row: Array<V>): Result<DataFrame<V>, string> {
        if (row.length !== this.numColumns) {
            return failureResult(`The row must have the same number of columns as the data. ` +
                `num_rows: ${this.numRows}; num_columns: ${row.length}`)
        }
        return successResult(new DataFrame(this.data.concat(row), this.numRows + 1, this.numColumns))
    }

    /**
     * Inserts a new column into the DataFrame before the specified column index.
     *
     * @param columnIndex The index at which the new column should be inserted. Must be within the range of existing columns.
     * @param column The column to be inserted. The length of this column must match the number of rows in the DataFrame.
     * @return A result object containing the updated DataFrame on success,
     * or an error message on failure if the index is out of bounds or the column length does not match the number of rows.
     */
    // todo may be faster to copy the whole array, and then splice based on the indexes of the array (starting at the back)
    public insertColumnBefore(columnIndex: number, column: Array<V>): Result<DataFrame<V>, string> {
        if (columnIndex < 0 && columnIndex >= this.numColumns) {
            return failureResult(`Index out of bounds; column: ${columnIndex}; range: (0, ${this.numColumns})`)
        }
        if (column.length !== this.numRows) {
            return failureResult(`The column must have the same number of rows as the data. ` +
                `num_rows: ${this.numRows}; num_columns: ${column.length}`)
        }

        const rows: Array<Array<V>> = this.rowSlices()
        rows.forEach((row: Array<V>, rowIndex) => row.splice(columnIndex, 0, column[rowIndex]))
        return DataFrame.from(rows)
    }

    /**
     * Adds a column to the DataFrame. The column must have the same number of rows as the existing data in the DataFrame.
     *
     * @param column An array representing the column to be added to the DataFrame. The length of this array
     * must match the number of rows in the DataFrame.
     * @return Returns a success result containing the updated DataFrame if the column is added successfully,
     * or a failure result with an error message if the column length does not match the number of rows.
     */
    public pushColumn(column: Array<V>): Result<DataFrame<V>, string> {
        if (column.length !== this.numRows) {
            return failureResult(`The column must have the same number of rows as the data. ` +
                `num_rows: ${this.numRows}; num_columns: ${column.length}`)
        }
        const rows: Array<Array<V>> = this.rowSlices()
        rows.forEach((row: Array<V>, rowIndex) => row.push(column[rowIndex]))
        return DataFrame.from(rows)
    }

    /**
     * Deletes a row at the specified index in the DataFrame.
     *
     * @param rowIndex The index of the row to delete. Must be a non-negative integer within the
     * range of existing rows.
     * @return A Result containing a new DataFrame without the specified row if the operation is successful,
     * or an error message if the operation fails.
     */
    public deleteRowAt(rowIndex: number): Result<DataFrame<V>, string> {
        if (this.numRows === 0) {
            failureResult(`Cannot delete row from an empty DataFrame.`)
        }
        if (rowIndex < 0 || rowIndex >= this.numRows) {
            return failureResult(`Index out of bounds; row: ${rowIndex}; range: (0, ${this.numRows})`)
        }

        const copy = this.data.slice()
        copy.splice(rowIndex * this.numColumns, this.numColumns)
        return successResult(new DataFrame(copy, this.numRows - 1, this.numColumns))
    }

    /**
     * Deletes the column at the specified index from the DataFrame.
     *
     * @param columnIndex The index of the column to be deleted. Must be within the range of existing columns.
     * @return A `Result` object containing the updated DataFrame if the operation is successful,
     * or an error message if the operation fails.
     */
    public deleteColumnAt(columnIndex: number): Result<DataFrame<V>, string> {
        if (this.numColumns === 0) {
            failureResult(`Cannot delete column from an empty DataFrame.`)
        }
        if (columnIndex < 0 || columnIndex >= this.numColumns) {
            return failureResult(`Index out of bounds; column: ${columnIndex}; range: (0, ${this.numColumns})`)
        }
        const rows = this.rowSlices()
        rows.forEach((row: Array<V>, rowIndex) => row.splice(columnIndex, 1))
        return DataFrame.from(rows)
    }

    /**
     * Transposes the current DataFrame, swapping its rows and columns.
     *
     * @return {DataFrame<V>} A new DataFrame instance where rows and columns of the original DataFrame are swapped.
     */
    public transpose(): DataFrame<V> {
        const transposed = new Array<V>(this.data.length)
        for (let row = 0; row < this.numRows; row++) {
            for (let col = 0; col < this.numColumns; col++) {
                transposed[col * this.numRows + row] = this.data[row * this.numColumns + col]
            }
        }
        return new DataFrame(transposed, this.numColumns, this.numRows)
    }

    /*
        Tags
     */
    public tagRow<T extends TagValue>(rowIndex: number, name: string, tag: T): Result<DataFrame<V>, string> {
        if (rowIndex < 0 || rowIndex >= this.numRows) {
            return failureResult(
                `Row index for row tag is out of bounds; row_index: ${rowIndex}; tag_name: ${name}; 
                tag_value: ${tag.toString()}; valid_index_range: (0, ${this.numRows-1}).`
            )
        }
        const rowCoordinate = RowCoordinate.of(rowIndex)
        this.rowTags.addTag(name, tag, rowCoordinate)
        return successResult(this as DataFrame<V>)
    }

    public tagColumn<T extends TagValue>(columnIndex: number, name: string, tag: T): Result<DataFrame<V>, string> {
        if (columnIndex < 0 || columnIndex >= this.numColumns) {
            return failureResult(
                `Column index for column tag is out of bounds; column_index: ${columnIndex}; tag_name: ${name}; 
                tag_value: ${tag.toString()}; valid_index_range: (0, ${this.numColumns-1}).`
            )
        }
        const columnCoordinate = ColumnCoordinate.of(columnIndex)
        this.columnTags.addTag(name, tag, columnCoordinate)
        return successResult(this as DataFrame<V>)
    }

    public tagCell<T extends TagValue>(rowIndex: number, columnIndex: number, name: string, tag: T): Result<DataFrame<V>, string> {
        if (rowIndex < 0 || rowIndex >= this.numRows) {
            return failureResult(
                `Row index for cell tag is out of bounds; row_index: ${rowIndex}; tag_name: ${name}; 
                tag_value: ${tag.toString()}; valid_index_range: (0, ${this.numRows-1}).`
            )
        }
        if (columnIndex < 0 || columnIndex >= this.numColumns) {
            return failureResult(
                `Column index for cell tag is out of bounds; column_index: ${columnIndex}; tag_name: ${name}; `
            )
        }
        this.cellTags.addTag(name, tag, CellCoordinate.of(rowIndex, columnIndex))
        return successResult(this as DataFrame<V>)
    }
}

type Bounds = { min: number, max: number }

/**
 * Validates that all rows in the provided two-dimensional array have the same number of columns.
 * If the rows have matching dimensions and are non-empty, the validation succeeds.
 * Otherwise, it returns a failure result indicating the discrepancy.
 *
 * @param data A two-dimensional array where each row represents an array of elements.
 * @param [rowForm=true] Whether the matrix is in row-form (each inner vector represents a row), or the matrix
 * is in column-form (each inner vector represents a column).
 * @template T Type of the elements stored in the data structure.
 * @return A success result containing the original data if all rows have the same number of columns and are non-empty.
 *         Otherwise, a failure result contains a descriptive error message.
 */
function validateDimensions<T>(data: Array<Array<T>>, rowForm: boolean = true): Result<Array<Array<T>>, string> {
    const minMax = data.reduce((bounds: Bounds, row: Array<T>) => ({
            min: (row.length < bounds.min) ? row.length : bounds.min,
            max: (row.length > bounds.max) ? row.length : bounds.max
        }), {min: Infinity, max: -Infinity}
    )
    if (minMax.min === minMax.max && minMax.min > 0) {
        return successResult(data)
    }
    const condition = rowForm ?
        `All rows must have the same number of columns; min_num_columns: ${minMax.min}, maximum_columns: ${minMax.max}` :
        `All columns must have the same number of rows; min_num_rows: ${minMax.min}, maximum_rows: ${minMax.max}`
    return failureResult(condition)
}
