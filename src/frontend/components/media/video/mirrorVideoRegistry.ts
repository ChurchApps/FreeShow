import { writable } from "svelte/store"

// Shared-render preview dedupe: only the group renderer's mirror decodes; it registers its
// <video> here and follower mirrors paint from it via canvas (extra decode sessions measurably
// degrade every video in the app).

const elements = new Map<string, HTMLVideoElement>()

// bumped on every register/unregister so Svelte components re-query reactively
export const mirrorRegistryTick = writable(0)

export function mirrorVideoKey(outputId: string, path: string): string {
    return `${outputId}|${path}`
}

export function registerMirrorVideo(key: string, el: HTMLVideoElement) {
    elements.set(key, el)
    mirrorRegistryTick.update((n) => n + 1)
}

export function unregisterMirrorVideo(key: string, el: HTMLVideoElement | null) {
    if (el && elements.get(key) !== el) return
    elements.delete(key)
    mirrorRegistryTick.update((n) => n + 1)
}

export function getMirrorVideo(key: string): HTMLVideoElement | null {
    return elements.get(key) || null
}
