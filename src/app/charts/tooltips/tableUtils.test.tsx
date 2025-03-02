import {areTableDimensionsValid} from "./tableUtils";
import {createTableData, TableData} from "./tableData";
import {TableStyle} from "./tableSvg";

describe('TableUtils', () => {

    function createTableDataNoHeadersOrFooters(): TableData {
        return createTableData()
            .withoutHeaders()
            .withDataAsRow([[11, 12, 13], [21, 22, 23]])
            .withoutFooter()
    }

    function createEmptyTableStyle(): Partial<TableStyle> {
        return {}
    }

    test('should be defined', () => {
        expect(areTableDimensionsValid(createEmptyTableStyle(), createTableDataNoHeadersOrFooters())).toBe(true);
    })
})