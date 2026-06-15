/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

const COMPACTING_SIZE: number = 100000

/**
 * An O(1)-shift queue that fully satisfies the `Array<T>` interface.
 *
 * A standard `Array.shift()` is O(n) because one slot must copy down every
 * remaining element.  `FastQueue` avoids that by tracking a `headIndex`
 * offset into the underlying storage array: shifting simply increments the
 * pointer.  All logical indices presented to callers are zero-based and
 * automatically translated to internal indices via `+ headIndex`.
 *
 * A `Proxy` wrapper is returned from the constructor so that bracket notation
 * (`queue[i]`) also respects the offset.  Method bodies are bound to the raw
 * (`self`) instance to bypass the proxy on every internal property access,
 * preserving the O(1) benefit.
 *
 * Because `FastQueue<T>` implements `Array<T>`, it can be used anywhere an
 * array is expected — including D3's `.data()` call, `Array.isArray` checks
 * (via the iterator protocol), and TypeScript overload resolution.
 *
 * @example
 * ```ts
 * const q = FastQueue.fromArray([1, 2, 3]);
 * q.push(4); // [1, 2, 3, 4]
 * q.shift(); // 1 (O(1))
 * console.log(q[0]); // 2
 * ```
 *
 * @typeParam T - The element type stored in the queue.
 */
export class FastShiftArray<T> implements Array<T> {
    [index: number]: T
    private items: Array<T> = []
    private headIndex: number = 0
    private readonly compactingSize: number = COMPACTING_SIZE

    /**
     * Private constructor — use the static factory methods instead.
     *
     * @param items The backing storage array.
     * @param headIndex Index into `items` where logical index 0 begins.
     * @param [useProxy=true] When `true` (default) wraps `this` in a `Proxy` so
     *                    that bracket-notation reads/writes apply the offset.
     *                    Pass `false` only for internal use where the proxy
     *                    overhead is unnecessary (e.g. `copyFromArray`).
     * @param [compactingSize=100,000] When the number of shifted elements hits this number
     * then those values are dropped and the headIndex is set back to zero
     */
    private constructor(
        items: Array<T> = [],
        headIndex: number = 0,
        useProxy: boolean = true,
        compactingSize = COMPACTING_SIZE
    ) {
        this.items = items
        this.headIndex = headIndex
        this.compactingSize = compactingSize

        if (!useProxy) return

        // return a Proxy instead of the raw instance so that indexing works with the
        // headIndex offset when using [].
        // Methods are bound to `this` (the raw instance) so that internal property
        // accesses inside methods bypass the proxy entirely — otherwise every
        // this.headIndex / this.items inside shift() etc. would go through the trap,
        // causing deoptimization and negating the O(1) advantage over Array.shift().
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this
        // Methods are bound to `self` lazily and cached here, so a method is bound
        // exactly once per instance rather than on every property access. A hot loop
        // of `proxy.shift()` calls then reuses one stable function object: no
        // per-call `bind()` allocation, and the call site stays monomorphic so V8
        // can inline it. (Binding on every `get` makes the proxied shift
        // slower than Array.shift() for small/medium arrays.)
        const boundMethods = new Map<string | symbol, (...args: Array<any>) => any>()
        return new Proxy<FastShiftArray<T>>(this, {
            get: (target: this, prop: string | symbol, receiver): T | Array<T> => {
                // Check if the property being accessed is a number/index. Array
                // index keys always start with a digit, so gate the (relatively
                // costly) Number() coercion on the first char code — this skips it
                // for every method name (`shift`, `push`, …), which is the hot path
                // when the queue is used as a drop-in array.
                if (typeof prop === 'string') {
                    const code = prop.charCodeAt(0)
                    if (code >= 48 && code <= 57) {       // '0'–'9'
                        const index = Number(prop)
                        if (!isNaN(index)) {
                            return self.items[index + self.headIndex] as T
                        }
                    }
                }

                // Reuse the already-bound method if we have one.
                const cached = boundMethods.get(prop)
                if (cached !== undefined) return cached as T

                const value = Reflect.get(target, prop, receiver)
                if (typeof value === 'function') {
                    const bound = value.bind(self)
                    boundMethods.set(prop, bound)
                    return bound as T
                }
                return value as T
            },
            set: (_target: this, prop: string | symbol, value: unknown): boolean => {
                if (typeof prop === 'string') {
                    const index = Number(prop)
                    if (!isNaN(index)) {
                        self.items[index + self.headIndex] = value as T
                        return true
                    }
                    if (prop === 'length') {
                        self.items.length = (value as number) + self.headIndex
                        return true
                    }
                }
                return Reflect.set(self, prop, value)
            }
        })
    }

    /**
     * Iterates over the logical elements of the queue in order, skipping the
     * internal "ghost" slots before `headIndex`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([10, 20, 30]);
     * q.shift();
     * for (const v of q) console.log(v); // 20, 30
     * ```
     */
    *[Symbol.iterator](): ArrayIterator<T> {
        for (let i = this.headIndex; i < this.items.length; i++) {
            yield this.items[i]
        }
    }

    // -------------------------------------------------------------------------
    // Static factory methods
    // -------------------------------------------------------------------------

    /**
     * Creates a `FastQueue` that wraps `array` directly — no copy is made.
     *
     * Pass `useProxy = false` only when you know you will never use bracket
     * notation to read or write elements.
     *
     * @param array The array to wrap.
     * @param [useProxy=true] Optional parameter that determines whether to apply the index-offset proxy.
     * @param [compactingSize=100,000] Optional parameter that determines the number of shifts
     * before compacting the array.
     * @returns A new `FastQueue<T>` backed by `array`.
     *
     * @example
     * ```ts
     * const src = [1, 2, 3];
     * const q = FastQueue.fromArray(src);
     * q.push(4);
     * console.log(src); // [1, 2, 3, 4] — same backing array
     * ```
     */
    static fromArray<T>(
        array: Array<T>,
        useProxy: boolean = true,
        compactingSize: number = COMPACTING_SIZE
    ): FastShiftArray<T> {
        return new FastShiftArray<T>(array, 0, useProxy, compactingSize)
    }

    /**
     * Creates a `FastQueue` from a **copy** of `array`.
     *
     * The queue owns its own storage; mutations do not affect the original.
     *
     * @param array The array to copy.
     * @param [useProxy=true] Optional parameter that determines whether to apply the index-offset proxy.
     * @param [compactingSize=100,000] Optional parameter that determines the number of shifts
     * before compacting the array.
     * @returns A new `FastQueue<T>` with independent storage.
     *
     * @example
     * ```ts
     * const src = [1, 2, 3];
     * const q = FastQueue.copyFromArray(src);
     * q.push(4);
     * console.log(src); // [1, 2, 3] — unchanged
     * console.log([...q]); // [1, 2, 3, 4]
     * ```
     */
    static copyFromArray<T>(
        array: Array<T>,
        useProxy: boolean = true,
        compactingSize: number = COMPACTING_SIZE
    ): FastShiftArray<T> {
        return FastShiftArray.fromArray(array.slice(), useProxy, compactingSize)
    }

    /**
     * Creates an empty `FastQueue<T>`.
     *
     * @param [useProxy=true] Optional parameter that determines whether to apply the index-offset proxy.
     * @param [compactingSize=100,000] Optional parameter that determines the number of shifts
     * before compacting the array.
     * @returns A new empty `FastQueue<T>`.
     *
     * @example
     * ```ts
     * const q = FastQueue.empty<number>();
     * q.push(1, 2);
     * console.log(q.length); // 2
     * ```
     */
    static empty<T>(useProxy: boolean = true, compactingSize: number = COMPACTING_SIZE): FastShiftArray<T> {
        return new FastShiftArray<T>([], 0, useProxy, compactingSize)
    }

    // -------------------------------------------------------------------------
    // FastQueue-specific helpers
    // -------------------------------------------------------------------------

    /**
     * Returns the element at `index` without going through the Proxy.
     *
     * Equivalent to `queue[index]` but useful when the proxy is disabled or
     * when you want an explicit method call for clarity.
     *
     * @param index Zero-based logical index.
     * @returns The element, or `undefined` if `index` is out of range.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray(['a', 'b', 'c']);
     * console.log(q.get(1)); // 'b'
     * console.log(q.get(9)); // undefined
     * ```
     */
    get(index: number): T | undefined {
        return this.items[this.headIndex + index]
    }

    /**
     * The number of logical elements in the queue.
     *
     * Does **not** include the "ghost" slots before `headIndex`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3]);
     * q.shift();
     * console.log(q.length); // 2
     * ```
     */
    get length(): number {
        return this.items.length - this.headIndex
    }

    /**
     * Sets the logical length of the queue, truncating or extending it.
     *
     * Setting `length` translates to `items.length = value + headIndex` so
     * internal accounting stays consistent.
     *
     * @param value The new logical length.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3, 4]);
     * q.length = 2;
     * console.log([...q]); // [1, 2]
     * ```
     */
    set length(value: number) {
        this.items.length = value + this.headIndex
    }

    /**
     * Returns `true` when the queue contains no elements.
     *
     * @example
     * ```ts
     * const q = FastQueue.empty<number>();
     * console.log(q.isEmpty()); // true
     * q.push(1);
     * console.log(q.isEmpty()); // false
     * ```
     */
    isEmpty(): boolean {
        return this.length === 0
    }

    /**
     * Returns `true` when the queue contains at least one element.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([42]);
     * console.log(q.isNotEmpty()); // true
     * ```
     */
    isNotEmpty(): boolean {
        return this.length > 0
    }

    /**
     * Compacts the internal storage by discarding the ghost slots that
     * accumulate after repeated `shift()` calls.
     *
     * This is done automatically when `headIndex` exceeds 100 000, but you
     * can call it explicitly if memory pressure is a concern.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3]);
     * q.shift(); q.shift();
     * q.compact(); // internal storage is now [3], headIndex = 0
     * ```
     */
    compact(): void {
        this.items = this.items.slice(this.headIndex)
        this.headIndex = 0
    }

    /**
     * Returns a plain `Array<T>` containing the logical elements from `start`
     * (inclusive) to `end` (exclusive).
     *
     * @param start Zero-based start index (default `0`).
     * @param end Zero-based end index (default `this.length`).
     * @returns A plain `Array<T>` — never a `FastQueue`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([10, 20, 30, 40]);
     * console.log(q.toArray(1, 3)); // [20, 30]
     * ```
     */
    toArray(start: number = 0, end: number = this.length): Array<T> {
        return this.items.slice(this.headIndex + start, this.headIndex + end)
    }

    // -------------------------------------------------------------------------
    // Array<T> — read-access / query methods
    // -------------------------------------------------------------------------

    /**
     * Returns a section of the queue as a new `FastQueue`.
     *
     * Negative indices are supported: `-1` refers to the last element.
     *
     * @param start Zero-based start index (inclusive, default `0`).
     * @param end Zero-based end index (exclusive, default `this.length`).
     * @returns A new `FastQueue<T>` with fresh backing storage.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([0, 1, 2, 3, 4]);
     * console.log([...q.slice(1, 3)]); // [1, 2]
     * console.log([...q.slice(-2)]); // [3, 4]
     * ```
     */
    slice(start?: number, end?: number): FastShiftArray<T> {
        const len = this.length
        let s = start ?? 0
        let e = end ?? len
        if (s < 0) s = Math.max(0, len + s)
        if (e < 0) e = Math.max(0, len + e)
        return FastShiftArray.fromArray(this.items.slice(s + this.headIndex, e + this.headIndex))
    }

    /**
     * Returns the element at the given index, supporting negative indices.
     *
     * Negative indices count from the end (`-1` is the last element) and
     * bypass the `headIndex` offset so they always refer to the tail of the
     * logical sequence.
     *
     * @param index Zero-based (or negative) index.
     * @returns The element, or `undefined` if out of range.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([10, 20, 30]);
     * console.log(q.at(0)); // 10
     * console.log(q.at(-1)); // 30
     * ```
     */
    at(index: number): T | undefined {
        if (index < 0) return this.items.at(index)
        return this.items.at(this.headIndex + index)
    }

    /**
     * Returns the index of the first occurrence of `value`, or `-1` if not found.
     *
     * @param value The value to search for.
     * @param index Optional starting position (default `0`).
     * @returns Zero-based logical index, or `-1`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray(['a', 'b', 'c', 'b']);
     * console.log(q.indexOf('b')); // 1
     * console.log(q.indexOf('b', 2)); // 3
     * console.log(q.indexOf('z')); // -1
     * ```
     */
    indexOf(value: T, index?: number): number {
        const result = this.items.indexOf(value, (index || 0) + this.headIndex)
        return result < 0 ? -1 : result - this.headIndex
    }

    /**
     * Returns the index of the last occurrence of `value`, or `-1` if not found.
     *
     * @param value The value to search for.
     * @param index Optional starting position for the backward search.
     * @returns Zero-based logical index, or `-1`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3, 2, 1]);
     * console.log(q.lastIndexOf(2)); // 3
     * console.log(q.lastIndexOf(9)); // -1
     * ```
     */
    lastIndexOf(value: T, index?: number): number {
        const totalLength = this.items.length
        const start = index || 0
        const begin = start < 0 ? Math.max(this.headIndex, totalLength - start) : start + this.headIndex
        if (begin >= totalLength) return -1
        for (let i = totalLength - 1; i >= begin; i--) {
            if (this.items[i] === value) {
                return i - this.headIndex
            }
        }
        return -1
    }

    /**
     * Returns `true` if `searchElement` is present in the queue.
     *
     * @param searchElement Value to search for.
     * @param fromIndex Optional starting index (default `0`).
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, NaN]);
     * console.log(q.includes(2)); // true
     * console.log(q.includes(NaN)); // true  (uses SameValueZero)
     * ```
     */
    includes(searchElement: T, fromIndex?: number): boolean {
        return this.items.includes(searchElement, (fromIndex || 0) + this.headIndex)
    }

    // -------------------------------------------------------------------------
    // Array<T> — mutation methods
    // -------------------------------------------------------------------------

    /**
     * Appends one or more elements to the end of the queue.
     *
     * @param item Elements to append.
     * @returns The new logical length of the queue.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2]);
     * q.push(3, 4);
     * console.log([...q]); // [1, 2, 3, 4]
     * ```
     */
    push(...item: Array<T>): number {
        return this.items.push(...item) - this.headIndex
    }

    /**
     * Removes and returns the last element of the queue.
     *
     * @returns The last element, or `undefined` if the queue is empty.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3]);
     * console.log(q.pop()); // 3
     * console.log([...q]); // [1, 2]
     * ```
     */
    pop(): T | undefined {
        if (this.headIndex >= this.items.length) return undefined
        return this.items.pop()
    }

    /**
     * Removes and returns the first element of the queue in **O(1)** time.
     *
     * After removal, `headIndex` is incremented rather than copying elements.
     * Ghost slots are cleaned up automatically when `headIndex` exceeds 100 000.
     *
     * @returns The first element, or `undefined` if the queue is empty.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([10, 20, 30]);
     * console.log(q.shift()); // 10  (O(1))
     * console.log(q[0]); // 20
     * ```
     */
    shift(): T | undefined {
        if (this.headIndex >= this.items.length) return undefined

        const item = this.items[this.headIndex]
        this.items[this.headIndex] = undefined as T; // Allow garbage collection
        this.headIndex++

        // periodic cleanup to free up unused memery
        if (this.headIndex > this.compactingSize) {
            this.items = this.items.splice(0, this.headIndex)
            this.headIndex = 0
        }

        return item
    }

    /**
     * Inserts one or more elements at the beginning of the queue.
     *
     * If `headIndex >= elements.length`, elements are written into the ghost
     * slots in-place without allocation.  Otherwise, a new array is created.
     *
     * @param elements Elements to prepend, in order.
     * @returns The new logical length.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([3, 4]);
     * q.unshift(1, 2);
     * console.log([...q]); // [1, 2, 3, 4]
     * ```
     */
    unshift(...elements: T[]): number {
        if (this.headIndex >= elements.length) {
            // enough free slots before headIndex — write in-place without allocation
            const newHead = this.headIndex - elements.length
            for (let i = 0; i < elements.length; i++) {
                this.items[newHead + i] = elements[i]
            }
            this.headIndex = newHead
        } else {
            this.items = [...elements, ...this.items.slice(this.headIndex)]
            this.headIndex = 0
        }
        return this.length
    }

    /**
     * Removes and/or inserts elements at `start`.
     *
     * @param start Zero-based logical index at which to start changing the queue.
     * @param deleteCount Number of elements to remove.
     * @param insertItems Elements to insert in place of the removed elements.
     * @returns An array of the removed elements.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3, 4]);
     * const removed = q.splice(1, 2, 9, 8);
     * console.log(removed); // [2, 3]
     * console.log([...q]); // [1, 9, 8, 4]
     * ```
     */
    splice(start: number, deleteCount?: number, ...insertItems: T[]): T[] {
        if (deleteCount == null) {
            return this.items.splice(start + this.headIndex)
        }
        return this.items.splice(start + this.headIndex, deleteCount, ...insertItems)
    }

    /**
     * Fills elements from `start` (inclusive) to `end` (exclusive) with `value`.
     *
     * Indices are logical (zero-based); negative values are not supported.
     *
     * @param value Value to fill with.
     * @param start Start index (default `0`).
     * @param end End index (default `this.length`).
     * @returns `this` for chaining.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3, 4]);
     * q.fill(0, 1, 3);
     * console.log([...q]); // [1, 0, 0, 4]
     * ```
     */
    fill(value: T, start?: number, end?: number): this {
        const totalLength = this.items.length
        const last = end != null ? (end + this.headIndex) : totalLength
        for (let i = this.headIndex + (start ?? 0); i < Math.min(last, totalLength); i++) {
            this.items[i] = value
        }
        return this;
    }

    /**
     * Copies a segment of the queue to a different position within the same queue.
     *
     * All indices are logical (zero-based).
     *
     * @param target Zero-based index where the copied section will be pasted.
     * @param start Zero-based index of the section start to copy from.
     * @param end Zero-based index of the section end (exclusive).
     * @returns `this` for chaining.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3, 4, 5]);
     * q.copyWithin(0, 3);
     * console.log([...q]); // [4, 5, 3, 4, 5]
     * ```
     */
    copyWithin(target: number, start: number, end?: number): this {
        const last = end == null ? (this.items.length - this.headIndex) : end
        this.items.copyWithin(target + this.headIndex, start + this.headIndex, last + this.headIndex)
        return this
    }

    /**
     * Reverses the queue **in place** and returns `this`.
     *
     * Only the logical elements (from `headIndex` onward) are reversed;
     * ghost slots are not touched.
     *
     * @returns `this`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3]);
     * q.reverse();
     * console.log([...q]); // [3, 2, 1]
     * ```
     */
    reverse(): FastShiftArray<T> {
        const totalLength = this.items.length
        const logicalLength = totalLength - this.headIndex
        for (let i = 0; i < Math.floor(logicalLength / 2); i++) {
            const left = this.headIndex + i
            const right = totalLength - 1 - i
            const tmp = this.items[left]
            this.items[left] = this.items[right]
            this.items[right] = tmp
        }
        return this
    }

    /**
     * Returns a new `FastQueue` with the elements in reverse order.
     *
     * The original queue is not modified.
     *
     * @returns A new reversed `FastQueue<T>`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3]);
     * const r = q.toReversed();
     * console.log([...r]); // [3, 2, 1]
     * console.log([...q]); // [1, 2, 3]
     * ```
     */
    toReversed(): FastShiftArray<T> {
        return FastShiftArray.fromArray(this.items.slice(this.headIndex).reverse())
    }

    /**
     * Sorts the queue **in place** using `compareFn` and returns `this`.
     *
     * Ghost slots are discarded during the sort, so `headIndex` is reset to 0
     * afterward.
     *
     * @param compareFn Optional comparison function (same semantics as `Array.sort`).
     * @returns `this`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([3, 1, 2]);
     * q.sort();
     * console.log([...q]); // [1, 2, 3]
     *
     * q.sort((a, b) => b - a);
     * console.log([...q]); // [3, 2, 1]
     * ```
     */
    sort(compareFn?: (a: T, b: T) => number): this {
        this.items = this.items.slice(this.headIndex).sort(compareFn)
        this.headIndex = 0
        return this
    }

    /**
     * Returns a new sorted `FastQueue` without modifying the original.
     *
     * @param compareFn Optional comparison function.
     * @returns A new `FastQueue<T>` in sorted order.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([3, 1, 2]);
     * const s = q.toSorted();
     * console.log([...s]); // [1, 2, 3]
     * console.log([...q]); // [3, 1, 2]
     * ```
     */
    toSorted(compareFn?: (a: T, b: T) => number): FastShiftArray<T> {
        return FastShiftArray.fromArray(this.items.slice(this.headIndex).sort(compareFn))
    }

    /**
     * Returns a new `FastQueue` with a splice applied, without modifying the original.
     *
     * @param start Zero-based logical start index.
     * @param deleteCount Number of elements to remove.
     * @param items Elements to insert.
     * @returns A new `FastQueue<T>`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3, 4]);
     * const r = q.toSpliced(1, 2, 9);
     * console.log([...r]); // [1, 9, 4]
     * console.log([...q]); // [1, 2, 3, 4]
     * ```
     */
    toSpliced(start: number, deleteCount: number, ...items: T[]): FastShiftArray<T>
    toSpliced(start: number, deleteCount?: number): FastShiftArray<T>
    toSpliced(start: number, deleteCount?: number, ...items: T[]): FastShiftArray<T> {
        return FastShiftArray.fromArray(this.items.slice(this.headIndex).toSpliced(start, deleteCount ?? this.length, ...items))
    }

    /**
     * Returns a new `FastQueue` with the element at `index` replaced by `value`.
     *
     * The original queue is not modified.
     *
     * @param index Zero-based logical index.
     * @param value Replacement value.
     * @returns A new `FastQueue<T>`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3]);
     * const r = q.with(1, 99);
     * console.log([...r]); // [1, 99, 3]
     * console.log([...q]); // [1, 2, 3]
     * ```
     */
    with(index: number, value: T): FastShiftArray<T> {
        return FastShiftArray.fromArray(this.items.slice(this.headIndex).with(index, value))
    }

    // -------------------------------------------------------------------------
    // Array<T> — transformation methods
    // -------------------------------------------------------------------------

    /**
     * Creates a new `FastQueue` with the results of calling `callback` on every element.
     *
     * Indices passed to `callback` are zero-based logical indices.
     *
     * @param callback Function called for each element.
     * @param _thisArg - Unused (bound via arrow function in the caller).
     * @returns A new `FastQueue<U>`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3]);
     * const doubled = q.map(x => x * 2);
     * console.log([...doubled]); // [2, 4, 6]
     * ```
     */
    map<U>(callback: (value: T, index: number, array: T[]) => U, _thisArg?: T): FastShiftArray<U> {
        const totalLength = this.items.length

        if (this.headIndex >= totalLength) return FastShiftArray.empty()

        // Pre-allocating size avoids dynamic resizing overhead
        const result = new Array<U>(totalLength - this.headIndex)

        for (let i = this.headIndex; i < totalLength; i++) {
            result[i - this.headIndex] = callback(this.items[i], i - this.headIndex, this.items)
        }
        return FastShiftArray.fromArray(result)
    }

    /**
     * Maps each element through `callback` and flattens the result one level deep.
     *
     * @param callback Function that returns a value or a readonly array.
     * @param _thisArg - Unused.
     * @returns A new flattened `FastQueue<U>`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3]);
     * const r = q.flatMap(x => [x, x * 10]);
     * console.log([...r]); // [1, 10, 2, 20, 3, 30]
     * ```
     */
    flatMap<U>(callback: (value: T, index: number, array: T[]) => U | ReadonlyArray<U>, _thisArg?: any): FastShiftArray<U> {
        const totalLength = this.items.length
        if (this.headIndex >= totalLength) return FastShiftArray.empty()
        const result: Array<U> = []
        for(let i = this.headIndex; i < totalLength; i++) {
            const value = callback(this.items[i], i - this.headIndex, this.items)
            if (Array.isArray(value)) {
                result.push(...value)
            } else {
                result.push(value as U)
            }
        }
        return FastShiftArray.fromArray(result)
    }

    /**
     * Flattens the queue up to `depth` levels and returns a plain `Array`.
     *
     * @param depth Maximum depth to flatten (default `1`).
     * @returns A plain `FlatArray<A, D>[]`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([[1, 2], [3, [4, 5]]]);
     * console.log(q.flat()); // [1, 2, 3, [4, 5]]
     * console.log(q.flat(2)); // [1, 2, 3, 4, 5]
     * ```
     */
    flat<A, D extends number = 1>(this: A, depth?: D): FlatArray<A, D>[] {
        return FastShiftArray.fromArray((this as unknown as FastShiftArray<T>).items.slice((this as unknown as FastShiftArray<T>).headIndex).flat(depth)) as unknown as FlatArray<A, D>[]
    }

    /**
     * Returns a new `FastQueue` containing only elements for which `predicate` returns truthy.
     *
     * The type-guard overload narrows the element type to `S`.
     *
     * @param predicate Test function.
     * @param thisArg Value to use as `this` inside `predicate`.
     * @returns A new `FastQueue<S>` or `FastQueue<T>`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3, 4, 5]);
     * const evens = q.filter(x => x % 2 === 0);
     * console.log([...evens]); // [2, 4]
     * ```
     */
    filter<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S, thisArg?: any): FastShiftArray<S>
    filter(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): FastShiftArray<T>
    filter(predicate: (value: T, index: number, array: T[]) => boolean): FastShiftArray<T> {
        const totalLength = this.items.length
        if (this.headIndex >= totalLength) return FastShiftArray.empty()

        const result: Array<T> = []
        for(let i = this.headIndex; i < totalLength; i++) {
            if (predicate(this.items[i], i - this.headIndex, this.items)) {
                result.push(this.items[i])
            }
        }
        return FastShiftArray.fromArray(result)
    }

    /**
     * Returns a new `FastQueue` that is the concatenation of this queue and `items`.
     *
     * Each item in `items` may be a single element `T` or a `ConcatArray<T>`
     * (e.g. another array or `FastQueue`).
     *
     * @param items Elements or arrays to concatenate.
     * @returns A new `FastQueue<T>`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2]);
     * const r = q.concat([3, 4], 5);
     * console.log([...r]); // [1, 2, 3, 4, 5]
     * ```
     */
    concat(...items: (T | ConcatArray<T>)[]): FastShiftArray<T> {
        const base = this.items.slice(this.headIndex)
        for (const item of items) {
            if (Array.isArray(item) || item instanceof FastShiftArray) {
                for (const v of (item as Iterable<T>)) base.push(v)
            } else {
                base.push(item as T)
            }
        }
        return FastShiftArray.fromArray(base)
    }

    /**
     * Concatenates another `FastQueue` onto this one and returns a new `FastQueue`.
     *
     * Convenience wrapper around `concat` for `FastQueue`-to-`FastQueue` merges.
     *
     * @param array The queue to append.
     * @returns A new `FastQueue<T>`.
     *
     * @example
     * ```ts
     * const a = FastQueue.fromArray([1, 2]);
     * const b = FastQueue.fromArray([3, 4]);
     * console.log([...a.concatArray(b)]); // [1, 2, 3, 4]
     * ```
     */
    concatArray(array: FastShiftArray<T>): FastShiftArray<T> {
        return this.concat(...array)
    }

    // -------------------------------------------------------------------------
    // Array<T> — aggregation / predicate methods
    // -------------------------------------------------------------------------

    /**
     * Reduces the queue to a single value, processing elements left-to-right.
     *
     * When called without `initialValue` the first element is used as the seed
     * and processing starts at index 1.
     *
     * @param callback Reducer function.
     * @returns The accumulated result.
     * @throws `TypeError` if the queue is empty and no `initialValue` is given.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3, 4]);
     * console.log(q.reduce((acc, x) => acc + x, 0)); // 10
     * console.log(q.reduce((acc, x) => acc + x)); // 10
     * ```
     */
    reduce(callback: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T): T
    /**
     * Reduces the queue to a single value, processing elements left-to-right.
     *
     * When called without `initialValue` the first element is used as the seed
     * and processing starts at index 1.
     *
     * @param callback Reducer function.
     * @param initial Optional initial accumulator value.
     * @returns The accumulated result.
     * @throws `TypeError` if the queue is empty and no `initialValue` is given.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3, 4]);
     * console.log(q.reduce((acc, x) => acc + x, 0)); // 10
     * console.log(q.reduce((acc, x) => acc + x)); // 10
     * ```
     */
    reduce(callback: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initial: T): T
    reduce<U>(callback: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initial: U): U
    reduce<U>(callback: (previous: T | U, current: T, index: number, array: T[]) => T | U, initial?: T | U): T | U {
        const totalLength = this.items.length
        let i = this.headIndex
        let accumulated: T | U
        if (arguments.length < 2) {
            if (i >= totalLength) throw new TypeError('Reduce of empty array with no initial value')
            accumulated = this.items[i++] as T
        } else {
            accumulated = initial as T | U
        }
        for (; i < totalLength; i++) {
            accumulated = callback(accumulated, this.items[i], i - this.headIndex, this.items)
        }
        return accumulated
    }

    /**
     * Reduces the queue to a single value, processing elements right-to-left.
     *
     * @param callback Reducer function.
     * @returns The accumulated result.
     * @throws `TypeError` if the queue is empty and no `initialValue` is given.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3]);
     * console.log(q.reduceRight((acc, x) => acc + x, '')); // '321'
     * ```
     */
    reduceRight(callback: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T): T
    /**
     * Reduces the queue to a single value, processing elements right-to-left.
     *
     * @param callback Reducer function.
     * @param initial Optional initial accumulator value.
     * @returns The accumulated result.
     * @throws `TypeError` if the queue is empty and no `initialValue` is given.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3]);
     * console.log(q.reduceRight((acc, x) => acc + x, '')); // '321'
     * ```
     */
    reduceRight(callback: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initial: T): T
    reduceRight<U>(callback: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initial: U): U
    reduceRight<U>(callback: (previous: T | U, current: T, index: number, array: T[]) => T | U, initial?: T | U): T | U {
        const totalLength = this.items.length
        let i = totalLength - 1
        let accumulated: T | U
        if (arguments.length < 2) {
            if (i < this.headIndex) throw new TypeError('Reduce of empty array with no initial value')
            accumulated = this.items[i--] as T
        } else {
            accumulated = initial as T | U
        }
        for (; i >= this.headIndex; i--) {
            accumulated = callback(accumulated, this.items[i], i - this.headIndex, this.items)
        }
        return accumulated
    }

    /**
     * Returns the first element for which `predicate` returns truthy, or `undefined`.
     *
     * The type-guard overload narrows the return type to `S`.
     *
     * @param predicate Test function.
     * @param thisArg Value to use as `this` inside `predicate`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3, 4]);
     * console.log(q.find(x => x > 2)); // 3
     * ```
     */
    find<S extends T>(predicate: (value: T, index: number, obj: T[]) => value is S, thisArg?: any): S | undefined
    find(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): T | undefined
    find(predicate: (value: T, index: number, obj: T[]) => boolean): T | undefined {
        const totalLength = this.items.length
        if (this.headIndex >= totalLength) return undefined

        for (let i = this.headIndex; i < totalLength; i++) {
            if (predicate(this.items[i], i - this.headIndex, this.items)) {
                return this.items[i]
            }
        }
        return undefined
    }

    /**
     * Returns the zero-based logical index of the first element for which
     * `predicate` returns truthy, or `-1` if none match.
     *
     * @param predicate Test function.
     * @param _thisArg  - Unused.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([10, 20, 30]);
     * console.log(q.findIndex(x => x > 15)); // 1
     * ```
     */
    findIndex(predicate: (value: T, index: number, obj: T[]) => unknown, _thisArg?: any): number {
        const totalLength = this.items.length
        if (this.headIndex >= totalLength) return -1

        for (let i = this.headIndex; i < totalLength; i++) {
            if (predicate(this.items[i], i - this.headIndex, this.items)) {
                return i - this.headIndex
            }
        }
        return -1
    }

    /**
     * Returns the last element for which `predicate` returns truthy, or `undefined`.
     *
     * The type-guard overload narrows the return type to `S`.
     *
     * @param predicate Test function.
     * @param thisArg Value to use as `this` inside `predicate`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3, 4]);
     * console.log(q.findLast(x => x % 2 === 0)); // 4
     * ```
     */
    findLast<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S, thisArg?: any): S | undefined
    findLast(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): T | undefined
    findLast(predicate: (value: T, index: number, array: T[]) => boolean): T | undefined {
        const totalLength = this.items.length
        if (this.headIndex >= totalLength) return undefined

        for (let i = totalLength - 1; i >= this.headIndex; i--) {
            if (predicate(this.items[i], i - this.headIndex, this.items)) {
                return this.items[i]
            }
        }
        return undefined
    }

    /**
     * Returns the zero-based logical index of the last element for which
     * `predicate` returns truthy, or `-1`.
     *
     * @param predicate Test function.
     * @param _thisArg  - Unused.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3, 4]);
     * console.log(q.findLastIndex(x => x % 2 === 0)); // 3
     * ```
     */
    findLastIndex(predicate: (value: T, index: number, array: T[]) => unknown, _thisArg?: any): number {
        // thisArg = thisArg || this
        const totalLength = this.items.length
        if (this.headIndex >= totalLength) return -1

        for (let i = totalLength-1; i >= this.headIndex; i--) {
            if (predicate(this.items[i], i - this.headIndex, this.items)) {
                return i - this.headIndex
            }
        }
        return -1
    }

    /**
     * Returns `true` if **every** element satisfies `predicate`.
     *
     * Short-circuits on the first failing element.  The type-guard overload
     * narrows `this` to `S[]` when it returns `true`.
     *
     * @param predicate Test function.
     * @param thisArg Value to use as `this` inside `predicate`.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([2, 4, 6]);
     * console.log(q.every(x => x % 2 === 0)); // true
     * ```
     */
    every<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S, thisArg?: any): this is S[]
    every(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean
    every(predicate: (value: T, index: number, array: T[]) => boolean): boolean {
        const totalLength = this.items.length
        for (let i = this.headIndex; i < totalLength; i++) {
            if (!predicate(this.items[i], i - this.headIndex, this.items)) {
                // element found that doesn't match, exit early
                return false
            }
        }
        return true
    }

    /**
     * Returns `true` if **at least one** element satisfies `predicate`.
     *
     * Short-circuits on the first matching element.
     *
     * @param predicate Test function.
     * @param _thisArg  - Unused.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 3, 5]);
     * console.log(q.some(x => x % 2 === 0)); // false
     * q.push(4);
     * console.log(q.some(x => x % 2 === 0)); // true
     * ```
     */
    some(predicate: (value: T, index: number, array: T[]) => unknown, _thisArg?: any): boolean {
        const totalLength = this.items.length
        for (let i = this.headIndex; i < totalLength; i++) {
            if (predicate(this.items[i], i - this.headIndex, this.items)) {
                // matching value found, exit early
                return true
            }
        }
        return false
    }

    // -------------------------------------------------------------------------
    // Array<T> — iteration / string methods
    // -------------------------------------------------------------------------

    /**
     * Executes `callback` once for each logical element, in order.
     *
     * @param callback Function to execute for each element.
     * @param _thisArg - Unused.
     *
     * @example
     * ```ts
     * FastQueue.fromArray([1, 2, 3]).forEach(x => console.log(x)); // 1 2 3
     * ```
     */
    forEach(callback: (value: T, index: number, array: T[]) => void, _thisArg?: any): void {
        const totalLength = this.items.length
        if (this.headIndex >= totalLength) return

        for (let i = this.headIndex; i < totalLength; i++) {
            callback(this.items[i], i - this.headIndex, this.items)
        }
    }

    /**
     * Joins all logical elements into a string with `separator` between each pair.
     *
     * @param separator String placed between elements (default `','`).
     * @returns The joined string.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3]);
     * console.log(q.join('-')); // '1-2-3'
     * console.log(q.join()); // '1,2,3'
     * ```
     */
    join(separator: string = ','): string {
        return this.items.slice(this.headIndex).join(separator)
    }

    /**
     * Returns a locale-sensitive string representation of the logical elements.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1000, 2000]);
     * console.log(q.toLocaleString()); // '1,000,2,000' (locale-dependent)
     * ```
     */
    toLocaleString(): string {
        return this.items.slice(this.headIndex).toLocaleString()
    }

    /**
     * Returns a string representation of the logical elements, equivalent to
     * `join()` with the default comma separator.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([1, 2, 3]);
     * console.log(q.toString()); // '1,2,3'
     * ```
     */
    toString(): string {
        return this.join()
    }

    // -------------------------------------------------------------------------
    // Array<T> — iterator factory methods
    // -------------------------------------------------------------------------

    /**
     * Returns an `ArrayIterator` of `[index, value]` pairs for the logical elements.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray(['a', 'b', 'c']);
     * for (const [i, v] of q.entries()) {
     *   console.log(i, v); // 0 'a', 1 'b', 2 'c'
     * }
     * ```
     */
    entries(): ArrayIterator<[number, T]> {
        const items = this.items
        const headIndex = this.headIndex
        let index = headIndex
        return {
            next(): IteratorResult<[number, T]> {
                if (index < items.length) {
                    return {
                        value: [index - headIndex, items[index++]],
                        done: false
                    }
                }
                return {
                    value: undefined as unknown as [number, T],
                    done: true
                }
            },
            [Symbol.iterator]() {
                return this
            },
            [Symbol.dispose]() {
                return undefined
            }
        }
    }

    /**
     * Returns an `ArrayIterator` of the zero-based logical indices.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray(['x', 'y', 'z']);
     * console.log([...q.keys()]); // [0, 1, 2]
     * ```
     */
    keys(): ArrayIterator<number> {
        const items = this.items
        const headIndex = this.headIndex
        let index = headIndex
        return {
            next(): IteratorResult<number> {
                if (index < items.length) {
                    return {
                        value: (index++) - headIndex,
                        done: false
                    }
                }
                return { value: undefined as unknown as number, done: true }
            },
            [Symbol.iterator]() { return this },
            [Symbol.dispose]() { return undefined }
        }
    }

    /**
     * Returns an `ArrayIterator` over the logical element values.
     *
     * @example
     * ```ts
     * const q = FastQueue.fromArray([10, 20, 30]);
     * console.log([...q.values()]); // [10, 20, 30]
     * ```
     */
    values(): ArrayIterator<T> {
        const items = this.items
        let index = this.headIndex
        return {
            next(): IteratorResult<T> {
                if (index < items.length) {
                    return {
                        value: items[index++],
                        done: false
                    }
                }
                return {
                    value: undefined as unknown as T,
                    done: true
                }
            },
            [Symbol.iterator]() {
                return this
            },
            [Symbol.dispose]() { return undefined }
        }
    }

    // -------------------------------------------------------------------------
    // Well-known symbol members required by Array<T>
    // -------------------------------------------------------------------------

    /**
     * Required by the `Array<T>` contract.  Marks `with` as unscopable so that
     * `with` inside a `with` statement does not shadow the method.
     */
    readonly [Symbol.unscopables]: { [K in keyof any[]]?: boolean } = { with: true } as unknown as { [K in keyof any[]]?: boolean }
}
