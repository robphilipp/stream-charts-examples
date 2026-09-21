import {failureResult, type Result, successResult} from "result-fn";

/**
 * Wraps the creation of the regex in a try/catch and returns the regex, wrapped in an option,
 * when it is valid. This can be used, for example, in a text field where the user types a regex.
 * @param regexString The string representation of the regex
 * @return The regular expression (`RegExp`) wrapped in an option. If the regexp
 * is invalid, then the option is none.
 */
export function regexFilter(regexString: string): Result<RegExp, string> {
    try {
        const regex = new RegExp(regexString)
        return successResult(regex)
    } catch(error) {
        return failureResult(
            `Unable to compile the regex expression; regex_expression: ${regexString}; error: ${error}`
        )
    }
}

/**
 * Builds a regex that matches `text` literally, for callers (e.g. a series-name filter input)
 * who want to search for plain text without regex metacharacters (`.`, `*`, `+`, `(`, etc.) in it
 * being given unintended regex semantics. Escapes those metacharacters before handing the result
 * to {@link regexFilter}, so it shares the same `Result`-wrapped, never-throws contract.
 * @param text The literal text to match
 * @return The regular expression (`RegExp`) wrapped in an option, matching `text` literally
 */
export function literalFilter(text: string): Result<RegExp, string> {
    return regexFilter(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
}
