import {failureResult, Result, successResult} from "result-fn";

/**
 * Represents a two-dimensional data structure, `DataFrame`, that allows for manipulation
 * and querying of tabular data in a row-major format.
 *
 * @template T Type of the elements stored in the data structure.
 */
export class DataFrame<T> {
    private readonly data: Array<T>
    private readonly numColumns: number
    private readonly numRows: number

    private constructor(data: Array<T>, numRows: number, numColumns: number) {
        this.data = data
        this.numRows = numRows
        this.numColumns = numColumns
    }

    // private constructor(data: Array<Array<T>>) {
    //     this.data = data.flatMap(row => row)
    //     this.numRows = data.length
    //     this.numColumns = data[0].length
    // }

    /**
     * Creates a DataFrame from a 2D array of data.
     *
     * @param data A two-dimensional array representing the data.
     * @template T the element type
     * @return A Result object containing either a DataFrame constructed from the input data
     * or an error message if the dimensions are invalid.
     */
    static from<T>(data: Array<Array<T>>): Result<DataFrame<T>, string> {
        return validateDimensions(data)
            .map(data => new DataFrame<T>(data.flatMap(row => row), data.length, data[0].length))
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

    public copy(): DataFrame<T> {
        return new DataFrame(this.data.slice(), this.numRows, this.numColumns)
    }

    public equals(other: DataFrame<T>): boolean {
        return this.data.length === other.data.length && this.data.every((value, index) => value === other.data[index])
    }

    /**
     * Extracts a specific row from a 2-dimensional dataset based on the provided row index.
     * @param rowIndex The index of the row to be extracted. Must be within the range of valid row indices (0 to numRows - 1).
     * @template T the element type
     * @return A successful result containing the row data as an array if the index is valid,
     * or a failure result containing an error message if the index is out of bounds.
     */
    public rowSlice(rowIndex: number): Result<Array<T>, string> {
        if (rowIndex >= 0 && rowIndex < this.numRows) {
            return successResult(this.data.slice(rowIndex * this.numColumns, (rowIndex + 1) * this.numColumns))
        }
        return failureResult(`Row Index out of bounds; row_index: ${rowIndex}; range: (0, ${this.numRows})`)
    }

    public rowSlices(): Array<Array<T>> {
        const rowSlices: Array<Array<T>> = []
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
    public columnsSlice(columnIndex: number): Result<Array<T>, string> {
        if (columnIndex >= 0 && columnIndex <= this.numColumns) {
            const column: Array<T> = []
            for (let i = columnIndex; i < this.data.length; i += this.numColumns) {
                column.push(this.data[i])
            }
            return successResult(column)
        }
        return failureResult(`Column index out of bounds; column_index: ${columnIndex}; range: (0, ${this.numColumns})`)
    }

    public columnSlices(): Array<Array<T>> {
        const columnSlices: Array<Array<T>> = []
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
    public elementAt(rowIndex: number, columnIndex: number): Result<T, string> {
        if (rowIndex >= 0 && rowIndex < this.numRows && columnIndex >= 0 && columnIndex <= this.numColumns) {
            return successResult(this.data[rowIndex * this.numColumns + columnIndex])
        }
        return failureResult(`Index out of bounds; row: ${rowIndex}, column: ${columnIndex}; range: (${this.numRows}, ${this.numColumns})`)
    }

    public setElementAt(rowIndex: number, columnIndex: number, value: T): Result<DataFrame<T>, string> {
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
     * @return A result object that contains the updated DataFrame if successful,
     * or an error message if the operation fails (e.g., due to an out-of-bounds index).
     */
    public insertRowBefore(rowIndex: number, row: Array<T>): Result<DataFrame<T>, string> {
        if (rowIndex >= 0 && rowIndex < this.numRows) {
            const newRows: Array<T> =
                // rows before the insert point
                this.data.slice(0, rowIndex * this.numColumns)
                .concat(row)
                // rows after the insert point
                .concat(this.data.slice(rowIndex * this.numColumns, this.data.length))
            return successResult(new DataFrame(newRows, this.numRows+1, this.numColumns))
        }
        return failureResult(`Index out of bounds; row: ${rowIndex}; range: (0, ${this.numRows})`)
    }

    public pushRow(row: Array<T>): Result<DataFrame<T>, string> {
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
    public insertColumnBefore(columnIndex: number, column: Array<T>): Result<DataFrame<T>, string> {
        if (columnIndex < 0 && columnIndex >= this.numColumns) {
            return failureResult(`Index out of bounds; column: ${columnIndex}; range: (0, ${this.numColumns})`)
        }
        if (column.length !== this.numRows) {
            return failureResult(`The column must have the same number of rows as the data. ` +
                `num_rows: ${this.numRows}; num_columns: ${column.length}`)
        }

        const rows: Array<Array<T>> = this.rowSlices()
        rows.forEach((row: Array<T>, rowIndex) => row.splice(columnIndex, 0, column[rowIndex]))
        return DataFrame.from(rows)
    }

    public pushColumn(column: Array<T>): Result<DataFrame<T>, string> {
        if (column.length !== this.numRows) {
            return failureResult(`The column must have the same number of rows as the data. ` +
                `num_rows: ${this.numRows}; num_columns: ${column.length}`)
        }
        const rows: Array<Array<T>> = this.rowSlices()
        rows.forEach((row: Array<T>, rowIndex) => row.push(column[rowIndex]))
        return DataFrame.from(rows)
    }

    public deleteRowAt(rowIndex: number): Result<DataFrame<T>, string> {
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

    public deleteColumnAt(columnIndex: number): Result<DataFrame<T>, string> {
        if (this.numColumns === 0) {
            failureResult(`Cannot delete column from an empty DataFrame.`)
        }
        if (columnIndex < 0 || columnIndex >= this.numColumns) {
            return failureResult(`Index out of bounds; column: ${columnIndex}; range: (0, ${this.numColumns})`)
        }
        const rows = this.rowSlices()
        rows.forEach((row: Array<T>, rowIndex) => row.splice(columnIndex, 1))
        return DataFrame.from(rows)
    }
}

type Bounds = { min: number, max: number }

function validateDimensions<T>(data: Array<Array<T>>): Result<Array<Array<T>>, string> {
    const minMax = data.reduce((bounds: Bounds, row: Array<T>) => ({
            min: (row.length < bounds.min) ? row.length : bounds.min,
            max: (row.length > bounds.max) ? row.length : bounds.max
        }), {min: Infinity, max: -Infinity}
    )
    if (minMax.min === minMax.max && minMax.min > 0) {
        return successResult(data)
    }
    return failureResult(`All rows must have the same number of columns; min_num_columns: ${minMax.min}, maximum_columns: ${minMax.max}`)
}