import { writable } from "svelte/store"

// Shared-render preview dedupe: outputs in one render group are pixel-identical, but the main
// window's preview pane mounts a live mirror per output — N pointless 4K decodes of the same file.
// Concurrent hardware-decode sessions in one renderer process degrade the GPU process's decode
// scheduling for ALL sessions app-wide (measured: 2 mirrors + 1 capture window = every video at
// ~0.6x realtime, permanent decoder underflow). So only the group RENDERER's mirror decodes; it
// registers its <video> element here and follower mirrors paint from it via canvas instead.

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
