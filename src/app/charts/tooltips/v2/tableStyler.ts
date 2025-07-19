import {TableData} from "./tableData";
import {defaultTableFont} from "./tableUtils";
import {CellCoordinate, ColumnCoordinate, DataFrame, RowCoordinate, Tag, TagValue} from "data-frame-ts";
import {failureResult, Result, successResult} from "result-fn";

/**
 * Represents a styling configuration with a priority level.
 * Higher priority styles will override lower priority styles when multiple are applied.
 */
export type Styling<S> = {
    style: S
    priority: number
}

/**
 * Creates a Styling object with the given style and priority.
 * @param style The style to apply
 * @param defaultStyle The default style that is used to fill in missing style attributes
 * @param priority The priority level of the style (higher values take precedence)
 * @returns A Styling object containing the style and priority
 */
export function stylingFor<S>(style: Partial<S>, defaultStyle: S, priority: number = 0): Styling<S> {
    return {style: {...defaultStyle, ...style}, priority}
}


/**
 * Enum representing different types of table styling elements.
 * Used as identifiers when tagging different parts of the table with styles.
 */
enum TableStyleType {
    COLUMN_HEADER = "column_header_style",
    ROW_HEADER = "row_header_style",
    FOOTER = "footer_style",
    ROW = "row_style",
    COLUMN = "column_style",
    CELL = "cell_style"
}

/**
 * Properties for the TableStyler class.
 * Contains all the styling information and data for a table.
 */
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

/**
 * Defines the font properties for table text.
 */
export type TableFont = {
    size: number
    color: string
    family: string
    weight: number
}

/**
 * Defines the background properties for table elements.
 */
export type Background = {
    color: string
    opacity: number
}
export const defaultTableBackground: Background = {color: '#fff', opacity: 0}

/**
 * Defines the padding properties for table elements.
 * Specifies the space between the content and the border.
 */
export type Padding = {
    left: number
    right: number
    top: number
    bottom: number
}
export const defaultTablePadding: Padding = {left: 0, right: 0, top: 0, bottom: 0}

/**
 * Defines the margin properties for table elements.
 * Specifies the space outside the border.
 */
export type Margin = {
    left: number
    right: number
    top: number
    bottom: number
}
export const defaultTableMargin: Margin = {left: 0, right: 0, top: 0, bottom: 0}

/**
 * Defines the border properties for table elements.
 * Controls the appearance of the border around table elements.
 */
export type Border = {
    color: string
    opacity: number
    width: number
    radius: number
}
export const defaultTableBorder: Border = {color: 'black', radius: 0, width: 0, opacity: 0}

/**
 * Defines the dimension properties for table elements.
 * Controls the size constraints including width and height with their minimum,
 * maximum, and default values.
 */
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

export const defaultDimension: Dimension = {
    width: 20,
    defaultWidth: 20,
    minWidth: 20,
    maxWidth: 20,

    height: 20,
    defaultHeight: 20,
    minHeight: 20,
    maxHeight: 20
}

/**
 * The style for each column (for what is not determined by each row's style).
 */
export type ColumnStyle = {
    alignText: "left" | "center" | "right"
    dimension: Pick<Dimension, "defaultWidth" | "minWidth" | "maxWidth">
    padding: Pick<Padding, "left" | "right">
}

export const defaultColumnStyle: ColumnStyle = {
    alignText: "left",
    dimension: {defaultWidth: 20, minWidth: 20, maxWidth: 20},
    padding: {left: 0, right: 0}
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

export const defaultRowStyle: RowStyle = {
    font: defaultTableFont,
    background: defaultTableBackground,
    dimension: {defaultHeight: 20, minHeight: 20, maxHeight: 20},
    padding: {top: 0, bottom: 0}
}

export type CellStyle = {
    font: TableFont
    alignText: "left" | "center" | "right"
    background: Background
    dimension: Dimension
    padding: Padding
    border: Border
}

export const defaultCellStyle: CellStyle = {
    font: defaultTableFont,
    alignText: "left",
    background: defaultTableBackground,
    dimension: defaultDimension,
    padding: defaultTablePadding,
    border: defaultTableBorder
}

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

export const defaultColumnHeaderStyle: ColumnHeaderStyle = {
    font: defaultTableFont,
    alignText: "left",
    dimension: {height: 20},
    padding: {top: 0, bottom: 0},
    background: defaultTableBackground
}

/**
 * Confusing as it may be, this is the style for the **column** that holds
 * the headers for each row. The styling for this column may differ from the
 * columns in the table.
 */
export type RowHeaderStyle = {
    font: TableFont
    alignText: "left" | "right" | "center"
    padding: Pick<Padding, "left" | "right">
    background: Background
}

export const defaultRowHeaderStyle: RowHeaderStyle = {
    font: defaultTableFont,
    alignText: "left",
    padding: {left: 0, right: 0},
    background: defaultTableBackground
}

/**
 * Defines the style for the footer row of the table.
 * Controls the appearance of the footer including font, text alignment,
 * height, padding, and background.
 */
export type FooterStyle = {
    font: TableFont
    alignText: "left" | "right" | "center"
    dimension: Pick<Dimension, "height">
    padding: Pick<Padding, "top" | "bottom">
    background: Background
}

export const defaultFooterStyle: FooterStyle = {
    font: defaultTableFont,
    alignText: "left",
    dimension: {height: 20},
    padding: {top: 0, bottom: 0},
    background: defaultTableBackground
}

type Stylings = Styling<RowHeaderStyle> |
    Styling<ColumnHeaderStyle> |
    Styling<FooterStyle> |
    Styling<RowStyle> |
    Styling<ColumnStyle> |
    Styling<CellStyle>

/**
 * Represents a table with applied styles.
 * Provides methods to access the styling information for different parts of the table.
 */
export class StyledTable<V> {

    /**
     * Creates a new StyledTable instance.
     * @param dataFrame The data frame containing the table data
     * @param font The font settings for the table
     * @param border The border settings for the table
     * @param background The background settings for the table
     * @param dimension The dimension settings for the table
     * @param padding The padding settings for the table
     * @param margin The margin settings for the table
     */
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

    /**
     * Returns the font settings for the table.
     * @returns A copy of the table's font settings
     */
    tableFont(): TableFont {
        return {...this.font}
    }

    /**
     * Returns the border settings for the table.
     * @returns A copy of the table's border settings
     */
    tableBorder(): Border {
        return {...this.border}
    }

    /**
     * Returns the background settings for the table.
     * @returns A copy of the table's background settings
     */
    tableBackground(): Background {
        return {...this.background}
    }

    /**
     * Returns the dimension settings for the table.
     * @returns A copy of the table's dimension settings
     */
    tableDimensions(): Pick<Dimension, "width" | "height"> {
        return {...this.dimension}
    }

    /**
     * Returns the padding settings for the table.
     * @returns A copy of the table's padding settings
     */
    tablePadding(): Padding {
        return {...this.padding}
    }

    /**
     * Returns the margin settings for the table.
     * @returns A copy of the table's margin settings
     */
    tableMargin(): Margin {
        return {...this.margin}
    }

    /**
     * Retrieves styling tags for a specific column.
     * @param columnIndex The index of the column
     * @param tagStyleType The type of style tag to retrieve
     * @returns A Result containing the tag if found, or an error message
     * @private
     */
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

    /**
     * Retrieves styling tags for a specific row.
     * @param rowIndex The index of the row
     * @param tagStyleType The type of style tag to retrieve
     * @returns A Result containing the tag if found, or an error message
     * @private
     */
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

    /**
     * Gets the style for the row header.
     * @returns A Result containing the row header style if found, or an error message
     */
    rowHeaderStyle(): Result<Styling<RowHeaderStyle>, string> {
        if (!TableData.hasRowHeader(this.dataFrame)) {
            return failureResult("(StyledTable::rowHeaderStyle) The table data does not have a row header")
        }
        return this
            .columnTagsFor<RowHeaderStyle>(0, TableStyleType.ROW_HEADER)
            .map(tag => tag.value as Styling<RowHeaderStyle>)
    }

    /**
     * Gets the style for the column header.
     * @returns A Result containing the column header style if found, or an error message
     */
    columnHeaderStyle(): Result<Styling<ColumnHeaderStyle>, string> {
        if (!TableData.hasColumnHeader(this.dataFrame)) {
            return failureResult("(StyledTable::columnHeaderStyle) The table data does not have a column header")
        }
        return this
            .rowTagsFor<ColumnHeaderStyle>(0, TableStyleType.COLUMN_HEADER)
            .map(tag => tag.value as Styling<ColumnHeaderStyle>)
    }

    footerStyle(): Result<Styling<FooterStyle>, string> {
        if (!TableData.hasFooter(this.dataFrame)) {
            return failureResult("(StyledTable::footerStyle) The table data does not have a footer")
        }
        return this
            .rowTagsFor<FooterStyle>(this.dataFrame.rowCount() - 1, TableStyleType.FOOTER)
            .map(tag => tag.value as Styling<FooterStyle>)
    }

    /**
     * Gets the style for a specific row.
     * @param rowIndex The index of the row
     * @returns A Result containing the row style if found, or an error message
     */
    rowStyleFor(rowIndex: number): Result<Styling<RowStyle>, string> {
        return this
            .rowTagsFor<RowStyle>(rowIndex, TableStyleType.ROW)
            .map(tag => tag.value as Styling<RowStyle>)
    }

    /**
     * Gets the style for a specific column.
     * @param columnIndex The index of the column
     * @returns A Result containing the column style if found, or an error message
     */
    columnStyleFor(columnIndex: number): Result<Styling<ColumnStyle>, string> {
        return this
            .columnTagsFor<ColumnStyle>(columnIndex, TableStyleType.COLUMN)
            .map(tag => tag.value as Styling<ColumnStyle>)
    }

    /**
     * Gets the style for a specific cell.
     * @param rowIndex The row index of the cell
     * @param columnIndex The column index of the cell
     * @returns A Result containing the cell style if found, or an error message
     */
    cellStyleFor(rowIndex: number, columnIndex: number): Result<Styling<CellStyle>, string> {
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
        return successResult(tags[0].value as Styling<CellStyle>)
    }

    /**
     * Unlike the methods that retrieve the particular styles, say for a cell, a column header,
     * and so forth, this method returns a {@link CellStyle} calculated from all the styles
     * that apply to the specified cell by using the style properties with the highest priority.
     * <p>
     * Retrieves the styles to be applied to a specific data cell in the table. This method
     * accounts for column headers and row headers. For example, regardless of whether the
     * table has a column header, a row index of 0 refers to the first row of data. And
     * regardless of whether the table has a row header, a column index of 0 refers to the
     * first column of data.
     *
     * @param rowIndex - The index of the row in the table data for which styles are required.
     * Must be within the valid row index range.
     * @param columnIndex - The index of the column in the table data for which styles are required.
     * Must be within the valid column index range.
     * @return A result object containing the cell style if the indices are valid, or an error
     * message if they are not.
     */
    dataCellStyles(rowIndex: number, columnIndex: number): Result<CellStyle, string> {
        if (
            rowIndex < 0 || rowIndex >= TableData.dataRowCount(this.dataFrame) ||
            columnIndex < 0 || columnIndex >= TableData.dataColumnCount(this.dataFrame)
        ) {
           return failureResult(
               `(StyledTable::dataCellStyles) Invalid row and/or column index for data; row_index${rowIndex}` +
               `; column_index: ${columnIndex}` +
               `; valid_row_index: [0, ${TableData.dataRowCount(this.dataFrame)})` +
               `; valid_column_index: [0, ${TableData.dataColumnCount(this.dataFrame)})` +
               `; has_column_header: ${TableData.hasColumnHeader(this.dataFrame)}` +
               `; has_row_header: ${TableData.hasRowHeader(this.dataFrame)}` +
               `; has_footer: ${TableData.hasFooter(this.dataFrame)}`
           )
        }
        const dataRowIndex = rowIndex + (TableData.hasColumnHeader(this.dataFrame) ? 1 : 0)
        const dataColumnIndex = columnIndex + (TableData.hasRowHeader(this.dataFrame) ? 1 : 0)
        return this.stylesFor(dataRowIndex, dataColumnIndex)
    }

    /**
     * Unlike the methods that retrieve the particular styles, say for a cell, a column header,
     * and so forth, this method returns a {@link CellStyle} calculated from all the styles
     * that apply to the specified cell by using the style properties with the highest priority.
     * <p>
     * Calculates the style for the cell based on the styles applied to the table and their
     * relative priority. The row and column indexes refer to the entire table and do not account
     * for column headers, row headers, or footers.
     * @param rowIndex The index of the row in the entire table. For example, if the table has column
     * headers, then a rowIndex of 0 would be that column header.
     * @param columnIndex The index of the column in the entire table. For example, if the table has
     * row headers, then a column index of 0 would be the row header
     * @return A {@link Result} holding the {@link CellStyle}; or a failure {@link Result} if the
     * row or column indexes are out of range.
     * @see dataCellStyles
     */
    stylesFor(rowIndex: number, columnIndex: number): Result<CellStyle, string> {
        if (rowIndex < 0 || rowIndex >= this.dataFrame.rowCount() || columnIndex < 0 || columnIndex >= this.dataFrame.columnCount()) {
            return failureResult(
                `(StyledTable::stylesFor) Invalid row and/or column index; row_index${rowIndex}` +
                `; column_index: ${columnIndex}` +
                `; valid_row_index: [0, ${this.dataFrame.rowCount()})` +
                `; valid_column_index: [0, ${this.dataFrame.columnCount()})`
            )
        }
        return successResult([
            this.columnHeaderStyle().getOrElse({style: defaultColumnHeaderStyle, priority: -1}),
            this.rowHeaderStyle().getOrElse({style: defaultRowHeaderStyle, priority: -2}),
            this.footerStyle().getOrElse({style: defaultFooterStyle, priority: -1}),
            this.rowStyleFor(rowIndex).getOrElse({style: defaultRowStyle, priority: -3}),
            this.columnStyleFor(columnIndex).getOrElse({style: defaultColumnStyle, priority: -2}),
            this.cellStyleFor(rowIndex, columnIndex).getOrElse({style: defaultCellStyle, priority: -1})
        ]
            .sort((stylingA: Stylings, stylingB: Stylings) => stylingA.priority - stylingB.priority)
            .reduce((acc: CellStyle, curr: Stylings) => ({
                ...acc,
                // @ts-ignore
                font: (curr.style.hasOwnProperty('font') ? {...curr.style.font} as TableFont : acc.font),
                // @ts-ignore
                alignText: (curr.style.hasOwnProperty('alignText') ? {...curr.style.alignText} as "left" | "center" | "right" : acc.alignText),
                // @ts-ignore
                background: (curr.style.hasOwnProperty('background') ? {...curr.style.background} as Background : acc.background),
                // @ts-ignore
                dimension: (curr.style.hasOwnProperty('dimension') ? {...curr.style.dimension} as Dimension : acc.dimension),
                // @ts-ignore
                padding: (curr.style.hasOwnProperty('padding') ? {...curr.style.padding} as Padding : acc.padding),
                // @ts-ignore
                border: (curr.style.hasOwnProperty('border') ? {...curr.style.border} as Border : acc.border),
            }), defaultCellStyle))
    }
}

/**
 * Builder class for creating styled tables.
 * Provides methods to configure various styling aspects of a table.
 */
export class TableStyler<V> {

    /**
     * Private constructor to enforce factory method usage.
     * @param dataFrame The data frame containing the table data
     * @param font The font settings for the table
     * @param border The border settings for the table
     * @param background The background settings for the table
     * @param dimension The dimension settings for the table
     * @param padding The padding settings for the table
     * @param margin The margin settings for the table
     * @param errors Array to collect error messages during styling operations
     */
    private constructor(
        private dataFrame: DataFrame<V>,
        private font: TableFont = defaultTableFont,
        private border: Border = defaultTableBorder,
        private background: Background = defaultTableBackground,
        private dimension: Pick<Dimension, "width" | "height"> = {width: NaN, height: NaN},
        private padding: Padding = defaultTablePadding,
        private margin: Margin = defaultTableMargin,
        private readonly errors: Array<string> = []
    ) {
    }

    /**
     * Creates a TableStyler from a TableData object.
     * @param tableData The TableData object to style
     * @returns A new TableStyler instance
     */
    static fromTableData<V>(tableData: TableData<V>): TableStyler<V> {
        return new TableStyler<V>(tableData.unwrapDataFrame())
    }

    /**
     * Creates a TableStyler from a DataFrame object.
     * @param dataFrame The DataFrame object to style
     * @returns A new TableStyler instance
     */
    static fromDataFrame<V>(dataFrame: DataFrame<V>): TableStyler<V> {
        return new TableStyler<V>(dataFrame.copy())
    }

    /**
     * Creates a copy of this TableStyler instance.
     * @returns A new TableStyler instance with the same properties
     */
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

    /**
     * Creates a new TableStyler with updated properties.
     * @param properties Partial properties to update
     * @returns A new TableStyler instance with updated properties
     */
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

    withTableFont(font: Partial<TableFont>): TableStyler<V> {
        const builder = this.copy()
        builder.font = {...builder.font, ...font}
        return builder
    }

    /**
     * Sets the background for the table.
     * @param background The background settings to apply
     * @returns A new TableStyler instance with the updated background
     */
    withTableBackground(background: Partial<Background>): TableStyler<V> {
        const builder = this.copy()
        builder.background = {...builder.background, ...background}
        return builder
    }

    /**
     * Sets the border for the table.
     * @param border The border settings to apply
     * @returns A new TableStyler instance with the updated border
     */
    withBorder(border: Partial<Border>): TableStyler<V> {
        const builder = this.copy()
        builder.border = {...builder.border, ...border}
        return builder
    }

    /**
     * Sets the dimensions for the table.
     * @param width The width of the table
     * @param height The height of the table
     * @returns A new TableStyler instance with the updated dimensions
     */
    withDimensions(width: number, height: number): TableStyler<V> {
        const builder = this.copy()
        builder.dimension = {width, height}
        return builder
    }

    /**
     * Sets the padding for the table.
     * @param padding The padding settings to apply
     * @returns A new TableStyler instance with the updated padding
     */
    withPadding(padding: Partial<Padding>): TableStyler<V> {
        const builder = this.copy()
        builder.padding = {...builder.padding, ...padding}
        return builder
    }

    /**
     * Sets the margin for the table.
     * @param margin The margin settings to apply
     * @returns A new TableStyler instance with the updated margin
     */
    withMargin(margin: Partial<Margin>): TableStyler<V> {
        const builder = this.copy()
        builder.margin = {...builder.margin, ...margin}
        return builder
    }

    /**
     * Tags a row with a style.
     * @param rowIndex The index of the row to tag
     * @param tagStyleType The type of style to apply
     * @param style The style value to apply
     * @returns A Result containing a new TableStyler with the tagged row, or an error message
     * @private
     */
    private tagRow<S extends TagValue>(rowIndex: number, tagStyleType: TableStyleType, style: S): Result<TableStyler<V>, string> {
        return this.dataFrame.tagRow<S>(rowIndex, tagStyleType, style)
            // when successfully tagged, make an updated copy of this builder with the new data-frame
            .map(df => this.update({dataFrame: df}))
            // when failed to tag, add to the errors
            .onFailure(error => this.errors.push(error))
    }

    /**
     * Tags a column with a style.
     * @param columnIndex The index of the column to tag
     * @param tagStyleType The type of style to apply
     * @param style The style value to apply
     * @returns A Result containing a new TableStyler with the tagged column, or an error message
     * @private
     */
    private tagColumn<S extends TagValue>(columnIndex: number, tagStyleType: TableStyleType, style: S): Result<TableStyler<V>, string> {
        return this.dataFrame.tagColumn<S>(columnIndex, tagStyleType, style)
            // when successfully tagged, make an updated copy of this builder with the new data-frame
            .map(df => this.update({dataFrame: df}))
            // when failed to tag, add to the errors
            .onFailure(error => this.errors.push(error))
    }

    /**
     * Sets the style for the column header row.
     * @param columnHeaderStyle The style to apply to the column header
     * @param priority The priority of this style (higher values take precedence)
     * @returns A new TableStyler instance with the column header style applied
     */
    withColumnHeaderStyle(
        columnHeaderStyle: Partial<ColumnHeaderStyle> = defaultColumnHeaderStyle,
        priority: number = Infinity
    ): TableStyler<V> {
        if (!TableData.hasColumnHeader(this.dataFrame)) {
            this.errors.push("The column header style can only be supplied when the table data has a column header")
            return this
        }
        // tag the row as a column header style, and if it fails, then return this (unmodified) builder
        return this
            .tagRow<Styling<ColumnHeaderStyle>>(
                0,
                TableStyleType.COLUMN_HEADER,
                stylingFor(columnHeaderStyle, defaultColumnHeaderStyle, priority)
            )
            .getOrElse(this)
    }

    /**
     * Sets the style for the row header column.
     * @param rowHeaderStyle The style to apply to the row header
     * @param priority The priority of this style (higher values take precedence)
     * @returns A new TableStyler instance with the row header style applied
     */
    withRowHeaderStyle(rowHeaderStyle: Partial<RowHeaderStyle>, priority: number = Infinity): TableStyler<V> {
        if (!TableData.hasRowHeader(this.dataFrame)) {
            this.errors.push("The row header style can only be supplied when the table data has row headers")
            return this
        }
        // tag the column with the row header style, and if it fails, then return this (unmodified) builder
        return this
            .tagColumn<Styling<RowHeaderStyle>>(0, TableStyleType.ROW_HEADER, stylingFor(rowHeaderStyle, defaultRowHeaderStyle, priority))
            .getOrElse(this)
    }

    /**
     * Sets the style for the footer row.
     * @param footerStyle The style to apply to the footer
     * @param priority The priority of this style (higher values take precedence)
     * @returns A new TableStyler instance with the footer style applied
     */
    withFooterStyle(footerStyle: Partial<FooterStyle>, priority: number = Infinity): TableStyler<V> {
        if (!TableData.hasFooter(this.dataFrame)) {
            this.errors.push("The footer style can only be supplied when the table data has a footer")
            return this
        }
        // tag the row the footer style, and if it fails, then return this (unmodified) builder
        const footerIndex = TableData.tableRowCount(this.dataFrame) - 1
        return this
            .tagRow<Styling<ColumnHeaderStyle>>(footerIndex, TableStyleType.FOOTER, stylingFor(footerStyle, defaultFooterStyle, priority))
            .getOrElse(this)
    }

    /**
     * Sets the style for a specific row.
     * @param rowIndex The index of the row to style
     * @param rowStyle The style to apply to the row
     * @param priority The priority of this style (higher values take precedence)
     * @returns A new TableStyler instance with the row style applied
     */
    withRowStyle(rowIndex: number, rowStyle: RowStyle, priority: number = 0): TableStyler<V> {
        if (rowIndex < 0 || rowIndex >= TableData.tableRowCount(this.dataFrame)) {
            this.errors.push(
                `The row index, when setting a row-style, must be between 0 and ${TableData.tableRowCount(this.dataFrame) - 1}`
            )
            return this
        }
        // tag the row with a style, and if it fails, then return this (unmodified) builder
        return this
            .tagRow<Styling<RowStyle>>(rowIndex, TableStyleType.ROW, stylingFor(rowStyle, defaultRowStyle, priority))
            .getOrElse(this)
    }

    /**
     * Sets the style for a specific column.
     * @param columnIndex The index of the column to style
     * @param columnStyle The style to apply to the column
     * @param priority The priority of this style (higher values take precedence)
     * @returns A new TableStyler instance with the column style applied
     */
    withColumnStyle(columnIndex: number, columnStyle: ColumnStyle, priority: number = 0): TableStyler<V> {
        if (columnIndex < 0 || columnIndex >= TableData.tableRowCount(this.dataFrame)) {
            this.errors.push(
                `The column index, when setting a column-style, must be between 0 and ${TableData.tableColumnCount(this.dataFrame) - 1}`
            )
            return this
        }
        // tag the row with a style, and if it fails, then return this (unmodified) builder
        return this
            .tagColumn<Styling<ColumnStyle>>(columnIndex, TableStyleType.COLUMN, stylingFor(columnStyle, defaultColumnStyle, priority))
            .getOrElse(this)
    }

    /**
     * Sets the style for a specific cell.
     * @param rowIndex The row index of the cell to style
     * @param columnIndex The column index of the cell to style
     * @param cellStyle The style to apply to the cell
     * @param priority The priority of this style (higher values take precedence)
     * @returns A new TableStyler instance with the cell style applied
     */
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
            .tagCell<Styling<CellStyle>>(rowIndex, columnIndex, TableStyleType.CELL, stylingFor(cellStyle, defaultCellStyle, priority))
            // when successfully tagged, make an updated copy of this builder with the new data-frame
            .map(df => this.update({dataFrame: df}))
            // when failed to tag, add to the errors
            .onFailure(error => this.errors.push(error))
            // when failed, return this (unmodified) builder
            .getOrElse(this)
    }

    /**
     * Finalizes the styling process and creates a StyledTable instance.
     * @returns A StyledTable instance with all the applied styles
     */
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
