export interface AutoSizeCacheEntry {
    signature: string
    fontSize: number
}

const autoSizeCache = new Map<string, AutoSizeCacheEntry>()

export function readAutoSizeCache(key: string) {
    if (!key) return undefined
    return autoSizeCache.get(key)
}

export function writeAutoSizeCache(key: string, entry: AutoSizeCacheEntry) {
    if (!key) return
    autoSizeCache.set(key, entry)
}

export function clearAutoSizeCache(key?: string) {
    if (!key) {
        autoSizeCache.clear()
        return
    }
    autoSizeCache.delete(key)
}
