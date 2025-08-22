import {select, Selection} from 'd3';
import {TextSelection} from "../../d3types";
import {
    calculateTableCellDimensions,
    ColumnWidthInfo,
    defaultHeaderTableFont,
    defaultTableFont,
    placeTableCellsRelativeToTable,
    RowHeightInfo,
    translateTableToTooltipLocation,
    validateInfoDimensions
} from "./tableUtils";
import {textHeightOf, textWidthOf} from "../../utils";
import {TableData} from "./tableData";
import {failureResult, Result, successResult} from "result-fn";
import {
    CellStyle,
    defaultCellStyle,
    defaultColumnHeaderStyle,
    defaultColumnStyle,
    defaultFooterStyle,
    defaultRowHeaderStyle, Dimension,
    Padding,
    StyledTable
} from "./tableStyler";
import {DataFrame} from "data-frame-ts";
import * as d3 from "d3";

// export type TableFont = {
//     size: number
//     color: string
//     family: string
//     weight: number
// }
//
// export type Background = {
//     color: string
//     opacity: number
// }
//
// export type Padding = {
//     left: number
//     right: number
//     top: number
//     bottom: number
// }
//
// export type Margin = {
//     left: number
//     right: number
//     top: number
//     bottom: number
// }
//
// export type Border = {
//     color: string
//     width: number
//     radius: number
// }
//
// export type ColumnStyle = {
//     defaultWidth: number
//     minWidth: number
//     maxWidth: number
//     leftPadding: number
//     rightPadding: number
//     alignText: "left" | "center" | "right"
// }
//
// export type RowStyle = {
//     defaultHeight: number
//     minHeight: number
//     maxHeight: number
//     topPadding: number
//     bottomPadding: number
// }
//
// /**
//  * Confusing as it may be, this is the style for the **row** that holds the
//  * headers for each column. The styling for this row may differ from the
//  * other rows in the table.
//  */
// export type ColumnHeaderStyle = {
//     height: number
//     topPadding: number
//     bottomPadding: number
// }
//
// /**
//  * Confusing as it may be, this is the style for the **column** that holds
//  * the headers for each row. The styling for this column may differ from the
//  * columns in the table.
//  */
// export type RowHeaderStyle = {
//     width: number
//     leftPadding: number
//     rightPadding: number
//     alignText: "left" | "right" | "center"
// }
//
// export type TableStyle = {
//     font: TableFont,
//     headerFont: TableFont,
//
//     background: Background
//     headerBackground: Background
//
//     // borderColor: string
//     // borderWidth: number
//     // borderRadius: number
//     border: Border
//
//     // the default width of the table bounds (the actual table will have a width
//     // that is calculated by (defaultWidth - paddingLeft - paddingRight)
//     width: number
//     // the default height of the table bounds (the actual table will have a height
//     // that is calculated by (defaultHeight - paddingTop - paddingBottom)
//     height: number
//
//     padding: Padding
//     margin: Margin
//
//
//     // a row may have a header, and the row-headers form a column that sits before
//     // the other columns, and so here we want the width of that column. this value
//     // must be specified if the data has row-headers
//     rowHeaderStyle: RowHeaderStyle
//
//     // a column may have a header, and the column-headers form a row that sits before
//     // the other rows, and so here we want the height of that row. this value must be
//     // specified if the data has column-headers
//     columnHeaderStyle: ColumnHeaderStyle
//
//     // the style (height bounds and padding) for each row
//     rows: Array<RowStyle>
//     // the style (width bounds, padding, and text alignment) for each column
//     columns: Array<ColumnStyle>
// }

export type ElementPlacementInfo = {
    selection: TextSelection
    textWidth: number
    textHeight: number
    alignText: TextAnchor
    padding: Padding
}

export type Point = { x: number, y: number }
type TextAnchor = "start" | "middle" | "end"
type TextAlignment = "left" | "center" | "right"

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

export type ColumnDimension = {
    // the width of the cell based on the column-width (generally calculated)
    width: number
    // the offset of the text anchor from the left of the cell (the x-coordinate)
    textOffset: number
    // the location of the text anchor, which is determined by the text-alignment
    // for example, a text-alignment of "right" sets the anchor to "end", a text-alignment
    // or "left" sets the anchor to "start", and a text-alignment of "center" sets
    // the anchor to "middle".
    textAlignment: TextAnchor
}

export type RowDimension = {
    // the height of the cell based on the row-height (generally calculated)
    height: number
    // the offset of the text anchor from the top on the cell (the y-coordinate)
    textOffset: number
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
    // readonly rowHeaders: Array<ElementInfo>,
    // readonly columnHeaders: Array<ElementInfo>,
    // readonly data: Array<Array<ElementPlacementInfo>>
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

// /**
//  * Validates the table dimensions and converts the arguments to a {@link TableDataPlacementInfo}
//  * @param rowHeaderInfo
//  * @param columnHeaderInfo
//  * @param dataInfo
//  * @return A {@link TableDataPlacementInfo} object holding the selection and the text width and height for
//  * each table cell (including the headers)
//  */
// export function tableInfoFrom(
//     rowHeaderInfo: Array<ElementPlacementInfo>,
//     columnHeaderInfo: Array<ElementPlacementInfo>,
//     dataInfo: Array<Array<ElementPlacementInfo>>,
//     // hasColumnHeaders: boolean,
//     // hasRowHeaders: boolean,
// ): Result<TableDataPlacementInfo, string> {
//     return validateInfoDimensions({rowHeaders: rowHeaderInfo, columnHeaders: columnHeaderInfo, data: dataInfo})
// }

// export function tableInfoFrom(
//     rowHeaderInfo: Array<ElementInfo>,
//     columnHeaderInfo: Array<ElementInfo>,
//     dataInfo: Array<Array<ElementInfo>>
// ): Result<TableDataInfo, string> {
//     return validateInfoDimensions({rowHeaders: rowHeaderInfo, columnHeaders: columnHeaderInfo, data: dataInfo})
// }

export function elementInfoFrom(selection: TextSelection, align: TextAlignment, padding: Padding): ElementPlacementInfo {
    return {
        selection: selection,
        textWidth: textWidthOf(selection),
        textHeight: textHeightOf(selection),
        alignText: textAnchorFrom(align),
        padding: padding
    }
}

export function tableId(uniqueTableId: string): string {
    return `svg-table-group-${uniqueTableId}`
}

export function tableElementId(uniqueTableId: string, rowIndex: number, columnIndex: number): string {
    return `#${tableElementIdBase(uniqueTableId, rowIndex, columnIndex)}`
}

export function tableElementQuerySelector(uniqueTableId: string, rowIndex: number, columnIndex: number): string {
    return `[id="${tableElementIdBase(uniqueTableId, rowIndex, columnIndex)}"]`
}

function tableElementIdBase(uniqueTableId: string, rowIndex: number, columnIndex: number): string {
    return `svg-table-element-${uniqueTableId}-${rowIndex}-${columnIndex}`
}

export function createTable<V>(
    styledTable: StyledTable<V>,
    container: SVGSVGElement,
    uniqueTableId: string,
    coordinates: (width: number, height: number) => Point,
): Result<TableDataPlacementInfo, string> {

    // grab a copy of the data as a data-frame
    // const dataFrame = styledTable.data();
    // const tableData = TableData.fromDataFrame(dataFrame)
    const tableData = styledTable.tableData()
    // const dataFrame = tableData.unwrapDataFrame()
    // const dataFrame = tableData.unwrapDataFrame()

    // const {font, background, columnHeaderStyle, rowHeaderStyle} = styledTable

    // todo don't need to do all this craziness with the headers, just run through the table data
    //      and if this is a header row or a header column, then assign appropriate style

    // check widths and heights dimensions
    // todo deal with the result properly
    // return validateTableDimensions(styledTable).andThen(() => {

    /*
        Add all the SVG elements representing the table, and then update the
        coordinates of each of those elements to make a table
     */
    enum ELEMENT_TYPE_ID {
        ROW_HEADER = "row-header",
        COLUMN_HEADER = "column-header",
        DATA = "data",
        FOOTER = "footer",
        CELL = "cell"
    }

    enum ELEMENT_TYPE_CLASS {
        ROW_HEADER = "row-header",
        COLUMN_HEADER = "column-header",
        DATA = "data",
        FOOTER = "footer"
    }

    type ElementType = {
        id: ELEMENT_TYPE_ID,
        class: ELEMENT_TYPE_CLASS
    }

    function columnHeaderGroupId(): string {
        return `svg-table-${ELEMENT_TYPE_ID.COLUMN_HEADER}-group-${uniqueTableId}`
    }

    function rowHeaderGroupId(): string {
        return `svg-table-${ELEMENT_TYPE_ID.ROW_HEADER}-group-${uniqueTableId}`
    }

    function footerGroupId(): string {
        return `svg-table-${ELEMENT_TYPE_ID.FOOTER}-group-${uniqueTableId}`
    }

    function dataGroupId(): string {
        return `svg-table-${ELEMENT_TYPE_ID.DATA}-group-${uniqueTableId}`
    }

    function cellIdFor(rowIndex: number, columnIndex: number): string {
        return `svg-table-${ELEMENT_TYPE_ID.CELL}-${rowIndex}-${columnIndex}-${uniqueTableId}`
    }

    function elementType(rowIndex: number, columnIndex: number): Result<ElementType, string> {
        if (styledTable.hasRowHeader() && rowIndex === 0) {
            return successResult({id: ELEMENT_TYPE_ID.ROW_HEADER, class: ELEMENT_TYPE_CLASS.ROW_HEADER})
        }
        if (styledTable.hasColumnHeader() && columnIndex === 0) {
            return successResult({id: ELEMENT_TYPE_ID.COLUMN_HEADER, class: ELEMENT_TYPE_CLASS.COLUMN_HEADER})
        }
        if (styledTable.hasFooter() && rowIndex === styledTable.data().rowCount() - 1) {
            successResult({id: ELEMENT_TYPE_ID.FOOTER, class: ELEMENT_TYPE_CLASS.FOOTER})
        }
        return failureResult(`(TableSvg::elementTypeFor) Unable to determine the element type for row ${rowIndex} and column ${columnIndex}`)
    }

    function createColumnHeaderPlacementInfo<V>(
        tableData: TableData<V>,
        tableSelection: Selection<SVGGElement, any, null, undefined>
    ): Array<ElementPlacementInfo> {
        return tableData
            .columnHeader(true)
            .map(columnHeader => {
                const groupSelection = tableSelection
                    .append('g')
                    .attr('id', columnHeaderGroupId())
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
                        .attr('id', cellIdFor(0, columnIndex))
                        .style('font-family', style.font.family)
                        .style('font-size', style.font.family)
                        .style('font-weight', style.font.weight)
                        .style('fill', style.font.color)
                        .text(() => `${header}`)

                    return elementInfoFrom(textSelection, style.alignText, {...style.padding})
                })
            })
            .getOrElse([])
    }

    function createRowHeaderPlacementInfo<V>(
        tableData: TableData<V>,
        tableSelection: Selection<SVGGElement, any, null, undefined>
    ): Array<ElementPlacementInfo> {
        return tableData
            .rowHeader(true)
            .map(rowHeader => {
                const groupSelection = tableSelection
                    .append('g')
                    .attr('id', rowHeaderGroupId())
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
                        .attr('id', cellIdFor(0, rowIndex))
                        .style('font-family', style.font.family)
                        .style('font-size', style.font.family)
                        .style('font-weight', style.font.weight)
                        .style('fill', style.font.color)
                        .text(() => `${header}`)

                    return elementInfoFrom(textSelection, style.alignText, {...style.padding})
                })
            })
            .getOrElse([])
    }

    function createFooterPlacementInfo<V>(
        tableData: TableData<V>,
        tableSelection: Selection<SVGGElement, any, null, undefined>
    ): Array<ElementPlacementInfo> {
        return tableData
            .footer(true)
            .map(footer => {
                const groupSelection = tableSelection
                    .append('g')
                    .attr('id', footerGroupId())
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
                        .attr('id', cellIdFor(0, columnIndex))
                        .style('font-family', style.font.family)
                        .style('font-size', style.font.family)
                        .style('font-weight', style.font.weight)
                        .style('fill', style.font.color)
                        .text(() => `${ftr}`)

                    return elementInfoFrom(textSelection, style.alignText, {...style.padding})
                })
            })
            .getOrElse([])
    }

    function createDataPlacementInfo<V>(
        tableData: TableData<V>,
        tableSelection: Selection<SVGGElement, any, null, undefined>
    ): DataFrame<ElementPlacementInfo> {
        return tableData
            .data()
            .map(df => {
                const groupSelection = tableSelection
                    .append('g')
                    .attr('class', 'tooltip-table-data')
                    .attr('id', dataGroupId())
                //
                return df.mapElements((element, rowIndex, columnIndex) => {
                    // the style with the highest priority for the cell
                    const style = styledTable
                        .stylesForTableCoordinates(rowIndex, columnIndex)
                        .getOrElse({...defaultCellStyle})

                    const textSelection = groupSelection
                        .append<SVGTextElement>("text")
                        .attr('id', cellIdFor(rowIndex, columnIndex))
                        .style('font-family', style.font.family)
                        .style('font-size', style.font.family)
                        .style('font-weight', style.font.weight)
                        .style('fill', style.font.color)
                        .text(() => `${element}`)

                    return elementInfoFrom(textSelection, style.alignText, {...style.padding})
                })
            })
            .getOrElse(DataFrame.empty<ElementPlacementInfo>())
    }


    // add the group <g> representing the table, to which all the elements will be added, and
    // the group will be translated to the mouse (x, y) coordinates as appropriate
    const tableSelection = select<SVGSVGElement | null, any>(container)
        .append('g')
        .attr('id', tableId(uniqueTableId))
        .attr('class', 'tooltip')
        // .attr('class', 'tooltip-table')
        .style('fill', styledTable.tableBackground().color)
        .style('font-family', styledTable.tableFont().family)
        .style('font-size', styledTable.tableFont().size)
        .style('font-weight', styledTable.tableFont().weight)
        .style('fill', styledTable.tableFont().color)

    // creates an SVG group to hold the column header (if there is one), and
    // then add a cell for each column header element
    const columnHeaders = createColumnHeaderPlacementInfo(tableData, tableSelection)
    const rowHeaders = createRowHeaderPlacementInfo(tableData, tableSelection)
    const footers = createFooterPlacementInfo(tableData, tableSelection)

    function calculateRenderingInfo(tableData: TableData<ElementPlacementInfo>): TableData<TableRenderingInfo> {

        type WithWidthHeight = ElementPlacementInfo & { cellWidth: number, cellHeight: number }

        /**
         * Calculates the min and max values for the extracted value from the cell
         * @param elements An array of rows (data frame row slices) or columns (data
         * frame column slices)
         * @param extractor
         */
        function minMaxFor(
            elements: Array<Array<WithWidthHeight>>,
            extractor: (cell: WithWidthHeight) => number
        ): [number, number] {
            return elements.reduce(
                (minMax: [min: number, max: number], row: Array<WithWidthHeight>): [min: number, max: number] => {
                    const cellValue = row.map(cell => extractor(cell))
                    const [min, max] = minMax
                    return [
                        Math.min(min, Math.min(...cellValue)),
                        Math.max(max, Math.max(...cellValue))
                    ]
                },
                [Infinity, -Infinity])
        }

        tableData.data()
            .map(df => {

                // todo outline of the steps for rendering the svg table
                // 1. calculate the bounding box for the element
                // 2. calculate the cell width/height using the bounding width/height and the
                //    maximum and minimum cell width/height from the styling
                const whdf: DataFrame<WithWidthHeight> = df.mapElements((element, rowIndex, columnIndex) => {

                    // grab the style for the cell
                    const style = styledTable
                        .stylesForTableCoordinates(rowIndex, columnIndex)
                        .getOrElse({...defaultCellStyle})

                    // grab the text node
                    const text = d3.select<SVGSVGElement | null, any>(container)
                        .attr('id', cellIdFor(rowIndex, columnIndex))

                    // calculate the actual width and height of the cell
                    const {width, height} = calculateCellDimensions(style, text.node()?.getBBox())

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
                const [minWidth, maxWidth] = minMaxFor(whdf.columnSlices(), cell => cell.cellWidth)
                const [minHeight, maxHeight] = minMaxFor(whdf.rowSlices(), cell => cell.cellHeight)
                // whdf.rowSlices().reduce(
                //     (minMax: [min: number, max: number], row) => {
                //         const cellWidth = row.map(cell => cell.cellWidth)
                //         const [min, max] = minMax
                //         return [
                //             Math.min(min, Math.min(...cellWidth)),
                //             Math.max(max, Math.max(...cellWidth))
                //         ]
                //     },
                //     [Infinity, -Infinity])
                // const maxWidth = Math.max(...whdf.rowSlices().map(row => Math.max(...row.map(cell => cell.cellWidth))))
                // const minWidth = Math.min(...whdf.rowSlices().map(row => Math.min(...row.map(cell => cell.cellWidth))))
            })

        // todo remove this temporary return
        return TableData.fromDataFrame(DataFrame.empty<TableRenderingInfo>())
    }

    function calculateCellDimensions(style: CellStyle, boundingBox: DOMRect | undefined): {
        width: number,
        height: number
    } {
        const width = boundingBox === undefined ? style.dimension.defaultWidth : boundingBox.width
        const height = boundingBox === undefined ? style.dimension.defaultHeight : boundingBox.height
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

    // create an SVG group containing the "data" cells (i.e. no headers or footer) and then
    // add the element info for each cell, and then conditionally add the headers and footers
    return successResult<DataFrame<ElementPlacementInfo>, string>(createDataPlacementInfo(tableData, tableSelection))
        .map(data => TableData.fromDataFrame<ElementPlacementInfo>(data))
        .conditionalFlatMap(
            _ => columnHeaders.length > 0,
            tableData => tableData.withColumnHeader(columnHeaders)
        )
        .conditionalFlatMap(
            _ => rowHeaders.length > 0,
            tableData => tableData.withRowHeader(rowHeaders)
        )
        .conditionalFlatMap(
            _ => footers.length > 0,
            tableData => tableData.withFooter(footers)
        )
        .map(tableData => ({tableData}))
    // // create an SVG group containing the "data" cells (i.e. no headers or footer) and then
    // // add the element info for each cell
    // const data = createDataPlacementInfo(tableData, tableSelection)
    //
    // let svgTableData = TableData.fromDataFrame<ElementPlacementInfo>(data)
    // if (columnHeaders.length > 0) {
    //     svgTableData = svgTableData.withColumnHeader(columnHeaders).getOrThrow()
    // }
    // if (rowHeaders.length > 0) {
    //     svgTableData = svgTableData.withRowHeader(rowHeaders).getOrThrow()
    // }
    // if (footers.length > 0) {
    //     svgTableData = svgTableData.withFooter(footers).getOrThrow()
    // }
    // .withColumnHeader(columnHeaders)
    // .flatMap(tableData => tableData.withRowHeader(rowHeaders))
    // .flatMap(tableData => tableData.withFooter(footers))

    // //
    // // when the table has column headers, then create the SVG elements for the column headers and add
    // // the relevant styles to each element in the column headers (e.g. the first/header row in the table)
    // //
    // // const columnHeaders: Array<ElementPlacementInfo> = []
    // if (styledTable.hasColumnHeader()) {
    //     // this is the group <g> representing row of column headers that sits on top of the table
    //     const columnHeaderRowSelection = tableSelection
    //         .append('g')
    //         .attr('id', `svg-table-header-group-${uniqueTableId}`)
    //         .attr('class', 'tooltip-table-header')
    //         .style('fill', styledTable.columnHeaderStyle().map(styling => styling.style.background.color).getOrThrow())
    //
    //     // when each row has a header (i.e. the table has row-headers) and we have column headers,
    //     // then need to add an extra cell to beginning of the column header
    //     if (styledTable.hasColumnHeader() && styledTable.hasRowHeader()) {
    //         // we know that the table has a column-header, so we unwrap the style or throw an error
    //         const columnHeaderStyle = styledTable
    //             .columnHeaderStyle()
    //             .map(styling => styling.style)
    //             .getOrThrow()
    //         const selection = columnHeaderRowSelection
    //             .append<SVGTextElement>("text")
    //             .attr('id', tableElementId(uniqueTableId, 0, 0))
    //             .style('font-family', columnHeaderStyle.font.family)
    //             .style('font-size', columnHeaderStyle.font.family)
    //             .style('font-weight', columnHeaderStyle.font.weight)
    //             .style('fill', columnHeaderStyle.font.color)
    //             .text(() => " ")
    //
    //         // we know that the table has a row-header, so we unwrap the style or throw an error
    //         const rowHeaderStyle = styledTable
    //             .rowHeaderStyle()
    //             .map(styling => styling.style)
    //             .getOrThrow()
    //
    //         const padding: Padding = {...rowHeaderStyle.padding, ...columnHeaderStyle.padding}
    //         columnHeaders.push(elementInfoFrom(selection, columnHeaderStyle.alignText, padding))
    //     }
    //
    //     // append the headers and hold them in an array so that we can position them after figuring out
    //     // the "optimal" width of each column
    //     const dataStartColumnIndex: number = tableData.hasRowHeader() ? 1 : 0
    //     // const columnHeaderData: Row<V> = tableData.columnHeader().getOrElse([])
    //     // columnHeaderData.forEach((element, colIndex) => {
    //     tableData.columnHeader().onSuccess(columnHeaderData => {
    //         columnHeaderData.forEach((element, colIndex) => {
    //             const columnHeaderStyle = styledTable.columnHeaderStyle()
    //                 .map(styling => styling.style)
    //                 .getOrElse(defaultColumnHeaderStyle)
    //             const selection = columnHeaderRowSelection
    //                 .append<SVGTextElement>("text")
    //                 .attr('id', tableElementId(uniqueTableId, 0, dataStartColumnIndex + colIndex))
    //                 .style('font-family', columnHeaderStyle.font.family)
    //                 .style('font-size', columnHeaderStyle?.font.family)
    //                 .style('font-weight', columnHeaderStyle?.font.weight)
    //                 .style('fill', columnHeaderStyle?.font.color)
    //                 .text(() => `{$element}`)
    //
    //             // grab the column padding for the "left" and "right" padding, and the column
    //             // header padding for the "top" and "bottom" to make a complete Padding object
    //             const columnPadding = styledTable.columnStyleFor(colIndex)
    //                 .map(styling => styling.style.padding)
    //                 .getOrElse(defaultColumnStyle.padding)
    //             const padding: Padding = {...columnPadding, ...columnHeaderStyle.padding}
    //
    //             columnHeaders.push(elementInfoFrom(selection, columnHeaderStyle.alignText, padding))
    //         })
    //     })
    // }

    // // tableData.unwrapDataFrame().
    //     //
    //     // add the table elements, adding row headers to each row, if they exist
    //     //
    //     // todo need to add the data structure (matrix of ElementInfo) for the table and put the column headers are the top
    //     const
    // data: Array<Array<ElementPlacementInfo>> = []
    // const dataStartRowIndex: number = styledTable.hasColumnHeader() ? 1 : 0
    // // when the table has row headers and column headers then add a row header to the
    // // beginning of each row. the column header has already been taken care of and so
    // // we don't need to do anything further for it.
    // tableData.data().slice(dataStartRowIndex).forEach((row, rowIndex) => {
    //
    //     const dataStartColumnIndex: number = tableData.hasRowHeader ? 1 : 0
    //     const colStyle = styledTable.columnStyles[dataStartRowIndex + rowIndex]
    //     const rowData: Array<ElementPlacementInfo> = []
    //     row.slice(dataStartColumnIndex).forEach((elem, colIndex) => {
    //         const rowStyle = styledTable.rowStyles[dataStartColumnIndex + colIndex];
    //         const dataElem = tableSelection
    //             .append<SVGTextElement>("text")
    //             .attr('id', tableElementId(uniqueTableId, dataStartRowIndex + rowIndex, 0))
    //             .style('font-family', rowStyle.font.family || defaultTableFont.family)
    //             .style('font-size', rowStyle.font.family || defaultTableFont.size)
    //             .style('font-weight', rowStyle.font.weight || defaultTableFont.weight)
    //             .style('fill', rowStyle.font.color || defaultTableFont.color)
    //             .text(() => row[0].label)
    //         const padding: Padding = {...styledTable.rowStyles[dataStartRowIndex + rowIndex].padding, ...rowHeaderStyle.padding}
    //         rowData.push(elementInfoFrom(dataElem, rowHeaderStyle.alignText, padding))
    //     })
    //
    //     if (tableData.hasRowHeader) {
    //         const header = tableSelection
    //             .append<SVGTextElement>("text")
    //             .attr('id', tableElementId(uniqueTableId, dataStartRowIndex + rowIndex, 0))
    //             .style('font-family', rowHeaderStyle?.font.family || defaultHeaderTableFont.family)
    //             .style('font-size', rowHeaderStyle?.font.family || defaultHeaderTableFont.size)
    //             .style('font-weight', rowHeaderStyle?.font.weight || defaultHeaderTableFont.weight)
    //             .style('fill', rowHeaderStyle?.font.color || defaultTableFont.color)
    //             .text(() => row[0].label)
    //         const padding: Padding = {...styledTable.rowStyles[dataStartRowIndex + rowIndex].padding, ...rowHeaderStyle.padding}
    //         // rowHeaders.push(elementInfoFrom(header, rowHeaderStyle.alignText, padding))
    //         rowData.unshift(elementInfoFrom(header, rowHeaderStyle.alignText, padding))
    //     }
    //
    //     // add the row to the table
    //     data.push(rowData)
    // })
    //
    // // add any columns headers (a row) to the beginning of the table
    // if (tableData.hasColumnHeader) {
    //     data.unshift(columnHeaders)
    // }
    //
    // // return data
    // return tableInfoFrom(columnHeaders, columnHeaders, data)
    //     .andThen(tableInfo => calculateTableCellDimensions(styledTable, tableInfo, tableData))
    //     .map(tableDimensions => {
    //         placeTableCellsRelativeToTable(shallowCopy, tableSelection, tableDimensions)
    //             .onSuccess(tableSelection => translateTableToTooltipLocation(tableSelection, coordinates(tableDimensions.width, tableDimensions.height)))
    //         return tableDimensions
    //     })


    // const dataStartColumnIndex: number = tableData.hasRowHeaders ? 1 : 0
    // tableData.data.slice(dataStartColumnIndex).forEach()


    // const dataStartRowIndex: number = tableData.hasColumnHeaders && tableData.hasRowHeaders ? 1 : 0
    // const data: Array<Array<ElementInfo>> = tableData.data.map((row: Row, rowIndex: number) => {
    //     // add the row-header column to the svg table, if there are row headers, and add the selection
    //     // to the array of row-header info
    //     if (tableData.hasRowHeaders) {
    //         // when there is a header, the data elements start in the second column
    //         const header = tableSelection
    //             .append<SVGTextElement>("text")
    //             .attr('id', tableElementId(uniqueTableId, dataStartRowIndex + rowIndex, 0))
    //             .text(() => tableData.data[rowIndex].label)
    //         // .text(() => tableData.rowHeader[rowIndex].label)
    //         columnHeaders.push(elementInfoFrom(header))
    //     }

    // // add a table cell for each element in the row
    // return row.map((element: string, columnIndex: number) => {
    //     const selection = tableSelection
    //         .append<SVGTextElement>("text")
    //         .attr('id', tableElementId(uniqueTableId, dataStartRowIndex + rowIndex, dataStartColumnIndex + columnIndex))
    //         .text(() => element)
    //     return elementInfoFrom(selection)
    // })

    // })

    // // const tableInfo: TableInfo = {rowHeaders, columnHeaders, data}
    // // create a matrix holding the headers and the data element-info cells
    // const shallowCopy: Array<Array<ElementInfo>> = data.map((row: Row) => [...row])
    // // append the column headers to the top of the data
    // shallowCopy.unshift([...columnHeaders])
    // // append the row headers to each row of the data
    // shallowCopy.forEach((row: Row, rowIndex: number) => row.unshift(columnHeaders[rowIndex]))

    // return tableInfoFrom(columnHeaders, columnHeaders, data)
    //     .andThen(tableInfo => calculateTableCellDimensions(style, tableInfo, tableData))
    //     .map(tableDimensions => {
    //         placeTableCellsRelativeToTable(shallowCopy, tableSelection, tableDimensions)
    //             .onSuccess(tableSelection => translateTableToTooltipLocation(tableSelection, coordinates(tableDimensions.width, tableDimensions.height)))
    //         return tableDimensions
    //     })
    // return tableInfoFrom(rowHeaders, columnHeaders, data)
    //     .andThen(tableInfo => calculateTableCellDimensions(style, tableInfo, tableData))
    //     .map(tableDimensions => {
    //         placeTableCellsRelativeToTable(uniqueTableId, tableInfo, tableSelection, tableDimensions)
    //             .onSuccess(tableSelection => translateTableToTooltipLocation(tableSelection, coordinates))
    //         return tableDimensions
    //     })
    //     })

}