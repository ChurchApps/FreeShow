import { writable } from "svelte/store"
import { OUTPUT } from "../../../../types/Channels"
import type { MediaStyle } from "../../../../types/Main"
import { receive, send } from "../../../utils/request"

// Reports the background videos the capture worker composites under a page: sources, order and opacity.

/** set by main for a page whose pixels are composited by the capture worker */
export const mediaLayersEnabled = writable(false)
/** outputs showing at least one media layer (their page paints transparent) */
export const mediaLayered = writable<{ [outputId: string]: boolean }>({})
/** the color the worker fills behind the video */
export const mediaFill = writable<{ [outputId: string]: string }>({})

// clock: playback start time (now minus currentTime); only outputs in step share a decode
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

// product of every ancestor's opacity, so any fade is reproduced exactly
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

/** sends this output's layers bottom to top when they changed */
export function report(outputId: string) {
    const ordered = [...slots].filter((s) => s.outputId === outputId && s.el.isConnected).sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    // layers at opacity 0 are reported too, so a source exists before it fades in
    const layers = ordered.map((s) => ({ path: s.path, mediaStyle: s.mediaStyle, startAt: s.startAt, clock: s.clock, alpha: Math.round(opacityOf(s.el) * 1000) / 1000 }))
    const fill = toRgb(fills[outputId] || "black")
    const message = JSON.stringify({ layers, fill })
    if (lastSent[outputId] === message) return
    lastSent[outputId] = message
    send(OUTPUT, ["MEDIA_LAYERS"], { outputId, layers, fill })
}
