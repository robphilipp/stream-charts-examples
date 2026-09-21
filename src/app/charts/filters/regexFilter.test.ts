import {literalFilter, regexFilter} from "./regexFilter";

test('option should contain a valid regex', () => {
    expect(regexFilter("^[0-9]+$").succeeded).toEqual(true);
});

test('should allow progression of building regex', () => {
    let filter = regexFilter("^[0-9").map(regex => '100a200'.match(regex)!.map(t => t)).getOrUndefined();
    expect(filter).toBeUndefined();

    filter = regexFilter("^[0-9]+").map(regex => '100a200'.match(regex)!.map(t => t)).getOrUndefined();
    expect(filter).toEqual(['100']);
});

test('literalFilter should match text containing regex metacharacters literally', () => {
    const matched = literalFilter("a.b*c(1+2)").map(regex => regex.test("a.b*c(1+2)")).getOrElse(false);
    expect(matched).toEqual(true);

    // without escaping, "." and "*" would match unintended text -- confirm that does NOT happen
    const shouldNotMatch = literalFilter("a.b*c(1+2)").map(regex => regex.test("aXbbbbc(1+2)")).getOrElse(true);
    expect(shouldNotMatch).toEqual(false);
});

test('literalFilter should still succeed on plain text with no metacharacters', () => {
    expect(literalFilter("series-1").succeeded).toEqual(true);
});