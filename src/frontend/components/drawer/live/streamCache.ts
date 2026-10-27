// The last frame of each live source, so a remounted tile shows it at once. Copies: the receiver reuses its buffers.

export type CachedFrame = { data: Uint8Array; xres: number; yres: number; format: string }

const cache = new Map<string, CachedFrame>()
const MAX_SOURCES = 12

export function cacheStreamFrame(id: string, frame: { data: ArrayBufferView | ArrayBuffer; xres: number; yres: number; format?: string }) {
    if (!id || !frame?.data || !frame.xres || !frame.yres) return
    const view = frame.data instanceof Uint8Array ? frame.data : new Uint8Array(frame.data as ArrayBuffer)
    // re-inserting moves the source to the newest end of the Map
    cache.delete(id)
    cache.set(id, { data: new Uint8Array(view), xres: frame.xres, yres: frame.yres, format: frame.format || "bgra" })
    while (cache.size > MAX_SOURCES) cache.delete(cache.keys().next().value as string)
}

export function getCachedStreamFrame(id: string): CachedFrame | null {
    return cache.get(id) || null
}
