import {describe, expect, it} from "@jest/globals";
import {FastQueue} from "./FastQueue.ts";

describe("FastQueue", () => {

    // ── helpers ────────────────────────────────────────────────────────────────

    /** Shift n elements off the front of a queue, mirroring what the caller
     *  does to a plain array so both start at the same logical data. */
    function shiftN<T>(queue: FastQueue<T>, n: number): FastQueue<T> {
        for (let i = 0; i < n; i++) queue.shift()
        return queue
    }

    /** Return the logical contents of a FastQueue as a plain array. */
    const toArr = <T>(q: FastQueue<T>): T[] => q.toArray()

    /** Build (array, freshQueue, shiftedQueue) from the same source data. */
    function fixtures<T>(data: T[], shiftBy = 5) {
        const array = [...data]
        const fresh = FastQueue.fromArray([...data])
        // pad with dummy values, then shift them away – gives headIndex=shiftBy
        const shifted = FastQueue.fromArray([...Array(shiftBy).fill(null as T), ...data])
        shiftN(shifted, shiftBy)
        return {array, fresh, shifted}
    }

    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    // ── basic FastQueue operations ─────────────────────────────────────────────

    describe("basic FastQueue functionality", () => {
        it("should be able to create an empty queue", () => {
            const queue = FastQueue.empty<number>()
            expect(queue.isEmpty()).toBe(true)
            expect(queue.toArray()).toEqual([])
            expect(queue.isNotEmpty()).toBe(false)
        })
        it("should be able to add and remove items", () => {
            const queue = FastQueue.fromArray<number>([1, 2, 3])
            expect(queue.isEmpty()).toBe(false)
            expect(queue.isNotEmpty()).toBe(true)
            expect(queue.get(0)).toBe(1)
            expect(queue.shift()).toBe(1)
            expect(queue.get(0)).toBe(2)
            expect(queue.shift()).toBe(2)
            expect(queue.get(0)).toBe(3)
            expect(queue.shift()).toBe(3)
            expect(queue.shift()).toBeUndefined()
        })

        it("should be able to compact the shifted data", () => {
            const queue = FastQueue.fromArray<number>(Array.from({length: 100}, (_, i) => i + 1))
            shiftN(queue, 50)
            expect(queue.length).toBe(50)
            // @ts-ignore
            expect(queue.items.length).toBe(100)
            queue.compact()
            // @ts-ignore
            expect(queue.items.length).toBe(50)
            expect(queue.toArray()).toEqual(Array.from({length: 50}, (_, i) => i + 51))
        })

        it("should be able to concat an array", () => {
            const queue = FastQueue.fromArray<number>(Array.from({length: 100}, (_, i) => i + 1))
            const otherQueue = FastQueue.fromArray<number>(Array.from({length: 50}, (_, i) => i + 101))
            const concatenatedQueue = queue.concatArray(otherQueue)
            expect(concatenatedQueue.toArray()).toEqual(Array.from({length: 150}, (_, i) => i + 1))
        })

        it("should be able to map items", () => {
            const queue = FastQueue.fromArray<number>(Array.from({length: 100}, (_, i) => i + 1))
            const mappedQueue = queue.map<number>(x => x * 2)
            expect(mappedQueue.toArray()).toEqual(Array.from({length: 100}, (_, i) => (i + 1) * 2))
        })

        it("should be able to map items after shift", () => {
            const queue = FastQueue.fromArray<number>(Array.from({length: 100}, (_, i) => i + 1))
            for (let i = 0; i < 5; i++) queue.shift()
            const mappedQueue = queue.map(x => x * 2)
            expect(mappedQueue.toArray()).toEqual(Array.from({length: 95}, (_, i) => (i + 6) * 2))
        })

        it("should allow using [] indexing", () => {
            const queue = FastQueue.fromArray<number>(Array.from({length: 100}, (_, i) => i + 1))
            shiftN(queue, 50)
            expect(queue.get(0)).toBe(51)
            expect(queue[0]).toBe(51)
        })

        it("should allow filtering", () => {
            const queue = FastQueue.fromArray<number>(Array.from({length: 100}, (_, i) => i + 1))
            shiftN(queue, 50)
            const filteredQueue = queue.filter(x => x % 2 === 0)
            expect(filteredQueue[0]).toBe(52)
            expect(filteredQueue.toArray()).toEqual(Array.from({length: 25}, (_, i) => (i + 26) * 2))
            expect(filteredQueue.length).toBe(25)
        })
    })

    // ── length ─────────────────────────────────────────────────────────────────

    describe("length", () => {
        it("reflects logical size after shifts", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(fresh.length).toBe(array.length)
            expect(shifted.length).toBe(array.length)
        })

        it("setter truncates the queue", () => {
            const {array, fresh, shifted} = fixtures(nums)
            array.length = 4
            fresh.length = 4
            shifted.length = 4
            expect(toArr(fresh)).toEqual(array)
            expect(toArr(shifted)).toEqual(array)
        })
    })

    // ── bracket indexing ───────────────────────────────────────────────────────

    describe("[] index access and assignment", () => {
        it("reads correct elements via []", () => {
            const {array, fresh, shifted} = fixtures(nums)
            for (let i = 0; i < array.length; i++) {
                expect(fresh[i]).toBe(array[i])
                expect(shifted[i]).toBe(array[i])
            }
        })

        it("writes via [] and reads back correctly", () => {
            const {array, fresh, shifted} = fixtures(nums)
            array[2] = 99
            fresh[2] = 99
            shifted[2] = 99
            expect(toArr(fresh)).toEqual(array)
            expect(toArr(shifted)).toEqual(array)
        })
    })

    // ── at ─────────────────────────────────────────────────────────────────────

    describe("at", () => {
        it("positive indices", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(fresh.at(0)).toBe(array.at(0))
            expect(fresh.at(4)).toBe(array.at(4))
            expect(shifted.at(0)).toBe(array.at(0))
            expect(shifted.at(4)).toBe(array.at(4))
        })

        it("negative indices", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(fresh.at(-1)).toBe(array.at(-1))
            expect(fresh.at(-3)).toBe(array.at(-3))
            expect(shifted.at(-1)).toBe(array.at(-1))
            expect(shifted.at(-3)).toBe(array.at(-3))
        })

        it("out-of-bounds returns undefined", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(fresh.at(100)).toBe(array.at(100))
            expect(shifted.at(100)).toBe(array.at(100))
        })
    })

    // ── push / pop ─────────────────────────────────────────────────────────────

    describe("push", () => {
        it("appends elements and returns new length", () => {
            const {array, fresh} = fixtures(nums)
            expect(fresh.push(11, 12)).toBe(array.push(11, 12))
            expect(toArr(fresh)).toEqual(array)
            const array2 = [...nums]; const shifted2 = fixtures(nums).shifted
            expect(shifted2.push(11, 12)).toBe(array2.push(11, 12))
            expect(toArr(shifted2)).toEqual(array2)
        })
    })

    describe("pop", () => {
        it("removes and returns the last element", () => {
            const {array, fresh} = fixtures(nums)
            expect(fresh.pop()).toBe(array.pop())
            expect(toArr(fresh)).toEqual(array)
            const array2 = [...nums]; const shifted2 = fixtures(nums).shifted
            expect(shifted2.pop()).toBe(array2.pop())
            expect(toArr(shifted2)).toEqual(array2)
        })

        it("returns undefined on empty queue", () => {
            expect(FastQueue.empty<number>().pop()).toBeUndefined()
        })
    })

    // ── shift / unshift ────────────────────────────────────────────────────────

    describe("unshift", () => {
        it("prepends elements and returns new length", () => {
            const {array, fresh} = fixtures(nums)
            expect(fresh.unshift(0)).toBe(array.unshift(0))
            expect(toArr(fresh)).toEqual(array)
        })

        it("prepends multiple elements in correct order", () => {
            const {array, fresh} = fixtures(nums)
            expect(fresh.unshift(-2, -1, 0)).toBe(array.unshift(-2, -1, 0))
            expect(toArr(fresh)).toEqual(array)
            const array2 = [...nums]; const shifted2 = fixtures(nums).shifted
            expect(shifted2.unshift(-2, -1, 0)).toBe(array2.unshift(-2, -1, 0))
            expect(toArr(shifted2)).toEqual(array2)
        })
    })

    // ── slice ──────────────────────────────────────────────────────────────────

    describe("slice", () => {
        it("no args returns full copy", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(toArr(fresh.slice())).toEqual(array.slice())
            expect(toArr(shifted.slice())).toEqual(array.slice())
        })

        it("with start", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(toArr(fresh.slice(3))).toEqual(array.slice(3))
            expect(toArr(shifted.slice(3))).toEqual(array.slice(3))
        })

        it("with start and end", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(toArr(fresh.slice(2, 7))).toEqual(array.slice(2, 7))
            expect(toArr(shifted.slice(2, 7))).toEqual(array.slice(2, 7))
        })

        it("negative indices", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(toArr(fresh.slice(-3))).toEqual(array.slice(-3))
            expect(toArr(fresh.slice(1, -2))).toEqual(array.slice(1, -2))
            expect(toArr(shifted.slice(-3))).toEqual(array.slice(-3))
            expect(toArr(shifted.slice(1, -2))).toEqual(array.slice(1, -2))
        })
    })

    // ── splice ─────────────────────────────────────────────────────────────────

    describe("splice", () => {
        it("removes elements and returns them", () => {
            const {array, fresh} = fixtures(nums)
            expect(fresh.splice(2, 3)).toEqual(array.splice(2, 3))
            expect(toArr(fresh)).toEqual(array)
            const array2 = [...nums]; const shifted2 = fixtures(nums).shifted
            expect(shifted2.splice(2, 3)).toEqual(array2.splice(2, 3))
            expect(toArr(shifted2)).toEqual(array2)
        })

        it("removes to end when deleteCount omitted", () => {
            const {array, fresh} = fixtures(nums)
            expect(fresh.splice(4)).toEqual(array.splice(4))
            expect(toArr(fresh)).toEqual(array)
            const array2 = [...nums]; const shifted2 = fixtures(nums).shifted
            expect(shifted2.splice(4)).toEqual(array2.splice(4))
            expect(toArr(shifted2)).toEqual(array2)
        })

        it("inserts elements", () => {
            const {array, fresh} = fixtures(nums)
            expect(fresh.splice(2, 1, 20, 21)).toEqual(array.splice(2, 1, 20, 21))
            expect(toArr(fresh)).toEqual(array)
            const array2 = [...nums]; const shifted2 = fixtures(nums).shifted
            expect(shifted2.splice(2, 1, 20, 21)).toEqual(array2.splice(2, 1, 20, 21))
            expect(toArr(shifted2)).toEqual(array2)
        })
    })

    // ── indexOf / lastIndexOf ──────────────────────────────────────────────────

    describe("indexOf", () => {
        it("finds first occurrence", () => {
            const data = [1, 2, 3, 2, 1]
            const {array, fresh, shifted} = fixtures(data)
            expect(fresh.indexOf(2)).toBe(array.indexOf(2))
            expect(shifted.indexOf(2)).toBe(array.indexOf(2))
        })

        it("returns -1 when not found", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(fresh.indexOf(99)).toBe(array.indexOf(99))
            expect(shifted.indexOf(99)).toBe(array.indexOf(99))
        })

        it("respects fromIndex", () => {
            const data = [1, 2, 3, 2, 1]
            const {array, fresh, shifted} = fixtures(data)
            expect(fresh.indexOf(2, 2)).toBe(array.indexOf(2, 2))
            expect(shifted.indexOf(2, 2)).toBe(array.indexOf(2, 2))
        })
    })

    describe("lastIndexOf", () => {
        it("finds last occurrence", () => {
            const data = [1, 2, 3, 2, 1]
            const {array, fresh, shifted} = fixtures(data)
            expect(fresh.lastIndexOf(2)).toBe(array.lastIndexOf(2))
            expect(shifted.lastIndexOf(2)).toBe(array.lastIndexOf(2))
        })

        it("returns -1 when not found", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(fresh.lastIndexOf(99)).toBe(array.lastIndexOf(99))
            expect(shifted.lastIndexOf(99)).toBe(array.lastIndexOf(99))
        })
    })

    describe("includes", () => {
        it("finds present element", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(fresh.includes(5)).toBe(array.includes(5))
            expect(shifted.includes(5)).toBe(array.includes(5))
        })

        it("returns false for absent element", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(fresh.includes(99)).toBe(array.includes(99))
            expect(shifted.includes(99)).toBe(array.includes(99))
        })
    })

    // ── find family ───────────────────────────────────────────────────────────

    describe("find", () => {
        it("returns first matching element", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const pred = (x: number) => x > 5
            expect(fresh.find(pred)).toBe(array.find(pred))
            expect(shifted.find(pred)).toBe(array.find(pred))
        })

        it("returns undefined when no match", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const pred = (x: number) => x > 100
            expect(fresh.find(pred)).toBe(array.find(pred))
            expect(shifted.find(pred)).toBe(array.find(pred))
        })
    })

    describe("findIndex", () => {
        it("returns index of first match", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const pred = (x: number) => x > 5
            expect(fresh.findIndex(pred)).toBe(array.findIndex(pred))
            expect(shifted.findIndex(pred)).toBe(array.findIndex(pred))
        })

        it("returns -1 when no match", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(fresh.findIndex(x => x > 100)).toBe(array.findIndex(x => x > 100))
            expect(shifted.findIndex(x => x > 100)).toBe(array.findIndex(x => x > 100))
        })
    })

    describe("findLast", () => {
        it("returns last matching element", () => {
            const data = [1, 5, 3, 5, 2]
            const {array, fresh, shifted} = fixtures(data)
            const pred = (x: number) => x === 5
            expect(fresh.findLast(pred)).toBe(array.findLast(pred))
            expect(shifted.findLast(pred)).toBe(array.findLast(pred))
        })
    })

    describe("findLastIndex", () => {
        it("returns index of last match", () => {
            const data = [1, 5, 3, 5, 2]
            const {array, fresh, shifted} = fixtures(data)
            const pred = (x: number) => x === 5
            expect(fresh.findLastIndex(pred)).toBe(array.findLastIndex(pred))
            expect(shifted.findLastIndex(pred)).toBe(array.findLastIndex(pred))
        })

        it("returns -1 when no match", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(fresh.findLastIndex(x => x > 100)).toBe(array.findLastIndex(x => x > 100))
            expect(shifted.findLastIndex(x => x > 100)).toBe(array.findLastIndex(x => x > 100))
        })
    })

    // ── map / flatMap / flat ───────────────────────────────────────────────────

    describe("map", () => {
        it("transforms every element", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const fn = (x: number) => x * 3
            expect(toArr(fresh.map(fn))).toEqual(array.map(fn))
            expect(toArr(shifted.map(fn))).toEqual(array.map(fn))
        })

        it("passes correct index and array arguments", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const freshArgs: [number, number, number[]][] = []
            const arrayArgs: [number, number, number[]][] = []
            fresh.map((v, i, a) => { freshArgs.push([v, i, [...a]]); return v })
            array.map((v, i, a) => { arrayArgs.push([v, i, [...a]]); return v })
            expect(freshArgs).toEqual(arrayArgs)
            const shiftedArgs: [number, number, number[]][] = []
            shifted.map((v, i) => { shiftedArgs.push([v, i, []]); return v })
            expect(shiftedArgs.map(x => x[1])).toEqual(arrayArgs.map(x => x[1]))
        })
    })

    describe("flatMap", () => {
        it("flattens one level of returned arrays", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const fn = (x: number) => [x, x * 10]
            expect(toArr(fresh.flatMap(fn))).toEqual(array.flatMap(fn))
            expect(toArr(shifted.flatMap(fn))).toEqual(array.flatMap(fn))
        })

        it("passes scalar values through unchanged", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const fn = (x: number) => x * 2
            expect(toArr(fresh.flatMap(fn))).toEqual(array.flatMap(fn))
            expect(toArr(shifted.flatMap(fn))).toEqual(array.flatMap(fn))
        })
    })

    describe("flat", () => {
        it("flattens one level by default", () => {
            const data = [[1, 2], [3, 4], [5, 6]]
            const queue = FastQueue.fromArray(data)
            expect([...queue.flat()]).toEqual(data.flat())
        })

        it("flattens nested arrays after shift", () => {
            const data = [[1, 2], [3, 4], [5, 6], [7, 8]]
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const queue = FastQueue.fromArray([null as any, null as any, ...data])
            shiftN(queue, 2)
            expect([...queue.flat()]).toEqual(data.flat())
        })
    })

    // ── filter ────────────────────────────────────────────────────────────────

    describe("filter", () => {
        it("keeps elements matching predicate", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const pred = (x: number) => x % 2 === 0
            expect(toArr(fresh.filter(pred))).toEqual(array.filter(pred))
            expect(toArr(shifted.filter(pred))).toEqual(array.filter(pred))
        })

        it("returns empty when nothing matches", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const pred = (x: number) => x > 100
            expect(toArr(fresh.filter(pred))).toEqual(array.filter(pred))
            expect(toArr(shifted.filter(pred))).toEqual(array.filter(pred))
        })
    })

    // ── reduce / reduceRight ──────────────────────────────────────────────────

    describe("reduce", () => {
        it("accumulates with initial value", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const fn = (acc: number, x: number) => acc + x
            expect(fresh.reduce(fn, 0)).toBe(array.reduce(fn, 0))
            expect(shifted.reduce(fn, 0)).toBe(array.reduce(fn, 0))
        })

        it("accumulates without initial value", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const fn = (acc: number, x: number) => acc + x
            expect(fresh.reduce(fn)).toBe(array.reduce(fn))
            expect(shifted.reduce(fn)).toBe(array.reduce(fn))
        })

        it("passes correct index", () => {
            const {array, fresh} = fixtures(nums)
            const freshIndices: number[] = []
            const arrayIndices: number[] = []
            fresh.reduce((_, __, i) => { freshIndices.push(i); return 0 }, 0)
            array.reduce((_, __, i) => { arrayIndices.push(i); return 0 }, 0)
            expect(freshIndices).toEqual(arrayIndices)
        })

        it("throws on empty with no initial value", () => {
            expect(() => FastQueue.empty<number>().reduce((a, b) => a + b)).toThrow(TypeError)
        })
    })

    describe("reduceRight", () => {
        it("accumulates right-to-left with initial value", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const fn = (acc: number, x: number) => acc + x
            expect(fresh.reduceRight(fn, 0)).toBe(array.reduceRight(fn, 0))
            expect(shifted.reduceRight(fn, 0)).toBe(array.reduceRight(fn, 0))
        })

        it("accumulates without initial value", () => {
            const data = [1, 2, 3, 4]
            const {array, fresh, shifted} = fixtures(data)
            const fn = (acc: number, x: number) => acc - x
            expect(fresh.reduceRight(fn)).toBe(array.reduceRight(fn))
            expect(shifted.reduceRight(fn)).toBe(array.reduceRight(fn))
        })

        it("throws on empty with no initial value", () => {
            expect(() => FastQueue.empty<number>().reduceRight((a, b) => a + b)).toThrow(TypeError)
        })
    })

    // ── every / some ──────────────────────────────────────────────────────────

    describe("every", () => {
        it("returns true when all elements match", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const pred = (x: number) => x > 0
            expect(fresh.every(pred)).toBe(array.every(pred))
            expect(shifted.every(pred)).toBe(array.every(pred))
        })

        it("returns false when some don't match", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const pred = (x: number) => x > 5
            expect(fresh.every(pred)).toBe(array.every(pred))
            expect(shifted.every(pred)).toBe(array.every(pred))
        })

        it("returns true on empty", () => {
            expect(FastQueue.empty<number>().every(x => x > 0)).toBe([].every(x => x > 0))
        })
    })

    describe("some", () => {
        it("returns true when at least one matches", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const pred = (x: number) => x > 5
            expect(fresh.some(pred)).toBe(array.some(pred))
            expect(shifted.some(pred)).toBe(array.some(pred))
        })

        it("returns false when none match", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const pred = (x: number) => x > 100
            expect(fresh.some(pred)).toBe(array.some(pred))
            expect(shifted.some(pred)).toBe(array.some(pred))
        })
    })

    // ── forEach ───────────────────────────────────────────────────────────────

    describe("forEach", () => {
        it("visits every element with correct value and index", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const freshVisited: [number, number][] = []
            const arrayVisited: [number, number][] = []
            fresh.forEach((v, i) => freshVisited.push([v, i]))
            array.forEach((v, i) => arrayVisited.push([v, i]))
            expect(freshVisited).toEqual(arrayVisited)
            const shiftedVisited: [number, number][] = []
            shifted.forEach((v, i) => shiftedVisited.push([v, i]))
            expect(shiftedVisited).toEqual(arrayVisited)
        })
    })

    // ── join / toString / toLocaleString ──────────────────────────────────────

    describe("join", () => {
        it("joins with default separator", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(fresh.join()).toBe(array.join())
            expect(shifted.join()).toBe(array.join())
        })

        it("joins with custom separator", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(fresh.join(" | ")).toBe(array.join(" | "))
            expect(shifted.join(" | ")).toBe(array.join(" | "))
        })
    })

    describe("toString", () => {
        it("produces same output as Array", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(fresh.toString()).toBe(array.toString())
            expect(shifted.toString()).toBe(array.toString())
        })
    })

    describe("toLocaleString", () => {
        it("produces same output as Array", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(fresh.toLocaleString()).toBe(array.toLocaleString())
            expect(shifted.toLocaleString()).toBe(array.toLocaleString())
        })
    })

    // ── concat ────────────────────────────────────────────────────────────────

    describe("concat", () => {
        it("concatenates plain arrays", () => {
            const {array, fresh, shifted} = fixtures([1, 2, 3])
            expect(toArr(fresh.concat([4, 5]))).toEqual(array.concat([4, 5]))
            expect(toArr(shifted.concat([4, 5]))).toEqual(array.concat([4, 5]))
        })

        it("concatenates FastQueues", () => {
            const {array, fresh, shifted} = fixtures([1, 2, 3])
            const extra = FastQueue.fromArray([4, 5])
            expect(toArr(fresh.concat(extra))).toEqual(array.concat([4, 5]))
            expect(toArr(shifted.concat(extra))).toEqual(array.concat([4, 5]))
        })

        it("concatenates scalar values", () => {
            const {array, fresh, shifted} = fixtures([1, 2, 3])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(toArr(fresh.concat(4 as any))).toEqual(array.concat(4 as any))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(toArr(shifted.concat(4 as any))).toEqual(array.concat(4 as any))
        })

        it("concatenates multiple args", () => {
            const {array, fresh, shifted} = fixtures([1, 2])
            expect(toArr(fresh.concat([3, 4], [5, 6]))).toEqual(array.concat([3, 4], [5, 6]))
            expect(toArr(shifted.concat([3, 4], [5, 6]))).toEqual(array.concat([3, 4], [5, 6]))
        })
    })

    // ── reverse / toReversed ──────────────────────────────────────────────────

    describe("reverse", () => {
        it("reverses in-place", () => {
            const {array, fresh} = fixtures(nums)
            fresh.reverse()
            array.reverse()
            expect(toArr(fresh)).toEqual(array)
        })

        it("reverses correctly after shift", () => {
            const {array, shifted} = fixtures(nums)
            shifted.reverse()
            array.reverse()
            expect(toArr(shifted)).toEqual(array)
        })
    })

    describe("toReversed", () => {
        it("returns a reversed copy without mutating", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const freshCopy = [...fresh]
            expect(toArr(fresh.toReversed())).toEqual(array.toReversed())
            expect(toArr(shifted.toReversed())).toEqual(array.toReversed())
            expect(toArr(fresh)).toEqual(freshCopy)  // original unchanged
        })
    })

    // ── sort / toSorted ───────────────────────────────────────────────────────

    describe("sort", () => {
        it("sorts in-place", () => {
            const data = [5, 3, 8, 1, 9, 2]
            const {array, fresh} = fixtures(data)
            fresh.sort((a, b) => a - b)
            array.sort((a, b) => a - b)
            expect(toArr(fresh)).toEqual(array)
        })

        it("sorts correctly after shift", () => {
            const data = [5, 3, 8, 1, 9, 2]
            const {array, shifted} = fixtures(data)
            shifted.sort((a, b) => a - b)
            array.sort((a, b) => a - b)
            expect(toArr(shifted)).toEqual(array)
        })
    })

    describe("toSorted", () => {
        it("returns sorted copy without mutating", () => {
            const data = [5, 3, 8, 1, 9, 2]
            const {array, fresh, shifted} = fixtures(data)
            const freshCopy = [...fresh]
            const fn = (a: number, b: number) => a - b
            expect(toArr(fresh.toSorted(fn))).toEqual(array.toSorted(fn))
            expect(toArr(shifted.toSorted(fn))).toEqual(array.toSorted(fn))
            expect(toArr(fresh)).toEqual(freshCopy)
        })
    })

    // ── fill ──────────────────────────────────────────────────────────────────

    describe("fill", () => {
        it("fills all elements", () => {
            const {array, fresh} = fixtures(nums)
            expect(toArr(fresh.fill(0))).toEqual(array.fill(0))
            const array2 = [...nums]; const shifted2 = fixtures(nums).shifted
            expect(toArr(shifted2.fill(0))).toEqual(array2.fill(0))
        })

        it("fills a range", () => {
            const {array, fresh} = fixtures(nums)
            expect(toArr(fresh.fill(99, 2, 5))).toEqual(array.fill(99, 2, 5))
            const array2 = [...nums]; const shifted2 = fixtures(nums).shifted
            expect(toArr(shifted2.fill(99, 2, 5))).toEqual(array2.fill(99, 2, 5))
        })
    })

    // ── copyWithin ────────────────────────────────────────────────────────────

    describe("copyWithin", () => {
        it("copies within the array", () => {
            const {array, fresh} = fixtures(nums)
            expect(toArr(fresh.copyWithin(0, 5))).toEqual(array.copyWithin(0, 5))
            const array2 = [...nums]; const shifted2 = fixtures(nums).shifted
            expect(toArr(shifted2.copyWithin(0, 5))).toEqual(array2.copyWithin(0, 5))
        })
    })

    // ── with / toSpliced ──────────────────────────────────────────────────────

    describe("with", () => {
        it("returns a copy with one element replaced", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(toArr(fresh.with(3, 99))).toEqual(array.with(3, 99))
            expect(toArr(shifted.with(3, 99))).toEqual(array.with(3, 99))
            expect(toArr(fresh)).toEqual(nums)    // original unchanged
        })
    })

    describe("toSpliced", () => {
        it("returns spliced copy without mutating", () => {
            const {array, fresh, shifted} = fixtures(nums)
            const freshCopy = [...fresh]
            expect(toArr(fresh.toSpliced(2, 3))).toEqual(array.toSpliced(2, 3))
            expect(toArr(shifted.toSpliced(2, 3))).toEqual(array.toSpliced(2, 3))
            expect(toArr(fresh)).toEqual(freshCopy)
        })

        it("inserts elements", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect(toArr(fresh.toSpliced(2, 1, 20, 21))).toEqual(array.toSpliced(2, 1, 20, 21))
            expect(toArr(shifted.toSpliced(2, 1, 20, 21))).toEqual(array.toSpliced(2, 1, 20, 21))
        })
    })

    // ── iterators ─────────────────────────────────────────────────────────────

    describe("[Symbol.iterator]", () => {
        it("iterates all elements in order", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect([...fresh]).toEqual(array)
            expect([...shifted]).toEqual(array)
        })
    })

    describe("entries", () => {
        it("yields [index, value] pairs", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect([...fresh.entries()]).toEqual([...array.entries()])
            expect([...shifted.entries()]).toEqual([...array.entries()])
        })
    })

    describe("keys", () => {
        it("yields indices", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect([...fresh.keys()]).toEqual([...array.keys()])
            expect([...shifted.keys()]).toEqual([...array.keys()])
        })
    })

    describe("values", () => {
        it("yields values in order", () => {
            const {array, fresh, shifted} = fixtures(nums)
            expect([...fresh.values()]).toEqual([...array.values()])
            expect([...shifted.values()]).toEqual([...array.values()])
        })
    })

    // ── performance ───────────────────────────────────────────────────────────

    describe("Performance", () => {
        const LARGE_QUEUE_LENGTH = 1000000
        const MEDIUM_QUEUE_LENGTH = 100000
        const USE_PROXY = true

        it(`time to create a queue of ${LARGE_QUEUE_LENGTH} items`, () => {
            const start = performance.mark("start")
            FastQueue.fromArray<number>(
                Array.from({length: LARGE_QUEUE_LENGTH}, (_, i) => i + 1),
                USE_PROXY
            )
            const t = performance.measure("create", start)
            console.log(`fastqueue: create: ${t.duration} ms`)
            expect(t.duration).toBeLessThan(1000)
        })

        it(`time for a single shift on a queue of ${LARGE_QUEUE_LENGTH} items`, () => {
            const queue = FastQueue.fromArray<number>(
                Array.from({length: LARGE_QUEUE_LENGTH}, (_, i) => i + 1),
                USE_PROXY
            )
            const start = performance.mark("start")
            queue.shift()
            const t = performance.measure("shift", start)
            console.log(`fastqueue: shift: ${t.duration} ms`)
            expect(t.duration).toBeLessThan(1000)
        })

        it(`amortized time per shift on ${MEDIUM_QUEUE_LENGTH} items`, () => {
            const queue = FastQueue.fromArray<number>(
                Array.from({length: MEDIUM_QUEUE_LENGTH}, (_, i) => i + 1),
                USE_PROXY
            )
            const start = performance.mark("start")
            shiftN(queue, queue.length)
            const t = performance.measure("shift", start)
            console.log(`fastqueue: shift: ${t.duration} ms, ${t.duration / MEDIUM_QUEUE_LENGTH} ms per shift; proxy: ${USE_PROXY}`)
            expect(t.duration).toBeLessThan(1500)
        })

        it("regular array shift baseline", () => {
            const array = Array.from({length: MEDIUM_QUEUE_LENGTH}, (_, i) => i + 1)
            const start = performance.mark("start")
            for (let i = 0; i < array.length; i++) array.shift()
            const t = performance.measure("shift", start)
            console.log(`regular array: shift: ${t.duration} ms, ${t.duration / MEDIUM_QUEUE_LENGTH} ms per shift`)
        })
    })
})
