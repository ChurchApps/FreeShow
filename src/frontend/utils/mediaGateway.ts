// ----- FreeShow -----
// Resolves library media to a server URL for remote clients. When the client is on
// the socket transport (web build, or a hybrid desktop connected to a server), the
// library and its media live on the server, so file paths in shows/overlays are the
// SERVER's paths and can't be read locally. We serve them via the server's /media
// gateway instead (see src/server/headless/mediaRoutes.ts).
//
// Local Electron clients don't use this (they read files directly).

import { getRemoteServerConfig, isSocketTransport } from "../IPC/transport"

/** True when media should be fetched from the server (web build or hybrid desktop). */
export function isRemoteMedia(): boolean {
    return isSocketTransport()
}

/** True if this is already a gateway URL (absolute or origin-relative). */
export function isGatewayUrl(path: string): boolean {
    return typeof path === "string" && /(^|\/)(media|thumbnail)\?path=/.test(path)
}

/** Build a URL to the server's media gateway for a (server-side) file path. */
export function getServerMediaUrl(filePath: string): string {
    // idempotent: a resolved gateway URL can be fed back in (e.g. a cached thumbnailPath),
    // and wrapping it again would encode the whole URL as the path (-> 403).
    if (isGatewayUrl(filePath)) return filePath

    let filePathOnly = filePath
    if (filePathOnly.startsWith("file://")) filePathOnly = filePathOnly.slice("file://".length)

    const config = getRemoteServerConfig() // null for the web build (same origin as the page)
    const base = config?.url || ""

    const params = new URLSearchParams({ path: filePathOnly })
    if (config?.token) params.set("token", config.token)

    return `${base}/media?${params.toString()}`
}

/** URL for a server-generated thumbnail (falls back to the original server-side for video). */
export function getServerThumbnailUrl(filePath: string, size: number): string {
    if (isGatewayUrl(filePath)) return filePath

    let filePathOnly = filePath
    if (filePathOnly.startsWith("file://")) filePathOnly = filePathOnly.slice("file://".length)

    const config = getRemoteServerConfig()
    const base = config?.url || ""

    const params = new URLSearchParams({ path: filePathOnly, size: String(Math.round(size) || 250) })
    if (config?.token) params.set("token", config.token)

    return `${base}/thumbnail?${params.toString()}`
}

/** Upload a file into a (sandbox-relative) folder on the server. Returns true on success. */
export async function uploadToServer(folderPath: string, file: File): Promise<boolean> {
    const config = getRemoteServerConfig()
    const base = config?.url || ""

    const params = new URLSearchParams({ path: folderPath, name: file.name })
    if (config?.token) params.set("token", config.token)

    try {
        const res = await fetch(`${base}/media/upload?${params.toString()}`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: file
        })
        return res.ok
    } catch (err) {
        console.error("Upload failed:", file.name, err)
        return false
    }
}
