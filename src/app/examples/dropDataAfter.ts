//
// policy for when to drop old data from long-running charts. recall that the data is
// streamed in at a specified interval, and so the data builds up over time.
//
export const DROP_DATA_AFTER_SECONDS: Map<string, number> = new Map<string, number>([
    ['Drop after 10 s', 10000], ['Drop after 20 s', 20000], ['Drop after 50 s', 50000], ['Drop after 100 s', 100000], ['Keep All', Infinity]
])
export const DEFAULT_DROP_AFTER: [name: string, value: number] = Array.from(DROP_DATA_AFTER_SECONDS.entries())[1]
