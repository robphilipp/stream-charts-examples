import {TableData} from "./tableData";
import {defaultTableFont} from "./tableUtils";
import {CellCoordinate, ColumnCoordinate, DataFrame, RowCoordinate, Tag, TagValue} from "data-frame-ts";
import {failureResult, Result, successResult} from "result-fn";

export type Styling<S> = {
    style: S
    priority: number
}

export function stylingFor<S>(style: S, priority: number = 0): Styling<S> {
    return {style, priority}
}


enum TableStyleType {
    COLUMN_HEADER = "column_header_style",
    ROW_HEADER = "row_header_style",
    FOOTER = "footer_style",
    ROW = "row_style",
    COLUMN = "column_style",
    CELL = "cell_style"
}

type TableStylerProps<V> = {
    dataFrame: DataFrame<V>
    readonly font: TableFont
    border: Border
    background: Background
    dimension: Pick<Dimension, "width" | "height">
    padding: Padding
    margin: Margin
    readonly errors: Array<string>
}

export type TableFont = {
    size: number
    color: string
    family: string
    weight: number
}

export type Background = {
    color: string
    opacity: number
}
const defaultBackground: Background = {color: '#fff', opacity: 0}

export type Padding = {
    left: number
    right: number
    top: number
    bottom: number
}
const defaultPadding: Padding = {left: 0, right: 0, top: 0, bottom: 0}

export type Margin = {
    left: number
    right: number
    top: number
    bottom: number
}
const defaultMargin: Margin = {left: 0, right: 0, top: 0, bottom: 0}

export type Border = {
    color: string
    opacity: number
    width: number
    radius: number
}
const defaultBorder: Border = {color: 'black', radius: 0, width: 0, opacity: 0}

export type Dimension = {
    width: number
    defaultWidth: number
    minWidth: number
    maxWidth: number

    height: number
    defaultHeight: number
    minHeight: number
    maxHeight: number
}

/**
 * The style for each column (for what is not determined by each row's style).
 */
export type ColumnStyle = {
    alignText: "left" | "center" | "right"
    dimension: Pick<Dimension, "defaultWidth" | "minWidth" | "maxWidth">
    padding: Pick<Padding, "left" | "right">
}

/**
 * Note that the {@link ColumnStyle} determines the text alignment for
 * each column. Therefore, the alignment of the text in a row is determined
 * by the alignment for all the rows in the column.
 */
export type RowStyle = {
    font: TableFont
    background: Background
    dimension: Pick<Dimension, "defaultHeight" | "minHeight" | "maxHeight">
    padding: Pick<Padding, "top" | "bottom">
}

export type CellStyle = ColumnStyle & RowStyle

/**
 * Confusing as it may be, this is the style for the **row** that holds the
 * headers for each column. The styling for this row may differ from the
 * other rows in the table.
 */
export type ColumnHeaderStyle = {
    font: TableFont
    alignText: "left" | "right" | "center"
    dimension: Pick<Dimension, "height">
    padding: Pick<Padding, "top" | "bottom">
    background: Background
}

/**
 * Confusing as it may be, this is the style for the **column** that holds
 * the headers for each row. The styling for this column may differ from the
 * columns in the table.
 */
export type RowHeaderStyle = {
    font: TableFont
    alignText: "left" | "right" | "center"
    // dimension: Pick<Dimension, "width">
    padding: Pick<Padding, "left" | "right">
    background: Background
}

export type FooterStyle = {
    font: TableFont
    alignText: "left" | "right" | "center"
    dimension: Pick<Dimension, "height">
    padding: Pick<Padding, "top" | "bottom">
    background: Background
}

export class StyledTable<V> {

    constructor(
        private readonly dataFrame: DataFrame<V>,
        private readonly font: TableFont,
        private readonly border: Border,
        private readonly background: Background,
        private readonly dimension: Pick<Dimension, "width" | "height">,
        private readonly padding: Padding,
        private readonly margin: Margin,
    ) {
    }

    tableFont(): TableFont {
        return {...this.font}
    }

    tableBorder(): Border {
        return {...this.border}
    }

    tableBackground(): Background {
        return {...this.background}
    }

    tableDimensions(): Pick<Dimension, "width" | "height"> {
        return {...this.dimension}
    }

    tablePadding(): Padding {
        return {...this.padding}
    }

    tableMargin(): Margin {
        return {...this.margin}
    }

    private columnTagsFor<T extends TagValue>(columnIndex: number, tagStyleType: TableStyleType): Result<Tag<Styling<T>, ColumnCoordinate>, string> {
        // find all the tags and type them to row-header tags
        const tags = this.dataFrame
            .columnTagsFor(columnIndex)
            .filter(tag => tag.matchesId(tagStyleType, ColumnCoordinate.of(columnIndex)))
            .map(tag => tag as Tag<Styling<T>, ColumnCoordinate>)

        if (tags.length === 0) {
            return failureResult(`(StyledTable::columnTagsFor) No matching column-style tags found for table; column_index: ${columnIndex}; tag_type: ${tagStyleType}`)
        }
        // when there are more than one tag representing the row-header style, then sort based on priority and
        // take the first one
        if (tags.length > 1) {
            tags.sort((tagA, tagB) => tagB.value.priority - tagA.value.priority)
        }
        return successResult(tags[0])
    }

    private rowTagsFor<S extends TagValue>(rowIndex: number, tagStyleType: TableStyleType): Result<Tag<Styling<S>, RowCoordinate>, string> {
        // find all the tags and type them to column-header tags
        const tags = this.dataFrame
            .rowTagsFor(rowIndex)
            .filter(tag => tag.matchesId(tagStyleType, RowCoordinate.of(rowIndex)))
            .map(tag => tag as Tag<Styling<S>, RowCoordinate>)

        if (tags.length === 0) {
            return failureResult(`(StyledTable::rowTagsFor) No matching row-style tags found for table; row_index: ${rowIndex}; tag_type: ${tagStyleType}`)
        }
        // when there are more than one tag representing the column-header, the sort based on the priority and
        // take the first one
        if (tags.length > 1) {
            tags.sort((tagA, tagB) => tagB.value.priority - tagA.value.priority)
        }
        return successResult(tags[0])
    }

    rowHeaderStyle(): Result<RowHeaderStyle, string> {
        if (!TableData.hasRowHeader(this.dataFrame)) {
            return failureResult("(StyledTable::rowHeaderStyle) The table data does not have a row header")
        }
        return this
            .columnTagsFor<RowHeaderStyle>(0, TableStyleType.ROW_HEADER)
            .map(tag => tag.value.style)
    }

    columnHeaderStyle(): Result<ColumnHeaderStyle, string> {
        if (!TableData.hasColumnHeader(this.dataFrame)) {
            return failureResult("(StyledTable::columnHeaderStyle) The table data does not have a column header")
        }
        return this
            .rowTagsFor<ColumnHeaderStyle>(0, TableStyleType.COLUMN_HEADER)
            .map(tag => tag.value.style)
    }

    rowStyleFor(rowIndex: number): Result<RowStyle, string> {
        return this
            .rowTagsFor<RowStyle>(rowIndex, TableStyleType.ROW)
            .map(tag => tag.value.style)
    }

    columnStyleFor(columnIndex: number): Result<ColumnStyle, string> {
        return this
            .columnTagsFor<ColumnStyle>(columnIndex, TableStyleType.COLUMN)
            .map(tag => tag.value.style)
    }

    cellStyleFor(rowIndex: number, columnIndex: number): Result<CellStyle, string> {
        // find all the tags and type them to column-header tags
        const tags = this.dataFrame
            .cellTagsFor(rowIndex, columnIndex)
            .filter(tag => tag.matchesId(TableStyleType.CELL, CellCoordinate.of(rowIndex, columnIndex)))
            .map(tag => tag as Tag<Styling<CellStyle>, CellCoordinate>)

        if (tags.length === 0) {
            return failureResult(`(StyledTable::cellStyleFor) No matching cell-style tags found for table; row_index: ${rowIndex}; column_index: ${columnIndex}`)
        }
        // when there are more than one tag representing the column-header, the sort based on the priority and
        // take the first one
        if (tags.length > 1) {
            tags.sort((tagA, tagB) => tagB.value.priority - tagA.value.priority)
        }
        return successResult(tags[0].value.style)
    }
}

/**
 * Returns a table object of rows and columns that have the data and style for each element in the table.
 */
class TableStyler<V> {

    private constructor(
        private dataFrame: DataFrame<V>,
        private readonly font: TableFont = defaultTableFont,
        private border: Border = defaultBorder,
        private background: Background = defaultBackground,
        private dimension: Pick<Dimension, "width" | "height"> = {width: NaN, height: NaN},
        private padding: Padding = defaultPadding,
        private margin: Margin = defaultMargin,
        private readonly errors: Array<string> = []
    ) {
    }

    static fromTableData<V>(tableData: TableData<V>): TableStyler<V> {
        return new TableStyler<V>(tableData.unwrapDataFrame())
    }

    static fromDataFrame<V>(dataFrame: DataFrame<V>): TableStyler<V> {
        return new TableStyler<V>(dataFrame.copy())
    }

    copy(): TableStyler<V> {
        return new TableStyler<V>(
            this.dataFrame,
            this.font,
            this.border,
            this.background,
            this.dimension,
            this.padding,
            this.margin,
            this.errors
        )
    }

    update(properties: Partial<TableStylerProps<V>>): TableStyler<V> {
        const {
            dataFrame = this.dataFrame,
            font = this.font,
            border = this.border,
            background = this.background,
            dimension = this.dimension,
            padding = this.padding,
            margin = this.margin,
        } = properties
        return new TableStyler<V>(
            dataFrame,
            font,
            border,
            background,
            dimension,
            padding,
            margin,
            this.errors
        )
    }

    withTableBackground(background: Background): TableStyler<V> {
        const builder = this.copy()
        builder.background = background
        return builder
    }

    withBorder(border: Border): TableStyler<V> {
        const builder = this.copy()
        builder.border = border
        return builder
    }

    withDimensions(width: number, height: number): TableStyler<V> {
        const builder = this.copy()
        builder.dimension = {width, height}
        return builder
    }

    withPadding(padding: Padding): TableStyler<V> {
        const builder = this.copy()
        builder.padding = padding
        return builder
    }

    withMargin(margin: Margin): TableStyler<V> {
        const builder = this.copy()
        builder.margin = margin
        return builder
    }

    private tagRow<S extends TagValue>(rowIndex: number, tagStyleType: TableStyleType, style: S): Result<TableStyler<V>, string> {
        return this.dataFrame.tagRow<S>(rowIndex, tagStyleType, style)
            // when successfully tagged, make an updated copy of this builder with the new data-frame
            .map(df => this.update({dataFrame: df}))
            // when failed to tag, add to the errors
            .onFailure(error => this.errors.push(error))
    }

    private tagColumn<S extends TagValue>(columnIndex: number, tagStyleType: TableStyleType, style: S): Result<TableStyler<V>, string> {
        return this.dataFrame.tagColumn<S>(columnIndex, tagStyleType, style)
            // when successfully tagged, make an updated copy of this builder with the new data-frame
            .map(df => this.update({dataFrame: df}))
            // when failed to tag, add to the errors
            .onFailure(error => this.errors.push(error))
    }
    
    withColumnHeaderStyle(columnHeaderStyle: ColumnHeaderStyle, priority: number = Infinity): TableStyler<V> {
        if (!TableData.hasColumnHeader(this.dataFrame)) {
            this.errors.push("The column header style can only be supplied when the table data has a column header")
            return this
        }
        // tag the row as a column header style, and if it fails, then return this (unmodified) builder
        return this
            .tagRow<Styling<ColumnHeaderStyle>>(0, TableStyleType.COLUMN_HEADER, stylingFor(columnHeaderStyle, priority))
            .getOrElse(this)
    }

    withRowHeaderStyle(rowHeaderStyle: RowHeaderStyle, priority: number = Infinity): TableStyler<V> {
        if (!TableData.hasRowHeader(this.dataFrame)) {
            this.errors.push("The row header style can only be supplied when the table data has row headers")
            return this
        }
        // tag the column with the row header style, and if it fails, then return this (unmodified) builder
        return this
            .tagColumn<Styling<RowHeaderStyle>>(0, TableStyleType.ROW_HEADER, stylingFor(rowHeaderStyle, priority))
            .getOrElse(this)
    }

    withFooterStyle(footerStyle: FooterStyle, priority: number = Infinity): TableStyler<V> {
        if (!TableData.hasFooter(this.dataFrame)) {
            this.errors.push("The footer style can only be supplied when the table data has a footer")
            return this
        }
        // tag the row the footer style, and if it fails, then return this (unmodified) builder
        const footerIndex = TableData.tableRowCount(this.dataFrame) - 1
        return this
            .tagRow<Styling<ColumnHeaderStyle>>(footerIndex, TableStyleType.FOOTER, stylingFor(footerStyle, priority))
            .getOrElse(this)
    }

    withRowStyle(rowIndex: number, rowStyle: RowStyle, priority: number = 0): TableStyler<V> {
        if (rowIndex < 0 || rowIndex >= TableData.tableRowCount(this.dataFrame)) {
            this.errors.push(
                `The row index, when setting a row-style, must be between 0 and ${TableData.tableRowCount(this.dataFrame) - 1}`
            )
            return this
        }
        // tag the row with a style, and if it fails, then return this (unmodified) builder
        return this
            .tagRow<Styling<RowStyle>>(rowIndex, TableStyleType.ROW, stylingFor(rowStyle, priority))
            .getOrElse(this)
    }

    withColumnStyle(columnIndex: number, columnStyle: ColumnStyle, priority: number = 0): TableStyler<V> {
        if (columnIndex < 0 || columnIndex >= TableData.tableRowCount(this.dataFrame)) {
            this.errors.push(
                `The column index, when setting a column-style, must be between 0 and ${TableData.tableColumnCount(this.dataFrame) - 1}`
            )
            return this
        }
        // tag the row with a style, and if it fails, then return this (unmodified) builder
        return this
            .tagColumn<Styling<ColumnStyle>>(columnIndex, TableStyleType.COLUMN, stylingFor(columnStyle, priority))
            .getOrElse(this)
    }

    withCellStyle(rowIndex: number, columnIndex: number, cellStyle: CellStyle, priority: number = 0): TableStyler<V> {
        if (rowIndex < 0 || rowIndex >= TableData.tableRowCount(this.dataFrame) ||
            columnIndex < 0 || columnIndex >= TableData.tableRowCount(this.dataFrame)) {
            this.errors.push(
                `The (row, column) indices, when setting a cell-style, must be in ` +
                `([0, ${TableData.tableRowCount(this.dataFrame)}), [0, ${TableData.tableColumnCount(this.dataFrame)}))`
            )
            return this
        }
        // tag the cell with the cell-style
        return this.dataFrame
            .tagCell<Styling<CellStyle>>(rowIndex, columnIndex, TableStyleType.CELL, stylingFor(cellStyle, priority))
            // when successfully tagged, make an updated copy of this builder with the new data-frame
            .map(df => this.update({dataFrame: df}))
            // when failed to tag, add to the errors
            .onFailure(error => this.errors.push(error))
            // when failed, return this (unmodified) builder
            .getOrElse(this)
    }

    styleTable(): StyledTable<V> {
        return new StyledTable(
            this.dataFrame,

            this.font,

            this.border,
            this.background,

            this.dimension,
            this.padding,
            this.margin,
        )
    }
}
