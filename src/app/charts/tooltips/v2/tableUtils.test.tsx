import {areTableDimensionsValid, validateTableDimensions} from "./tableUtils";
import {createTableData} from "./tableData";
import {render, screen} from "@testing-library/react";
import {textWidthFor, textWidthOf} from "../utils";
import {select} from "d3";
import {JSX, RefObject, useEffect, useRef} from 'react'

// function Test(props: {callback: (container: RefObject<SVGSVGElement>) => void}): JSX.Element {
function Test(): JSX.Element {
    const containerRef = useRef<SVGSVGElement>(null);

    // useEffect(() => {
    //     props.callback(containerRef)
    //     // const test = select(containerRef.current).select<SVGTextElement>("#my-text")
    //     // const width = textWidthOf(test.selectChild())
    // }, [containerRef, props]);

    return (<svg ref={containerRef} data-testid="my-root-svg" width={300} height={300}/>)
}

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

        test('test', () => {
            // let containerRef: RefObject<HTMLDivElement>;
            // const root = render(<Test/>)
            const root = render(<div data-testid="my-test-div"/>)
            const svg = select<HTMLElement | null, any>(root.container)
                .append('svg')
                .attr('data-testid', 'my-root-svg')
                .attr('width', 500)
                .attr('height', 500)
            const text = svg
                .append<SVGTextElement>("text")
                .attr("data-testid", "my-text")
                .text(() => "this is a test")
            // expect(root.getByTestId('my-root-svg')).toBeDefined()
            // const text = svg.select("text").text()
            screen.debug()
            const p = screen.getByTestId('my-text')
            expect(text.node()).not.toBeNull()
            expect(textWidthFor(text.node()!)).toBe(20)
            // expect(textWidthOf(svg.select<SVGTextElement>("text"))).toBe(20)
        })

        test('table info data with different numbers of columns should not be valid', () => {
            const svgRoot = render(
                <svg data-testid="my-root-svg">
                    <g>
                        <text>This is a test</text>
                    </g>
                </svg>
            )
            expect(svgRoot.getByTestId('my-root-svg')).toBeDefined()
            let svg = select(svgRoot.container)//.select('#i:my-root-svg')
            // expect(textWidthOf(svg)).toEqual(20)
        })
    })

})
