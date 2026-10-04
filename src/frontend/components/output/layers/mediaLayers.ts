import { writable } from "svelte/store"
import { OUTPUT } from "../../../../types/Channels"
import type { MediaStyle } from "../../../../types/Main"
import { receive, send } from "../../../utils/request"

// A background video on a captured output need not be decoded by the output page at all: one hidden media
// window decodes it once for every output showing it (see MediaLayers.ts) and the capture worker composites
// it under each page on the GPU. The page keeps an empty slot where the video would be, and reports what the
// worker should draw there: which sources, in what order, at what opacity (so fades are reproduced exactly).

/** set by main for a page whose pixels are composited by the capture worker */
export const mediaLayersEnabled = writable(false)
/** outputs whose page currently shows at least one media layer (the page then paints transparent there) */
export const mediaLayered = writable<{ [outputId: string]: boolean }>({})
/** the colour behind the video, which the worker fills with since the page itself goes transparent */
export const mediaFill = writable<{ [outputId: string]: string }>({})

// clock: when this output's playback of the file started (now minus its playback time), so main only shares
// one decode between outputs that are playing it in step
export type MediaSlot = { el: HTMLElement; outputId: string; path: string; mediaStyle: MediaStyle; startAt: number; clock: number | null; onTick: () => void }

const slots = new Set<MediaSlot>()
const lastSent: { [outputId: string]: string } = {}
let fills: { [outputId: string]: string } = {}
mediaFill.subscribe((f) => (fills = f))
let listening = false

function listen() {
    if (listening) return
    listening = true
    receive(
        OUTPUT,
        {
            MEDIA_LAYER_ENABLED: (enabled: boolean) => mediaLayersEnabled.set(!!enabled),
            MEDIA_TICK: (data: { outputId: string }) => {
                for (const s of slots) if (s.outputId === data.outputId) s.onTick()
                report(data.outputId)
            }
        },
        "MEDIA_LAYERS"
    )
}
listen()

export function addMediaSlot(slot: MediaSlot) {
    slots.add(slot)
    mediaLayered.update((a) => ({ ...a, [slot.outputId]: true }))
    report(slot.outputId)
}

export function removeMediaSlot(slot: MediaSlot) {
    slots.delete(slot)
    if (![...slots].some((s) => s.outputId === slot.outputId)) mediaLayered.update((a) => ({ ...a, [slot.outputId]: false }))
    report(slot.outputId)
}

// what the page actually shows of the slot: the product of every ancestor's opacity, so a fade of any
// duration or easing is drawn exactly as the page animates it
function opacityOf(el: HTMLElement) {
    let alpha = 1
    for (let node: HTMLElement | null = el; node; node = node.parentElement) alpha *= parseFloat(getComputedStyle(node).opacity || "1")
    return alpha
}

function toRgb(color: string): [number, number, number] {
    const ctx = document.createElement("canvas").getContext("2d")
    if (!ctx) return [0, 0, 0]
    ctx.fillStyle = "#000"
    ctx.fillStyle = color
    const hex = String(ctx.fillStyle)
    const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0]
}

/** send this output's layers to main when they changed: bottom to top, in the order the page draws them */
export function report(outputId: string) {
    const ordered = [...slots].filter((s) => s.outputId === outputId && s.el.isConnected).sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    // a layer about to fade in is reported at opacity 0 too: its source has to exist before it can show
    const layers = ordered.map((s) => ({ path: s.path, mediaStyle: s.mediaStyle, startAt: s.startAt, clock: s.clock, alpha: Math.round(opacityOf(s.el) * 1000) / 1000 }))
    const fill = toRgb(fills[outputId] || "black")
    const message = JSON.stringify({ layers, fill })
    if (lastSent[outputId] === message) return
    lastSent[outputId] = message
    send(OUTPUT, ["MEDIA_LAYERS"], { outputId, layers, fill })
}
