import {createCanvasContext} from "./plot";

/**
 * `createCanvasContext` reads `window.devicePixelRatio` and calls `window.requestAnimationFrame`.
 * In this project's plain-Node Jest environment (no jsdom) `window` is simply undefined, so it
 * must be stubbed. Returns a way to manually fire whatever `requestAnimationFrame` callback is
 * currently pending, so `redrawNow` can be driven deterministically without real animation frames.
 */
function installWindowStub(): {runPendingAnimationFrame: () => void} {
    let pending: (() => void) | undefined
    const g = globalThis as unknown as {window: unknown}
    g.window = {
        devicePixelRatio: 1,
        requestAnimationFrame: (cb: (time: number) => void): number => {
            pending = () => cb(0)
            return 1
        },
    }
    return {
        runPendingAnimationFrame: () => {
            const fn = pending
            pending = undefined
            fn?.()
        },
    }
}

function uninstallWindowStub(): void {
    const g = globalThis as unknown as {window?: unknown}
    delete g.window
}

/**
 * A minimal fake `<canvas>` -- just enough surface for `createCanvasContext`/`redrawNow` to touch:
 * a 2D context stub (`save`/`setTransform`/`clearRect`/`restore`, plus the style fields it sets)
 * and the numeric `width`/`height` used to clear the full backing store each frame.
 */
function fakeCanvas(): HTMLCanvasElement {
    const context2D = {
        textBaseline: '',
        strokeStyle: '',
        fillStyle: '',
        save: jest.fn(),
        setTransform: jest.fn(),
        clearRect: jest.fn(),
        restore: jest.fn(),
    }
    return {
        width: 100,
        height: 100,
        getContext: () => context2D,
    } as unknown as HTMLCanvasElement
}

describe('createCanvasContext redraw', () => {
    let errorSpy: jest.SpyInstance
    let runPendingAnimationFrame: () => void

    beforeEach(() => {
        ({runPendingAnimationFrame} = installWindowStub())
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        errorSpy.mockRestore()
        uninstallWindowStub()
    })

    it('runs every registered draw function on a redraw', () => {
        const canvasContext = createCanvasContext(1, fakeCanvas(), 'black')

        const drawA = jest.fn()
        const drawB = jest.fn()
        canvasContext.register('a', drawA)
        canvasContext.register('b', drawB)
        runPendingAnimationFrame()

        expect(drawA).toHaveBeenCalledWith(canvasContext)
        expect(drawB).toHaveBeenCalledWith(canvasContext)
    })

    it("one registrant's throw does not prevent the others from drawing on the same frame", () => {
        const canvasContext = createCanvasContext(1, fakeCanvas(), 'black')

        const failing = jest.fn(() => {
            throw new Error('boom')
        })
        const before = jest.fn()
        const after = jest.fn()
        canvasContext.register('before', before, 0)
        canvasContext.register('failing', failing, 1)
        canvasContext.register('after', after, 2)
        runPendingAnimationFrame()

        expect(before).toHaveBeenCalled()
        expect(failing).toHaveBeenCalled()
        expect(after).toHaveBeenCalled()
        expect(errorSpy).toHaveBeenCalledTimes(1)
        expect(errorSpy.mock.calls[0][0]).toContain('"failing"')
        expect(errorSpy.mock.calls[0][0]).toContain('chart_id: 1')
    })

    it('a subsequent redraw still runs normally after a previous frame threw', () => {
        const canvasContext = createCanvasContext(1, fakeCanvas(), 'black')

        let shouldThrow = true
        canvasContext.register('flaky', () => {
            if (shouldThrow) throw new Error('boom')
        })
        runPendingAnimationFrame()
        expect(errorSpy).toHaveBeenCalledTimes(1)

        shouldThrow = false
        canvasContext.requestRedraw()
        runPendingAnimationFrame()
        expect(errorSpy).toHaveBeenCalledTimes(1)
    })
})
