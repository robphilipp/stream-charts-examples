import {areTableDimensionsValid, validateTableDimensions} from "./tableUtils";
import {createTableData} from "./tableData";
import {render} from "@testing-library/react";

describe('when creating svg-tables', () => {

    describe('when creating table data without headers of footers', () => {

        test('table data with the same number of columns in each row should be valid', () => {
            const tableData = createTableData()
                .withoutHeaders()
                .withDataAsRow([[11, 12, 13], [21, 22, 23]])
                .withoutFooter()
            expect(areTableDimensionsValid({}, tableData)).toBe(true);
            expect(validateTableDimensions({}, tableData).succeeded).toBe(true);
        })

        test('table data that has rows with different numbers of columns should not be valid', () => {
            expect(
                () => createTableData()
                    .withoutHeaders()
                    .withDataAsRow([[11, 12, 13], [21, 22]])
                    .withoutFooter()
            ).toThrow("All rows must have the same number of columns. Cannot construct table data. num_columns: [3,2]")
        })

        test('table info data with different numbers of columns should not be valid', () => {
            // const elemInfo1 = elementInfoFrom()
            const svgRoot = render(
                <svg data-testid="my-root-svg">
                    <text>This is a test</text>
                </svg>
            )
            expect(svgRoot.getByTestId('my-root-svg')).toBeDefined()
        })
    })

})
