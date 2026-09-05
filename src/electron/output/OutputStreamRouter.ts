// OutputShow (OUTPUT_STREAM) clients each display one specific output, chosen by the URL path they opened.
// Frames are therefore routed to the sockets watching that output instead of broadcast to every client,
// which is what previously made every HTML output URL show the same (single captured) output.

// resend a frame even if the client never acknowledged the previous one (client stalled/reloaded)
export const STREAM_FRAME_ACK_TIMEOUT = 2000
// let another output take over the root path if the current one stopped streaming
const ROOT_OUTPUT_TIMEOUT = 3000
// time a freshly connected client gets to tell us which output it wants before it is treated as a root client
const SUBSCRIBE_GRACE = 1500

export function slugifyStreamPath(value: string) {
    return (value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
}

export type StreamFrameData = { id?: string; path?: string; name?: string }

export class OutputStreamRouter {
    private static clients: { [socketId: string]: { path: string | null; connectedAt: number } } = {} // path: slugified ("" = root, null = not announced yet)
    private static pending: { [key: string]: number } = {} // `${socketId}|${outputId}`: time the frame was sent
    private static rootOutputId = "" // output currently shown on the root path when none is selected in the settings
    private static rootOutputTime = 0

    static reset() {
        this.clients = {}
        this.pending = {}
        this.rootOutputId = ""
        this.rootOutputTime = 0
    }

    static addSocket(socketId: string, now = Date.now()) {
        this.clients[socketId] = { path: null, connectedAt: now }
    }

    static setPath(socketId: string, path: string, now = Date.now()) {
        this.clients[socketId] = { path: slugifyStreamPath(path), connectedAt: this.clients[socketId]?.connectedAt ?? now }
        // any frame still in flight belonged to the previously watched output
        this.clearPending(socketId)
    }

    static removeSocket(socketId: string) {
        delete this.clients[socketId]
        this.clearPending(socketId)
    }

    static acknowledge(socketId: string, outputId: string) {
        delete this.pending[`${socketId}|${outputId}`]
    }

    private static clearPending(socketId: string) {
        for (const key of Object.keys(this.pending)) {
            if (key.startsWith(`${socketId}|`)) delete this.pending[key]
        }
    }

    // the root path shows a single output (legacy behaviour): the one selected in the OutputShow server settings,
    // otherwise the first one that streams - so it does not flip between outputs now that several can stream at once
    private static rootMatches(outputId: string, selectedOutputId: string, now: number): boolean {
        if (selectedOutputId) return selectedOutputId === outputId

        // let another output take over if the current one stopped streaming
        if (!this.rootOutputId || this.rootOutputId === outputId || now - this.rootOutputTime > ROOT_OUTPUT_TIMEOUT) {
            this.rootOutputId = outputId
            this.rootOutputTime = now
            return true
        }

        return false
    }

    // sockets that should receive a frame from this output
    static getTargets(socketIds: string[], data: StreamFrameData, rootOutputId = "", now = Date.now()): string[] {
        const outputSlugs = new Set([slugifyStreamPath(data.path || ""), slugifyStreamPath(data.name || ""), slugifyStreamPath(data.id || "")].filter(Boolean))
        const rootMatches = this.rootMatches(data.id || "", rootOutputId, now)

        return socketIds.filter((socketId) => {
            const client = this.clients[socketId]
            // a client that has not announced its path yet gets nothing until the grace period passes,
            // so it never briefly renders another output (older clients that never announce fall back to the root output)
            if (!client) return rootMatches
            if (client.path === null) return now - client.connectedAt > SUBSCRIBE_GRACE && rootMatches

            return client.path ? outputSlugs.has(client.path) : rootMatches
        })
    }

    // only send a new frame once the client responded to the previous one (per socket & output, so a slow client can't stall the others)
    static claimFrame(socketId: string, outputId: string, now = Date.now()): boolean {
        const key = `${socketId}|${outputId}`
        const sentAt = this.pending[key]
        if (sentAt && now - sentAt < STREAM_FRAME_ACK_TIMEOUT) return false

        this.pending[key] = now
        return true
    }
}
