// the axis-element type return when calling the ".call(axis)" function
// the axis-element type return when calling the ".call(axis)" function
import  {type Selection} from "d3";
import type {Datum} from "./series/timeSeries";

export type AxisElementSelection = Selection<SVGGElement, Datum, null, undefined>
export type SvgSelection = Selection<SVGSVGElement, Datum, null, undefined>
export type GSelection = Selection<SVGGElement, Datum, null, undefined>
export type LineSelection = Selection<SVGLineElement, Datum, SVGGElement, undefined>
export type TextSelection = Selection<SVGTextElement, Datum, null, undefined>

export type RadialMagnifierSelection = Selection<SVGCircleElement, Datum, null, undefined>
export type BarMagnifierSelection = Selection<SVGRectElement, Datum, null, undefined>;
export type MagnifierTextSelection = Selection<SVGTextElement, Datum, SVGGElement, undefined>

export type TrackerSelection = Selection<SVGLineElement, Datum, null, undefined>

