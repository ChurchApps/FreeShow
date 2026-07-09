// Tracks which web StageShow connections are actively viewing a "current output" mirror item.
// Output capture for the stage channel only needs to run while at least one viewer exists,
// so text-only stage displays never cause frame capture/streaming work.

const VIEWER_TTL = 10000 // subscriptions are renewed by a client heartbeat (and by legacy REQUEST_STREAM polls)

const viewers: { [socketId: string]: { expires: number; outputId?: string } } = {}

/** Register/renew a viewer. Returns true if this is a new registration (capture state should be re-checked). */
export function addStageStreamViewer(socketId: string, outputId?: string): boolean {
    if (!socketId) return false

    const isNew = !viewers[socketId]
    viewers[socketId] = { expires: Date.now() + VIEWER_TTL, outputId: outputId || viewers[socketId]?.outputId }
    return isNew
}

export function removeStageStreamViewer(socketId: string) {
    delete viewers[socketId]
}

/** Are any connected stage clients viewing a mirror of this output? (prunes disconnected/expired entries) */
export function hasStageStreamViewers(connectedIds: string[], outputId: string): boolean {
    const connected = new Set(connectedIds)
    const now = Date.now()
    Object.keys(viewers).forEach((socketId) => {
        if (!connected.has(socketId) || viewers[socketId].expires < now) delete viewers[socketId]
    })

    // a viewer without a specific output (no stage layout output set) matches any output
    return Object.values(viewers).some((viewer) => !viewer.outputId || viewer.outputId === outputId)
}
