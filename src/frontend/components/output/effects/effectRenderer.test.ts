import { beforeEach, describe, expect, it, vi } from "vitest"
import { EffectRender } from "./effectRenderer"
import type { MeshGradientItem } from "../../../../types/Effects"

// The renderer only needs a 2D context that stores pixels; nothing here paints for real.
function makeContext() {
    return {
        canvas: null as any,
        globalAlpha: 1,
        globalCompositeOperation: "source-over",
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low",
        fillStyle: "" as any,
        filter: "none",
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        createPattern: vi.fn(() => ({})),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        putImageData: vi.fn(),
        getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
        createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })
    }
}

function makeCanvas() {
    const ctx = makeContext()
    const canvas: any = { width: 0, height: 0, getContext: () => ctx }
    ctx.canvas = canvas
    return canvas
}

beforeEach(() => {
    vi.stubGlobal("document", { createElement: (tag: string) => (tag === "canvas" ? makeCanvas() : {}) })
    vi.stubGlobal("requestAnimationFrame", () => 0)
    vi.stubGlobal("cancelAnimationFrame", () => {})
})

function render(item: MeshGradientItem) {
    const renderer = new EffectRender(makeCanvas(), [item], true)
    renderer.stop()
    return renderer
}

// pixels the effect wrote into its offscreen buffer, before the upscale
function buffer(renderer: EffectRender, item: MeshGradientItem) {
    return Uint8ClampedArray.from((renderer as any).effectData.get(item).image.data)
}

function meshItem(extra: Partial<MeshGradientItem> = {}): MeshGradientItem {
    return { type: "mesh_gradient", duration: 24, speed: 1, motion: 0.07, grain: 0, ...extra }
}

describe("mesh gradient effect", () => {
    it("lays the colours out on a square grid", () => {
        const nine = meshItem({ colors: Array(9).fill("#ff0000") })
        const data = (render(nine) as any).effectData.get(nine)
        expect([data.cols, data.rows]).toEqual([3, 3])

        const thirtySix = meshItem({ colors: Array(36).fill("#00ff00") })
        const bigger = (render(thirtySix) as any).effectData.get(thirtySix)
        expect([bigger.cols, bigger.rows]).toEqual([6, 6])
    })

    it("reads three and six digit hex as well as rgb()", () => {
        const renderer = render(meshItem({ colors: ["#f00", "#00ff00", "rgb(0, 0, 255)", "#fff"] }))
        const parse = (renderer as any).parseMeshColor.bind(renderer)
        expect(parse("#f00")).toEqual([255, 0, 0])
        expect(parse("#00ff00")).toEqual([0, 255, 0])
        expect(parse("rgb(0, 0, 255)")).toEqual([0, 0, 255])
        expect(parse("#ffffff")).toEqual([255, 255, 255])
    })

    it("returns to the first frame after one full loop", () => {
        // 1.6 s at 16 ms a step is exactly 100 steps, so the loop lands back on 0
        const item = meshItem({
            duration: 1.6,
            colors: Array(16)
                .fill(0)
                .map((_, i) => `#${(i * 15).toString(16).padStart(2, "0")}4488`)
        })
        const renderer = render(item)

        ;(renderer as any).drawMeshGradient(item, 0)
        const first = buffer(renderer, item)

        for (let i = 0; i < 100; i++) (renderer as any).drawMeshGradient(item, 1)
        const afterOneLoop = buffer(renderer, item)

        expect(afterOneLoop).toEqual(first)
    })

    it("still closes the loop when sped up", () => {
        for (const speed of [2, 3, 7]) {
            const item = meshItem({
                duration: 1.6,
                speed,
                colors: Array(9)
                    .fill(0)
                    .map((_, i) => `#${(i * 25).toString(16).padStart(2, "0")}77aa`)
            })
            const renderer = render(item)

            ;(renderer as any).drawMeshGradient(item, 0)
            const first = buffer(renderer, item)
            for (let i = 0; i < 100; i++) (renderer as any).drawMeshGradient(item, 1)

            expect(buffer(renderer, item), `speed ${speed} broke the loop`).toEqual(first)
        }
    })

    it("rounds a fractional speed so the loop cannot drift", () => {
        const colors = Array(9)
            .fill(0)
            .map((_, i) => `#${(i * 25).toString(16).padStart(2, "0")}5599`)
        const fractional = meshItem({ duration: 1.6, speed: 2.4, colors })
        const rounded = meshItem({ duration: 1.6, speed: 2, colors })

        const a = render(fractional)
        const b = render(rounded)
        ;(a as any).drawMeshGradient(fractional, 5)
        ;(b as any).drawMeshGradient(rounded, 5)

        expect(buffer(a, fractional)).toEqual(buffer(b, rounded))
    })

    it("moves far more across the loop than between two frames", () => {
        const item = meshItem({ duration: 1.6, colors: ["#000000", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffffff", "#808080"] })
        const renderer = render(item)

        // mean absolute difference over the colour channels, skipping alpha
        const distance = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
            let sum = 0
            let n = 0
            for (let i = 0; i < a.length; i++) {
                if (i % 4 === 3) continue
                sum += Math.abs(a[i] - b[i])
                n++
            }
            return sum / n
        }

        ;(renderer as any).drawMeshGradient(item, 0)
        const start = buffer(renderer, item)
        ;(renderer as any).drawMeshGradient(item, 1)
        const oneFrameOn = buffer(renderer, item)
        for (let i = 0; i < 49; i++) (renderer as any).drawMeshGradient(item, 1)
        const halfway = buffer(renderer, item)

        const perFrame = distance(start, oneFrameOn)
        const perHalfLoop = distance(start, halfway)

        expect(perFrame).toBeGreaterThan(0)
        expect(perHalfLoop).toBeGreaterThan(perFrame * 10)
    })

    it("only builds the grain pattern when grain is turned on", () => {
        const off = meshItem({ colors: Array(9).fill("#334455") })
        const rendererOff = render(off)
        ;(rendererOff as any).drawMeshGradient(off, 1)
        expect((rendererOff as any).ctx.createPattern).not.toHaveBeenCalled()

        const on = meshItem({ grain: 0.03, colors: Array(9).fill("#334455") })
        const rendererOn = render(on)
        ;(rendererOn as any).drawMeshGradient(on, 1)
        expect((rendererOn as any).ctx.createPattern).toHaveBeenCalled()
    })

    it("holds the grain still between refreshes instead of sliding it", () => {
        const item = meshItem({ duration: 1, grain: 0.03, colors: Array(9).fill("#334455") })
        const renderer = render(item)
        const ctx = (renderer as any).ctx

        // the tile offset is applied with translate(), so that records where the grain sits
        const offsetAt = (time: number) => {
            const data = (renderer as any).effectData.get(item)
            data.time = time
            ctx.translate.mockClear()
            ;(renderer as any).drawMeshGradient(item, 0)
            return ctx.translate.mock.calls[0]
        }

        // 24 refreshes per loop, so a step spans 1/24 and the boundaries sit on k/24
        const early = offsetAt(6 / 24 + 0.001)
        const late = offsetAt(7 / 24 - 0.001)
        expect(late, "grain moved within a single step").toEqual(early)

        const afterBoundary = offsetAt(7 / 24 + 0.001)
        expect(afterBoundary, "grain did not refresh at a step boundary").not.toEqual(early)

        // and it lands back where it started, so the loop stays clean
        expect(offsetAt(0.999999)).toEqual(offsetAt(23 / 24 + 0.001))
    })

    it("falls back to a default palette when no colours are given", () => {
        const item = meshItem()
        const data = (render(item) as any).effectData.get(item)
        expect(data.cols * data.rows).toBeGreaterThan(0)
        expect(buffer(render(item), item).some((v) => v !== 0)).toBe(true)
    })
})
