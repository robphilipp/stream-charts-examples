//
// policy for when to drop old data from long-running charts. recall that the data is
// streamed in at a specified interval, and so the data builds up over time.
//
export const DROP_AFTER_10_SEC: unique symbol = Symbol("Drop after 10 s")
export const DROP_AFTER_20_SEC: unique symbol = Symbol("Drop after 20 s")
export const DROP_AFTER_50_SEC: unique symbol = Symbol("Drop after 50 s")
export const DROP_AFTER_100_SEC: unique symbol = Symbol("Drop after 100 s")
export const KEEP_ALL: unique symbol = Symbol("Keep All")

export type DropAfterOptions = typeof DROP_AFTER_10_SEC | typeof DROP_AFTER_20_SEC | typeof DROP_AFTER_50_SEC | typeof DROP_AFTER_100_SEC | typeof KEEP_ALL

export const DROP_DATA_AFTER_MS: Map<string, number> = new Map<string, number>([
    [DROP_AFTER_10_SEC.description!, 10000],
    [DROP_AFTER_20_SEC.description!, 20000],
    [DROP_AFTER_50_SEC.description!, 50000],
    [DROP_AFTER_100_SEC.description!, 100000],
    [KEEP_ALL.description!, Infinity]
])

export const DEFAULT_DROP_AFTER_10: [name: string, value: number] = Array.from(DROP_DATA_AFTER_MS.entries())[0]
export const DEFAULT_DROP_AFTER_20: [name: string, value: number] = Array.from(DROP_DATA_AFTER_MS.entries())[1]
