// The last picture seen for each live source, so a tile that is unmounted and mounted again (navigating
// between drawer tabs) shows it straight away instead of waiting out the snapshot interval.
//
// The frame's own buffer is handed back to the receiver for reuse once drawn, so what is kept here is a
// copy. These are preview-sized frames, a few hundred KB each, and only the most recent handful are kept.

export type CachedFrame = { data: Uint8Array; xres: number; yres: number; format: string }

const cache = new Map<string, CachedFrame>()
const MAX_SOURCES = 12

export function cacheStreamFrame(id: string, frame: { data: ArrayBufferView | ArrayBuffer; xres: number; yres: number; format?: string }) {
    if (!id || !frame?.data || !frame.xres || !frame.yres) return
    const view = frame.data instanceof Uint8Array ? frame.data : new Uint8Array(frame.data as ArrayBuffer)
    // a Map keeps insertion order, so re-inserting moves this source to the newest end
    cache.delete(id)
    cache.set(id, { data: new Uint8Array(view), xres: frame.xres, yres: frame.yres, format: frame.format || "bgra" })
    while (cache.size > MAX_SOURCES) cache.delete(cache.keys().next().value as string)
}

export function getCachedStreamFrame(id: string): CachedFrame | null {
    return cache.get(id) || null
}
