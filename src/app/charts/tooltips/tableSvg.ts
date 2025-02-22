import d3 from "d3";
import {TextSelection} from "../d3types";
import {SvgTableData} from "./tableData";
import {TableUtils} from "./tableUtils";
import {Option} from "prelude-ts";

export namespace SvgTableView {
    import Row = SvgTableData.Row;
    import TableData = SvgTableData.TableData;
    import checkDimensions = TableUtils.areTableDimensionsValid;
    import textWidthOf = TableUtils.textWidthOf;
    import textHeightOf = TableUtils.textHeightOf;
    import areInfoDimensionsValid = TableUtils.areInfoDimensionsValid;

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

    export type Padding = {
        left: number
        right: number
        top: number
        bottom: number
    }

    export type Margin = {
        left: number
        right: number
        top: number
        bottom: number
    }

    export type ColumnStyle = {
        defaultWidth: number
        minWidth: number
        maxWidth: number
        leftPadding: number
        rightPadding: number
        alignText: "left" | "center" | "right"
    }

    export type RowStyle = {
        defaultHeight: number
        minHeight: number
        maxHeight: number
        topPadding: number
        bottomPadding: number
    }

    export type TableStyle = {
        font: TableFont,
        headerFont: TableFont,

        background: Background
        headerBackground: Background

        borderColor: string
        borderWidth: number
        borderRadius: number

        // the default width of the table bounds (the actual table will have a width
        // that is calculated by (defaultWidth - paddingLeft - paddingRight)
        width: number
        // the default height of the table bounds (the actual table will have a height
        // that is calculated by (defaultHeight - paddingTop - paddingBottom)
        height: number

        padding: Padding
        margin: Margin


        // a row may have a header, and the row-headers form a column that sits before
        // the other columns, and so here we want the width of that column. this value
        // must be specified if the data has row-headers
        rowHeaderWidth: number
        rowHeaderLeftPadding: number
        rowHeaderRightPadding: number
        // a column may have a header, and the column-headers form a row that sits before
        // the other rows, and so here we want the height of that row. this value must be
        // specified if the data has column-headers
        columnHeaderHeight: number
        columnHeaderTopPadding: number
        columnHeaderBottomPadding: number

        // the style (height bounds and padding) for each row
        rows: Array<RowStyle>
        // the style (width bounds, padding, and text alignment) for each column
        columns: Array<ColumnStyle>
    }

    export type ElementInfo = {
        selection: TextSelection
        textWidth: number
        textHeight: number
    }

    type Point = {x: number, y: number}
    type TextAnchor = "start" | "middle" | "end"

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
        rows: Array<RowDimension>
        columns: Array<ColumnDimension>
    }

    /**
     * Information about the table data
     */
    export type TableDataInfo = {
        readonly rowHeaders: Array<ElementInfo>,
        readonly columnHeaders: Array<ElementInfo>,
        readonly data: Array<Array<ElementInfo>>
    }

    export function tableInfoFrom(
        rowHeaderInfo: Array<ElementInfo>,
        columnHeaderInfo: Array<ElementInfo>,
        dataInfo: Array<Array<ElementInfo>>
    ): Option<TableDataInfo> {
        if (areInfoDimensionsValid({rowHeaders: rowHeaderInfo, columnHeaders: columnHeaderInfo, data: dataInfo})) {
            return Option.some({
                rowHeaders: rowHeaderInfo,
                columnHeaders: columnHeaderInfo,
                data: dataInfo
            })
        }
        return Option.none()
    }

    function elementInfoFrom(selection: TextSelection): ElementInfo {
        return {
            selection: selection,
            textWidth: textWidthOf(selection),
            textHeight: textHeightOf(selection),
        }
    }

    export function createTable(
        tableData: TableData,
        container: SVGSVGElement,
        uniqueTableId: string,
        coordinates: [x: number, y: number],
        style: TableStyle,
        dimensions: TableDimensions
    ) {

        const {font, headerFont, background, headerBackground} = style

        // check widths and heights dimensions
        checkDimensions(style, tableData)

        /*
            Add all the SVG elements representing the table, and then update the
            coordinates of each of those elements to make a table
         */

        const table = d3.select<SVGSVGElement | null, any>(container)
            .append("g")
            .attr('id', `svg-table-header-${uniqueTableId}`)
            .attr('class', 'tooltip')
            .style('fill', background.color)
            .style('font-family', font.family)
            .style('font-size', font.family)
            .style('font-weight', font.weight)

        const headerRow = table
            .append('g')
            .style('fill', headerBackground.color)
            .style('font-family', headerFont.family)
            .style('font-size', headerFont.family)
            .style('font-weight', headerFont.weight)

        // when each row has a header (i.e. the table has row-headers) and we have column headers,
        // then need to add an extra cell to beginning of the column header
        const rowHeaders: Array<ElementInfo> = []
        if (tableData.hasColumnHeaders && tableData.hasRowHeaders) {
            const selection = headerRow.append<SVGTextElement>("text").text(() => " ")
            rowHeaders.push(elementInfoFrom(selection))
        }

        // append the headers and hold them in an array so that we can position them after figuring out
        // the "optimal" width of each column
        const columnHeaders: Array<ElementInfo> = tableData.columnHeader.map(element => {
            const selection = headerRow.append<SVGTextElement>("text").text(() => element.label)
            return elementInfoFrom(selection)
        })

        const data: Array<Array<ElementInfo>> = tableData.data.map((row: Row, index: number) => {

            // add the row-header column to the svg table, if there are row headers, and add the selection
            // to the array of row-header info
            if (tableData.hasRowHeaders) {
                const header = table.append<SVGTextElement>("text").text(() => tableData.rowHeader[index].label)
                rowHeaders.push(elementInfoFrom(header))
            }

            return row.map((element: string) => {
                const selection = table.append<SVGTextElement>("text").text(() => element)
                return elementInfoFrom(selection)
            })
        })

        const tableInfo: Option<TableDataInfo> = tableInfoFrom(rowHeaders, columnHeaders, data)
    }
}