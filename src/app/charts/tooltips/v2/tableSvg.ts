import {select} from 'd3';
import {TextSelection} from "../../d3types";
import {
    calculateTableCellDimensions,
    ColumnWidthInfo,
    defaultHeaderTableBackground,
    defaultHeaderTableFont,
    defaultTableBackground,
    defaultTableFont,
    placeTableCellsRelativeToTable,
    RowHeightInfo,
    translateTableToTooltipLocation,
    validateInfoDimensions,
    validateTableDimensions
} from "./tableUtils";
import {textHeightOf, textWidthOf} from "../../utils";
import {Row, TableData} from "./tableData";
import {Result} from "result-fn";
import {ColumnHeaderStyle, ColumnStyle, Dimension, Padding, RowHeaderStyle, RowStyle, TableStyle} from "./tableStyle";

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

type Point = { x: number, y: number }
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
    readonly data: Array<Array<ElementPlacementInfo>>
}

/**
 * Validates the table dimensions and converts the arguments to a {@link TableDataPlacementInfo}
 * @param rowHeaderInfo
 * @param columnHeaderInfo
 * @param dataInfo
 * @return A {@link TableDataPlacementInfo} object holding the selection and the text width and height for
 * each table cell (including the headers)
 */
export function tableInfoFrom(
    rowHeaderInfo: Array<ElementPlacementInfo>,
    columnHeaderInfo: Array<ElementPlacementInfo>,
    dataInfo: Array<Array<ElementPlacementInfo>>,
    // hasColumnHeaders: boolean,
    // hasRowHeaders: boolean,
): Result<TableDataPlacementInfo, string> {
    return validateInfoDimensions({rowHeaders: rowHeaderInfo, columnHeaders: columnHeaderInfo, data: dataInfo})
}
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

export function createTable(
    tableData: TableData,
    container: SVGSVGElement,
    uniqueTableId: string,
    style: TableStyle,
    coordinates: (width: number, height: number) => [x: number, y: number],
): Result<TableDimensions, string> {

    const {font, background, columnHeaderStyle, rowHeaderStyle} = style

    // todo don't need to do all this craziness with the headers, just run through the table data
    //      and if this is a header row or a header column, then assign appropriate style

    // check widths and heights dimensions
    // todo deal with the result properly
    return validateTableDimensions(style, tableData).andThen(() => {

        /*
            Add all the SVG elements representing the table, and then update the
            coordinates of each of those elements to make a table
         */

        // add the group <g> representing the table, to which all the elements will be added, and
        // the group will be translated to the mouse (x, y) coordinates as appropriate
        const tableSelection = select<SVGSVGElement | null, any>(container)
            .append('g')
            .attr('id', tableId(uniqueTableId))
            .attr('class', 'tooltip')
            // .attr('class', 'tooltip-table')
            .style('fill', background?.color || defaultTableBackground.color)
        // .style('font-family', font?.family || defaultTableFont.family)
        // .style('font-size', font?.family || defaultTableFont.size)
        // .style('font-weight', font?.weight || defaultTableFont.weight)
        // .style('fill', font?.color || defaultTableFont.color)

        //
        // when the table has column headers, then create the SVG elements for the column headers and add
        // the relevant styles to each element in the column headers (e.g. the first/header row in the table)
        //
        const columnHeaders: Array<ElementPlacementInfo> = []
        if (tableData.hasColumnHeaders) {
            // this is the group <g> representing row of column headers that sits on top of the table
            const columnHeaderRowSelection = tableSelection
                .append('g')
                .attr('id', `svg-table-header-group-${uniqueTableId}`)
                .attr('class', 'tooltip-table-header')
                .style('fill', columnHeaderStyle?.background.color || defaultHeaderTableBackground.color)

            // when each row has a header (i.e. the table has row-headers) and we have column headers,
            // then need to add an extra cell to beginning of the column header
            if (tableData.hasColumnHeaders && tableData.hasRowHeaders) {
                const selection = columnHeaderRowSelection
                    .append<SVGTextElement>("text")
                    .attr('id', tableElementId(uniqueTableId, 0, 0))
                    .style('font-family', columnHeaderStyle?.font.family || defaultHeaderTableFont.family)
                    .style('font-size', columnHeaderStyle?.font.family || defaultHeaderTableFont.size)
                    .style('font-weight', columnHeaderStyle?.font.weight || defaultHeaderTableFont.weight)
                    .style('fill', columnHeaderStyle?.font.color || defaultTableFont.color)
                    .text(() => " ")
                const padding: Padding = {...rowHeaderStyle.padding, ...columnHeaderStyle.padding}
                columnHeaders.push(elementInfoFrom(selection, columnHeaderStyle.alignText, padding))
            }

            // append the headers and hold them in an array so that we can position them after figuring out
            // the "optimal" width of each column
            const dataStartColumnIndex: number = tableData.hasRowHeaders ? 1 : 0
            const columnHeaderData: Row = tableData.hasColumnHeaders ? tableData.data[0] : []
            columnHeaderData.forEach((element, colIndex) => {
                const selection = columnHeaderRowSelection
                    .append<SVGTextElement>("text")
                    .attr('id', tableElementId(uniqueTableId, 0, dataStartColumnIndex + colIndex))
                    .style('font-family', columnHeaderStyle?.font.family || defaultHeaderTableFont.family)
                    .style('font-size', columnHeaderStyle?.font.family || defaultHeaderTableFont.size)
                    .style('font-weight', columnHeaderStyle?.font.weight || defaultHeaderTableFont.weight)
                    .style('fill', columnHeaderStyle?.font.color || defaultTableFont.color)
                    .text(() => element.label)
                const padding: Padding = {...style.columnStyles[dataStartColumnIndex + colIndex].padding, ...columnHeaderStyle.padding}
                columnHeaders.push(elementInfoFrom(selection, columnHeaderStyle.alignText, padding))
            })
        }

        //
        // add the table elements, adding row headers to each row, if they exist
        //
        // todo need to add the data structure (matrix of ElementInfo) for the table and put the column headers are the top
        const data: Array<Array<ElementPlacementInfo>> = []
        const dataStartRowIndex: number = tableData.hasColumnHeaders ? 1 : 0
        // when the table has row headers and column headers then add a row header to the
        // beginning of each row (the column header has already been taken care of and so
        // we don't need to do anything further for it)
        tableData.data.slice(dataStartRowIndex).forEach((row, rowIndex) => {

            const dataStartColumnIndex: number = tableData.hasRowHeaders ? 1 : 0
            const colStyle = style.columnStyles[dataStartRowIndex + rowIndex]
            const rowData: Array<ElementPlacementInfo> = []
            row.slice(dataStartColumnIndex).forEach((elem, colIndex) => {
                const rowStyle = style.rowStyles[dataStartColumnIndex + colIndex];
                const dataElem = tableSelection
                    .append<SVGTextElement>("text")
                    .attr('id', tableElementId(uniqueTableId, dataStartRowIndex + rowIndex, 0))
                    .style('font-family', rowStyle.font.family || defaultTableFont.family)
                    .style('font-size', rowStyle.font.family || defaultTableFont.size)
                    .style('font-weight', rowStyle.font.weight || defaultTableFont.weight)
                    .style('fill', rowStyle.font.color || defaultTableFont.color)
                    .text(() => row[0].label)
                const padding: Padding = {...style.rowStyles[dataStartRowIndex + rowIndex].padding, ...rowHeaderStyle.padding}
                rowData.push(elementInfoFrom(dataElem, rowHeaderStyle.alignText, padding))
            })

            if (tableData.hasRowHeaders) {
                const header = tableSelection
                    .append<SVGTextElement>("text")
                    .attr('id', tableElementId(uniqueTableId, dataStartRowIndex + rowIndex, 0))
                    .style('font-family', rowHeaderStyle?.font.family || defaultHeaderTableFont.family)
                    .style('font-size', rowHeaderStyle?.font.family || defaultHeaderTableFont.size)
                    .style('font-weight', rowHeaderStyle?.font.weight || defaultHeaderTableFont.weight)
                    .style('fill', rowHeaderStyle?.font.color || defaultTableFont.color)
                    .text(() => row[0].label)
                const padding: Padding = {...style.rowStyles[dataStartRowIndex + rowIndex].padding, ...rowHeaderStyle.padding}
                // rowHeaders.push(elementInfoFrom(header, rowHeaderStyle.alignText, padding))
                rowData.unshift(elementInfoFrom(header, rowHeaderStyle.alignText, padding))
            }

            // add the row to the table
            data.push(rowData)
        })

        // add any columns headers (a row) to the beginning of the table
        if (tableData.hasColumnHeaders) {
            data.unshift(columnHeaders)
        }

        // return data
        return tableInfoFrom(columnHeaders, columnHeaders, data)
            .andThen(tableInfo => calculateTableCellDimensions(style, tableInfo, tableData))
            .map(tableDimensions => {
                placeTableCellsRelativeToTable(shallowCopy, tableSelection, tableDimensions)
                    .onSuccess(tableSelection => translateTableToTooltipLocation(tableSelection, coordinates(tableDimensions.width, tableDimensions.height)))
                return tableDimensions
            })


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
    })

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