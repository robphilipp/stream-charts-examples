import {select, Selection} from 'd3';
import {TextSelection} from "../../d3types";
import {ColumnWidthInfo, RowHeightInfo} from "./tableUtils";
import {textHeightOf, textWidthOf} from "../../utils";
import {TableData} from "./tableData";
import {Result} from "result-fn";
import {
    CellStyle,
    defaultCellStyle,
    defaultColumnHeaderStyle,
    defaultColumnStyle,
    defaultFooterStyle,
    defaultRowHeaderStyle,
    defaultRowStyle,
    StyledTable,
    TextAlignment
} from "./tableStyler";
import {DataFrame} from "data-frame-ts";

export type ElementPlacementInfo = {
    selection: TextSelection
    textWidth: number
    textHeight: number
    cellStyle: CellStyle
}

type TextAnchor = "start" | "middle" | "end"

function textAnchorFrom(align: TextAlignment): TextAnchor {
    switch (align) {
        case "left":
            return "start"
        case "center":
            return "middle"
        case "right":
            return "end"
    }
}

export type TableDimensions = {
    width: number
    height: number
    rows: RowHeightInfo
    columns: ColumnWidthInfo
}

/**
 * Information about the table data
 */
export type TableDataPlacementInfo = {
    readonly tableData: TableData<ElementPlacementInfo>
}

export type CellRenderingDimensions = {
    // the dimensions of the cell to be used when rendering
    width: number
    height: number
    // the coordinates relative to the table group of the text
    x: number
    y: number
}

export type TableRenderingInfo = {
    tableWidth: number
    tableHeight: number
    renderingInfo: TableData<ElementPlacementInfo & CellRenderingDimensions>
}

export function elementInfoFrom(selection: TextSelection, cellStyle: CellStyle): ElementPlacementInfo {
    return {
        selection: selection,
        textWidth: textWidthOf(selection),
        textHeight: textHeightOf(selection),
        cellStyle
    }
}

/**
 * Creates the table
 * @param styledTable
 * @param container
 * @param uniqueTableId
 * @param coordinates
 */
export function createTable<V>(
    styledTable: StyledTable<V>,
    container: SVGSVGElement,
    uniqueTableId: string,
    coordinates: [x: number, y: number]
): Result<TableRenderingInfo, string> {

    // grab a copy of the data as a data-frame
    const tableData = styledTable.tableData()

    const [x, y] = coordinates

    const {top, left} = styledTable.tablePadding()

    // add the group <g> representing the table, to which all the elements will be added, and
    // the group will be translated to the mouse (x, y) coordinates as appropriate
    const tableSelection = select<SVGSVGElement | null, any>(container)
        .append('g')
        .attr('id', tableId(uniqueTableId))
        .attr('class', 'tooltip')
        // the  "+ 10" need to be properly calculated from the padding, margin, etc
        .attr('transform', `translate(${x + left}, ${y + top})`)

        .style('fill', styledTable.tableBackground().color)
        .style('font-family', styledTable.tableFont().family)
        .style('font-size', styledTable.tableFont().size)
        .style('font-weight', styledTable.tableFont().weight)
        .style('fill', styledTable.tableFont().color)

    // creates an SVG group to hold the column header (if there is one), and
    // then add a cell for each column header element
    const columnHeaders = createColumnHeaderPlacementInfo(tableData, tableSelection, uniqueTableId, styledTable)
    const rowHeaders = createRowHeaderPlacementInfo(tableData, tableSelection, uniqueTableId, styledTable)
    const footers = createFooterPlacementInfo(tableData, tableSelection, uniqueTableId, styledTable)
    const data = createDataPlacementInfo(tableData, tableSelection, uniqueTableId, styledTable)

    return TableData
        .fromDataFrame<ElementPlacementInfo>(data)
        .withColumnHeader(columnHeaders)
        .flatMap(tableData => tableData.withRowHeader(rowHeaders))
        .flatMap(tableData => tableData.withFooter(footers))
        .map(tableData => calculateRenderingInfo(tableData, styledTable))
        .map(renderingInfo => placeTextInTable(renderingInfo))
}

/*
    HELPER STUFF
 */

/*
    Add all the SVG elements representing the table and then update the
    coordinates for each of those elements to make a table
 */
enum ELEMENT_TYPE_ID {
    ROW_HEADER = "row-header",
    COLUMN_HEADER = "column-header",
    DATA = "data",
    FOOTER = "footer",
    CELL = "cell"
}

export function tableId(uniqueTableId: string): string {
    return `svg-table-group-${uniqueTableId}`
}

function columnHeaderGroupId(uniqueTableId: string): string {
    return `svg-table-${ELEMENT_TYPE_ID.COLUMN_HEADER}-group-${uniqueTableId}`
}

function rowHeaderGroupId(uniqueTableId: string): string {
    return `svg-table-${ELEMENT_TYPE_ID.ROW_HEADER}-group-${uniqueTableId}`
}

function footerGroupId(uniqueTableId: string): string {
    return `svg-table-${ELEMENT_TYPE_ID.FOOTER}-group-${uniqueTableId}`
}

function dataGroupId(uniqueTableId: string): string {
    return `svg-table-${ELEMENT_TYPE_ID.DATA}-group-${uniqueTableId}`
}

function cellIdFor(uniqueTableId: string, rowIndex: number, columnIndex: number): string {
    return `svg-table-${ELEMENT_TYPE_ID.CELL}-${rowIndex}-${columnIndex}-${uniqueTableId}`
}

function createColumnHeaderPlacementInfo<V>(
    tableData: TableData<V>,
    tableSelection: Selection<SVGGElement, any, null, undefined>,
    uniqueTableId: string,
    styledTable: StyledTable<V>
): Array<ElementPlacementInfo> {
    return tableData
        .columnHeader(true)
        .map(columnHeader => {
            const groupSelection = tableSelection
                .append('g')
                .attr('id', columnHeaderGroupId(uniqueTableId))
                .attr('class', 'tooltip-table-header')
                .style('fill', styledTable.columnHeaderStyle()
                    .map(styling => styling.style.background.color)
                    .getOrElse(defaultColumnHeaderStyle.background.color)
                )
            return columnHeader.map((header, columnIndex) => {
                // the style with the highest priority for the cell
                const style = styledTable
                    .stylesForTableCoordinates(0, columnIndex)
                    .getOrElse({...defaultCellStyle})

                const textSelection = groupSelection
                    .append<SVGTextElement>("text")
                    .attr('id', cellIdFor(uniqueTableId, 0, columnIndex))
                    .style('font-family', style.font.family)
                    .style('font-size', style.font.family)
                    .style('font-weight', style.font.weight)
                    .style('fill', style.font.color)
                    .text(() => `${header}`)

                // return elementInfoFrom(textSelection, style.alignText, {...style.padding})
                return elementInfoFrom(textSelection, {...style})
            })
        })
        .getOrElse([])
}

/**
 *
 * @param tableData
 * @param tableSelection
 * @param uniqueTableId
 * @param styledTable
 */
function createRowHeaderPlacementInfo<V>(
    tableData: TableData<V>,
    tableSelection: Selection<SVGGElement, any, null, undefined>,
    uniqueTableId: string,
    styledTable: StyledTable<V>
): Array<ElementPlacementInfo> {
    return tableData
        .rowHeader(true)
        .map(rowHeader => {
            const groupSelection = tableSelection
                .append('g')
                .attr('id', rowHeaderGroupId(uniqueTableId))
                .attr('class', 'tooltip-table-row-header')
                .style('fill', styledTable.rowHeaderStyle()
                    .map(styling => styling.style.background.color)
                    .getOrElse(defaultRowHeaderStyle.background.color)
                )
            return rowHeader.map((header, rowIndex) => {
                // the style with the highest priority for the cell
                const style = styledTable
                    .stylesForTableCoordinates(0, rowIndex)
                    .getOrElse({...defaultCellStyle})

                const textSelection = groupSelection
                    .append<SVGTextElement>("text")
                    .attr('id', cellIdFor(uniqueTableId, 0, rowIndex))
                    .style('font-family', style.font.family)
                    .style('font-size', style.font.family)
                    .style('font-weight', style.font.weight)
                    .style('fill', style.font.color)
                    .text(() => `${header}`)

                // return elementInfoFrom(textSelection, style.alignText, {...style.padding})
                return elementInfoFrom(textSelection, {...style})
            })
        })
        .getOrElse([])
}

/**
 *
 * @param tableData
 * @param tableSelection
 * @param uniqueTableId
 * @param styledTable
 */
function createFooterPlacementInfo<V>(
    tableData: TableData<V>,
    tableSelection: Selection<SVGGElement, any, null, undefined>,
    uniqueTableId: string,
    styledTable: StyledTable<V>
): Array<ElementPlacementInfo> {
    return tableData
        .footer(true)
        .map(footer => {
            const groupSelection = tableSelection
                .append('g')
                .attr('id', footerGroupId(uniqueTableId))
                .attr('class', 'tooltip-table-footer')
                .style('fill', styledTable.columnHeaderStyle()
                    .map(styling => styling.style.background.color)
                    .getOrElse(defaultFooterStyle.background.color)
                )
            return footer.map((ftr, columnIndex) => {
                // the style with the highest priority for the cell
                const style = styledTable
                    .stylesForTableCoordinates(footer.length - 1, columnIndex)
                    .getOrElse({...defaultCellStyle})

                const textSelection = groupSelection
                    .append<SVGTextElement>("text")
                    .attr('id', cellIdFor(uniqueTableId, 0, columnIndex))
                    .style('font-family', style.font.family)
                    .style('font-size', style.font.family)
                    .style('font-weight', style.font.weight)
                    .style('fill', style.font.color)
                    .text(() => `${ftr}`)

                // return elementInfoFrom(textSelection, style.alignText, {...style.padding})
                return elementInfoFrom(textSelection, {...style})
            })
        })
        .getOrElse([])
}

/**
 *
 * @param tableData
 * @param tableSelection
 * @param uniqueTableId
 * @param styledTable
 */
function createDataPlacementInfo<V>(
    tableData: TableData<V>,
    tableSelection: Selection<SVGGElement, any, null, undefined>,
    uniqueTableId: string,
    styledTable: StyledTable<V>
): DataFrame<ElementPlacementInfo> {
    // when the table has a column header, then the data starts at row 1
    // otherwise, the data starts at row 0
    const rowOffset = tableData.hasColumnHeader() ? 1 : 0
    return tableData
        .data()
        .map(df => {
            const groupSelection = tableSelection
                .append('g')
                .attr('class', 'tooltip-table-data')
                .attr('id', dataGroupId(uniqueTableId))
            //
            return df.mapElements((element, rowIndex, columnIndex) => {
                // the style with the highest priority for the cell
                const style = styledTable
                    .stylesForTableCoordinates(rowIndex + rowOffset, columnIndex)
                    .getOrElse({...defaultCellStyle})

                const textSelection = groupSelection
                    .append<SVGTextElement>("text")
                    .attr('id', cellIdFor(uniqueTableId, rowIndex + rowOffset, columnIndex))
                    .style('font-family', style.font.family)
                    .style('font-size', style.font.family)
                    .style('font-weight', style.font.weight)
                    .style('fill', style.font.color)
                    .text(() => `${element}`)

                // return elementInfoFrom(textSelection, style.alignText, {...style.padding})
                return elementInfoFrom(textSelection, {...style})
            })
        })
        .getOrElse(DataFrame.empty<ElementPlacementInfo>())
}

/**
 * Calculates the
 * 1. table width and height,
 * 2. width of each column in the table,
 * 3. height of each row in the table,
 * 4.
 *
 * @param tableData
 * @param styledTable
 */
function calculateRenderingInfo<V>(
    tableData: TableData<ElementPlacementInfo>,
    styledTable: StyledTable<V>,
): TableRenderingInfo {

    type WithWidthHeight = ElementPlacementInfo & { cellWidth: number, cellHeight: number }

    type MinMax = { min: number, max: number, minValues: Array<number>, maxValues: Array<number> }

    /**
     * Calculates the min and max values for the extracted value from the cell
     * @param elements An array of rows (data frame row slices) or columns (data
     * frame column slices)
     * @param extractor
     */
    function minMaxFor(
        elements: Array<Array<WithWidthHeight>>,
        extractor: (cell: WithWidthHeight) => number
    ): MinMax {
        return elements.reduce(
            (minMax: MinMax, row: Array<WithWidthHeight>): MinMax => {
                const cellValue = row.map(cell => extractor(cell))
                const {min, max, minValues, maxValues} = minMax
                const mins = Math.min(...cellValue)
                minValues.push(mins)
                const maxes = Math.max(...cellValue)
                maxValues.push(maxes)
                return {
                    minValues,
                    min: Math.min(min, mins),
                    maxValues,
                    max: Math.max(max, maxes)
                }
            },
            {min: Infinity, max: -Infinity, minValues: [], maxValues: []})
    }

    const df = tableData.unwrapDataFrame()

    // 1. calculate the bounding box for the element
    // 2. calculate the cell width/height using the bounding width/height and the
    //    maximum and minimum cell width/height from the styling
    const whdf: DataFrame<WithWidthHeight> = df.mapElements((element, rowIndex, columnIndex) => {

        // grab the style for the cell
        const style = styledTable
            .stylesForTableCoordinates(rowIndex, columnIndex)
            .getOrElse({...defaultCellStyle})

        // calculate the actual width and height of the cell
        const {width, height} = calculateCellDimensions(style, element.textWidth, element.textHeight)

        return {...element, cellWidth: width, cellHeight: height}
    })

    // 3. calculate the cell width for each column based on the max and min width of
    //    all the cells in the column
    // 4. calculate the cell height for each row based on the max and min height of
    //    all the cells in the row
    // 5. calculate the table width/height by adding up all the column-widths/row-heights
    // 6. calculate the (x, y)-coordinates of the text for each cell
    // 7. update each cell's coordinates (here we need to update the header groups, footer
    //    groups, and then the cell's coordinates relative to their group.. :()
    const minMaxColumnWidths = minMaxFor(whdf.columnSlices(), cell => cell.cellWidth)
    const minMaxRowHeights = minMaxFor(whdf.rowSlices(), cell => cell.cellHeight)

    const columnWidths = df.columnSlices().map((column, index) => {
        if (index === 0 && tableData.hasRowHeader()) {
            return styledTable.rowHeaderStyle()
                // todo update the styling for the row-headers to include the width and the min and max width
                .map(styling => minMaxColumnWidths.maxValues[index])
                .getOrElse(Math.max(defaultColumnStyle.dimension.minWidth, Math.min(defaultColumnStyle.dimension.maxWidth, minMaxColumnWidths.maxValues[index])))
        }
        return styledTable.columnStyleFor(index)
            .map(styling => Math.max(styling.style.dimension.minWidth, Math.min(styling.style.dimension.maxWidth, minMaxColumnWidths.maxValues[index])))
            .getOrElse(Math.max(defaultColumnStyle.dimension.minWidth, Math.min(defaultColumnStyle.dimension.maxWidth, minMaxColumnWidths.maxValues[index])))
    })
    const rowHeights = df.rowSlices().map((row, index) => {
        if (index === 0 && tableData.hasColumnHeader()) {
            return styledTable.columnHeaderStyle()
                .map(styling => Math.max(styling.style.dimension.minHeight, Math.min(styling.style.dimension.maxHeight, minMaxRowHeights.maxValues[index])))
                .getOrElse(Math.max(defaultRowStyle.dimension.minHeight, Math.min(defaultRowStyle.dimension.maxHeight, minMaxRowHeights.maxValues[index])))
        }
        return styledTable.rowStyleFor(index)
            .map(styling => Math.max(styling.style.dimension.minHeight, Math.min(styling.style.dimension.maxHeight, minMaxRowHeights.maxValues[index])))
            .getOrElse(Math.max(defaultRowStyle.dimension.minHeight, Math.min(defaultRowStyle.dimension.maxHeight, minMaxRowHeights.maxValues[index])))
    })

    const dimAdjustedDf = df
        .mapElements((element, rowIndex, columnIndex): ElementPlacementInfo =>
            ({
                ...element,
                cellStyle: {
                    ...element.cellStyle,
                    dimension: {
                        ...element.cellStyle.dimension,
                        width: columnWidths[columnIndex],
                        height: rowHeights[rowIndex]
                    }
                }
            })
        )

    // todo gross as shit, is there a better way
    const cumColumnWidths = columnWidths.reduce((sum: Array<number>, curr: number, index) => {
        sum.push(curr + sum[index])
        return sum
    }, [0])
    const cumRowHeights = rowHeights.reduce((sum: Array<number>, curr: number, index) => {
        sum.push(curr + sum[index])
        return sum
    }, [0])
    const positionAdjustedDf = dimAdjustedDf
        .mapElements((element, rowIndex, columnIndex): ElementPlacementInfo & CellRenderingDimensions => {
            const cellWidth = element.cellStyle.dimension.width
            const cellHeight = element.cellStyle.dimension.height
            return {
                ...element,
                width: cellWidth,
                height: cellHeight,
                x: cumColumnWidths[columnIndex] + cellXOffset(element, cellWidth),
                y: cumRowHeights[rowIndex] + element.cellStyle.padding.top,
            }
        })

    return {
        tableWidth: columnWidths.reduce((sum, width) => sum + width, 0),
        tableHeight: rowHeights.reduce((sum, height) => sum + height, 0),
        renderingInfo: TableData.fromDataFrame(positionAdjustedDf)
    }
}


/**
 * Calculates the row and column dimensions based on the min and max width and hieght of
 * the cells.
 * @param style
 * @param width
 * @param height
 */
function calculateCellDimensions(style: CellStyle, width: number, height: number): {
    width: number,
    height: number
} {
    return {
        width: Math.max(
            Math.min(
                width + style.padding.left + style.padding.right,
                style.dimension.maxWidth
            ),
            style.dimension.minWidth
        ),
        height: Math.max(
            Math.min(
                height + style.padding.top + style.padding.bottom,
                style.dimension.maxHeight
            ),
            style.dimension.minHeight
        )
    }
}

/**
 * Calculates the x-offset of the text with the cell
 * @param element The element to render
 * @param cellWidth The width of the cell into which the text is rendered
 */
function cellXOffset(element: ElementPlacementInfo, cellWidth: number): number {
    switch (element.cellStyle.alignText) {
        case "left":
            return element.cellStyle.padding.left

        case "center":
            return cellWidth / 2

        case "right":
            return cellWidth - element.cellStyle.padding.right
    }
}

/**
 * Places the text into the table at its (x, y) coordinates, and returns the {@link TableData} holding
 * the updated values.
 * @param tableRenderingInfo The information for rendering the text as a table
 * @return A {@link TableData} holding the updated values.
 */
function placeTextInTable(tableRenderingInfo: TableRenderingInfo): TableRenderingInfo {
    const updatedDf = tableRenderingInfo.renderingInfo.unwrapDataFrame()
        .mapElements(info => {
            info.selection
                .attr('text-anchor', textAnchorFrom(info.cellStyle.alignText))
                // todo expose style parameter
                .attr('dominant-baseline', 'central')
                .attr('transform', `translate(${info.x}, ${info.y})`)
            return info
        })
    return {
        ...tableRenderingInfo,
        renderingInfo: TableData.fromDataFrame(updatedDf)
    }
}

