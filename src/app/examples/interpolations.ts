import * as d3 from "d3";

export const INTERPOLATIONS = new Map<string, [string, d3.CurveFactory]>([
    ['curveLinear', ['Linear', d3.curveLinear]],
    ['curveNatural', ['Natural', d3.curveNatural]],
    ['curveMonotoneX', ['Monotone', d3.curveMonotoneX]],
    ['curveStep', ['Step', d3.curveStep]],
    ['curveStepAfter', ['Step After', d3.curveStepAfter]],
    ['curveStepBefore', ['Step Before', d3.curveStepBefore]],
    ['curveBumpX', ['Bump', d3.curveBumpX]],
])
