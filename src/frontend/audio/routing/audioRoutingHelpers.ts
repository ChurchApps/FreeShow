import type { AudioRoutingConnection } from "../../../types/AudioRouting"

export interface RoutingPortRef {
    nodeId: string
    portType: "in" | "out" | "sidechain"
    channelIndex?: number
}

export interface RenderedRoutingLine {
    fromId: string
    toId: string
    channelIndex: number
    fromChannelIndex?: number
    toChannelIndex?: number
    type?: "audio" | "sidechain"
    x1: number
    y1: number
    x2: number
    y2: number
}

export interface RoutingChannelContext {
    channelIds: string[]
    inputs: { value: string; channels: number }[]
    outputs: { value: string; channels: number }[]
}

export interface ConnectionDropParams {
    fromId: string
    toId: string
    isSidechain: boolean
    showMultichannel: boolean
    sourceChIndex?: number
    targetChIndex?: number
    ctx: RoutingChannelContext
}

const PARENT_BY_PREFIX: Record<string, string> = {
    playlist_sub_: "playlists_default",
    mic_sub_: "mic_default",
    drawer_sub_: "drawer_audio",
    speaker_sub_: "speaker_default",
    network_sub_: "network_default",
    output_win_sub_: "output_window"
}

const FIXED_INPUT_IDS = new Set(["drawer_audio", "playlists_default", "mic_default", "metronome", "desktop_default", "output_window"])
const FIXED_OUTPUT_IDS = new Set(["speaker_default", "network_default", "icecast"])

export function getConnectionFromChannel(c: AudioRoutingConnection): number | undefined {
    return c.fromChannelIndex ?? (c.from?.startsWith("mic_sub_") ? c.channelIndex : undefined)
}

export function getConnectionToChannel(c: AudioRoutingConnection): number | undefined {
    return c.toChannelIndex ?? (c.to?.startsWith("speaker_sub_") ? c.channelIndex : undefined)
}

export function isStereoConnection(conn: AudioRoutingConnection): boolean {
    return getConnectionFromChannel(conn) === undefined && (conn.type === "sidechain" || getConnectionToChannel(conn) === undefined)
}

export function deduplicateConnections(connections: AudioRoutingConnection[]): AudioRoutingConnection[] {
    const seen = new Set<string>()
    return connections.filter((c) => {
        const key = `${c.from}:${getConnectionFromChannel(c) ?? -1}->${c.to}:${c.type === "sidechain" ? -1 : (getConnectionToChannel(c) ?? -1)}:${c.type || "audio"}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

function matchesPair(conn: AudioRoutingConnection, fromId: string, toId: string, type: "audio" | "sidechain" = "audio"): boolean {
    return conn.from === fromId && conn.to === toId && (conn.type || "audio") === type
}

function matchesExact(conn: AudioRoutingConnection, fromId: string, toId: string, type: "audio" | "sidechain", fromCh?: number, toCh?: number): boolean {
    return matchesPair(conn, fromId, toId, type) && getConnectionFromChannel(conn) === fromCh && (conn.type === "sidechain" ? undefined : getConnectionToChannel(conn)) === toCh
}

function getParentId(id: string): string | undefined {
    for (const [prefix, parentId] of Object.entries(PARENT_BY_PREFIX)) {
        if (id.startsWith(prefix)) return parentId
    }
    return undefined
}

function areRelatedNodes(a: string, b: string): boolean {
    return a === b || getParentId(a) === b || getParentId(b) === a
}

function clearParentSubConflicts(connections: AudioRoutingConnection[], fromId: string, toId: string): AudioRoutingConnection[] {
    return connections.filter((c) => c.type === "sidechain" || !((c.to === toId && c.from !== fromId && areRelatedNodes(c.from, fromId)) || (c.from === fromId && c.to !== toId && areRelatedNodes(c.to, toId))))
}

function getInChannelCount(nodeId: string, ctx: RoutingChannelContext, isSidechain = false): number {
    if (isSidechain) return 1
    if (ctx.channelIds.includes(nodeId) || nodeId.startsWith("network_sub_")) return 2
    if (nodeId.startsWith("speaker_sub_")) return ctx.outputs.find((s) => s.value === nodeId.replace("speaker_sub_", ""))?.channels || 2
    return 1
}

function hasMultiIn(nodeId: string, ctx: RoutingChannelContext, isSidechain = false): boolean {
    return getInChannelCount(nodeId, ctx, isSidechain) > 1
}

function hasMultiOut(nodeId: string, ctx: RoutingChannelContext): boolean {
    if (nodeId === "metronome" || nodeId === "mic_default") return false
    if (nodeId.startsWith("mic_sub_")) return (ctx.inputs.find((m) => m.value === nodeId)?.channels || 2) > 1
    return true
}

function buildPinConnection(fromId: string, toId: string, type: "audio" | "sidechain", ch: number, ctx: RoutingChannelContext): AudioRoutingConnection {
    return {
        from: fromId,
        to: toId,
        type,
        ...(hasMultiOut(fromId, ctx) ? { fromChannelIndex: ch } : {}),
        ...(hasMultiIn(toId, ctx, type === "sidechain") ? { toChannelIndex: ch } : {})
    }
}

function expandStereoConnection(connections: AudioRoutingConnection[], fromId: string, toId: string, type: "audio" | "sidechain", ctx: RoutingChannelContext, omitPin?: number): boolean {
    const idx = connections.findIndex((conn) => matchesPair(conn, fromId, toId, type) && isStereoConnection(conn))
    if (idx === -1) return false

    const replacement = [0, 1].filter((ch) => ch !== omitPin).map((ch) => buildPinConnection(fromId, toId, type, ch, ctx))
    connections.splice(idx, 1, ...replacement)
    return true
}

function getOppositeTypeConflict(connections: AudioRoutingConnection[], fromId: string, toId: string, connType: "audio" | "sidechain", resolvedFromCh?: number): string | null {
    const oppositeType = connType === "sidechain" ? "audio" : "sidechain"
    const hasConflict = connections.some((conn) => {
        if (conn.to !== toId || (conn.type || "audio") !== oppositeType || !areRelatedNodes(conn.from, fromId)) return false
        const cFrom = getConnectionFromChannel(conn)
        return resolvedFromCh !== undefined && conn.from === fromId && cFrom !== undefined ? cFrom === resolvedFromCh : true
    })
    if (!hasConflict) return null

    const label = oppositeType === "sidechain" ? "sidechain" : "regular audio"
    return `This source${resolvedFromCh !== undefined ? " channel" : ""} already has a ${label} connection to this channel.`
}

export function isValidNodeHover(nodeId: string, columnType: "input" | "channel" | "output", dragStartId: string | null, dragStartType: "input" | "channel" | "output" | null, dragStartPortType: "in" | "out" | "sidechain" | null): boolean {
    if (!dragStartId || nodeId === dragStartId) return false
    if (dragStartType === "input" || dragStartType === "output") return columnType === "channel"
    if (dragStartType === "channel") {
        if (dragStartPortType === "in") return columnType === "input" && nodeId !== "output_window"
        if (dragStartPortType === "sidechain") return columnType === "channel" || (columnType === "input" && nodeId !== "output_window")
        if (dragStartPortType === "out") return columnType === "channel" || (columnType === "output" && nodeId !== "network_default")
    }
    return false
}

export function isValidRoutingConnection(fromId: string, toId: string, channelIds: string[], dragStartPortType: "in" | "out" | "sidechain" | null, hoverTargetPortType: "in" | "out" | "sidechain" | null): { valid: boolean; from: string; to: string } {
    const isInput = (id: string) => FIXED_INPUT_IDS.has(id) || id.startsWith("playlist_sub_") || id.startsWith("mic_sub_") || id.startsWith("output_win_sub_")
    const isChannel = (id: string) => channelIds.includes(id)
    const isOutput = (id: string) => FIXED_OUTPUT_IDS.has(id) || id.startsWith("speaker_sub_") || id.startsWith("network_sub_")

    if (isChannel(fromId) && isChannel(toId) && fromId !== toId && (dragStartPortType === "sidechain" || hoverTargetPortType === "sidechain")) {
        return dragStartPortType === "sidechain" ? { valid: true, from: toId, to: fromId } : { valid: true, from: fromId, to: toId }
    }
    if ((isInput(fromId) && isChannel(toId)) || (isChannel(fromId) && isOutput(toId))) return { valid: true, from: fromId, to: toId }
    if ((isOutput(fromId) && isChannel(toId)) || (isChannel(fromId) && isInput(toId))) return { valid: true, from: toId, to: fromId }
    return { valid: false, from: fromId, to: toId }
}

export function applyConnectionDrop(connections: AudioRoutingConnection[], params: ConnectionDropParams): { connections: AudioRoutingConnection[]; error?: string } {
    const { fromId, toId, isSidechain, showMultichannel, sourceChIndex, targetChIndex, ctx } = params
    const connType: "audio" | "sidechain" = isSidechain ? "sidechain" : "audio"
    let next = [...connections]

    if (isSidechain && (fromId === toId || next.some((c) => matchesPair(c, toId, fromId, "sidechain")))) {
        return { connections, error: fromId !== toId ? "Cannot create circular sidechain." : undefined }
    }

    // Full stereo connection (single port or dropped on card from a single-channel port)
    if (sourceChIndex === undefined && targetChIndex === undefined) {
        const pairConns = next.filter((c) => matchesPair(c, fromId, toId, connType))
        const hasBoth = pairConns.some(isStereoConnection) || [0, 1].every((ch) => pairConns.some((c) => (!hasMultiOut(fromId, ctx) || getConnectionFromChannel(c) === ch) && (!hasMultiIn(toId, ctx, isSidechain) || getConnectionToChannel(c) === ch)))
        if (hasBoth) return { connections: next.filter((c) => !matchesPair(c, fromId, toId, connType)) }

        const conflict = getOppositeTypeConflict(next, fromId, toId, connType)
        if (conflict) return { connections, error: conflict }

        next = next.filter((c) => !matchesPair(c, fromId, toId, connType))
        if (!isSidechain) next = clearParentSubConflicts(next, fromId, toId)
        return { connections: [...next, { from: fromId, to: toId, type: connType }] }
    }

    // Discrete channel connection (dropping on a node card maps to the corresponding channel index)
    const resolvedFromCh = sourceChIndex ?? (showMultichannel && hasMultiOut(fromId, ctx) ? (targetChIndex ?? 0) % 2 : undefined)
    const resolvedToCh = isSidechain ? undefined : (targetChIndex ?? (showMultichannel && hasMultiIn(toId, ctx) ? sourceChIndex : undefined))
    const sameStereoPin = resolvedFromCh === undefined || resolvedToCh === undefined || resolvedFromCh === resolvedToCh ? (resolvedFromCh ?? resolvedToCh) : undefined

    if ((sameStereoPin === 0 || sameStereoPin === 1) && expandStereoConnection(next, fromId, toId, connType, ctx, sameStereoPin)) {
        return { connections: next }
    }
    expandStereoConnection(next, fromId, toId, connType, ctx)

    const existingIdx = next.findIndex((c) => matchesExact(c, fromId, toId, connType, resolvedFromCh, resolvedToCh))
    if (existingIdx !== -1) {
        next.splice(existingIdx, 1)
        return { connections: next }
    }

    const conflict = getOppositeTypeConflict(next, fromId, toId, connType, resolvedFromCh)
    if (conflict) return { connections, error: conflict }

    if (!isSidechain) next = clearParentSubConflicts(next, fromId, toId)
    next.push({
        from: fromId,
        to: toId,
        type: connType,
        ...(resolvedFromCh !== undefined ? { fromChannelIndex: resolvedFromCh } : {}),
        ...(resolvedToCh !== undefined ? { toChannelIndex: resolvedToCh } : {})
    })
    return { connections: next }
}

export function removeRoutingConnection(connections: AudioRoutingConnection[], fromId: string, toId: string, type: "audio" | "sidechain" = "audio", showMultichannel = false, ctx?: RoutingChannelContext, fromCh?: number, toCh?: number): AudioRoutingConnection[] {
    const next = [...connections]
    if (showMultichannel && ctx && (fromCh !== undefined || toCh !== undefined)) {
        if (expandStereoConnection(next, fromId, toId, type, ctx, fromCh ?? toCh ?? 0)) return next
        return next.filter((c) => !matchesExact(c, fromId, toId, type, fromCh, toCh))
    }
    return next.filter((c) => !matchesPair(c, fromId, toId, type))
}

export function clearPortConnections(connections: AudioRoutingConnection[], nodeId: string, portType: "in" | "out" | "sidechain", ctx: RoutingChannelContext, channelIndex?: number): AudioRoutingConnection[] {
    if (portType === "sidechain") return connections.filter((c) => !(c.to === nodeId && c.type === "sidechain"))
    if (channelIndex === undefined) return connections.filter((c) => (portType === "in" ? c.to !== nodeId || c.type === "sidechain" : c.from !== nodeId))

    return connections.flatMap((c) => {
        if (!(portType === "in" ? c.to === nodeId && c.type !== "sidechain" : c.from === nodeId)) return [c]
        if (isStereoConnection(c)) return [buildPinConnection(c.from, c.to, c.type || "audio", channelIndex === 0 ? 1 : 0, ctx)]
        return (portType === "in" ? getConnectionToChannel(c) : getConnectionFromChannel(c)) === channelIndex ? [] : [c]
    })
}

export function isLineConnectedToPort(line: RenderedRoutingLine, port: RoutingPortRef | null): boolean {
    if (!port) return false
    if (port.portType === "sidechain") return line.toId === port.nodeId && line.type === "sidechain"
    if (port.portType === "out") return line.fromId === port.nodeId && (port.channelIndex === undefined || line.fromChannelIndex === undefined || line.fromChannelIndex === port.channelIndex)
    return line.toId === port.nodeId && line.type !== "sidechain" && (port.channelIndex === undefined || line.toChannelIndex === undefined || line.toChannelIndex === port.channelIndex)
}

export function getNodeAutoColor(index: number): string {
    return `hsl(${(275 + Math.max(0, index) * 6) % 360}, 80%, 65%)`
}

export function getSourceNodeVisual<T extends { id: string; color?: string; isEnabled?: boolean; subNodes?: T[] }>(columns: { nodes: T[] }[], nodeId: string, isSidechain: boolean): { color: string; isDisabled: boolean } {
    const sourceCol = columns.find((col) => col.nodes.some((n) => n.id === nodeId || (n.subNodes || []).some((s) => s.id === nodeId)))
    const colNodes = (sourceCol?.nodes || []).flatMap((n) => [n, ...(n.subNodes || [])])
    const nodeIndex = colNodes.findIndex((n) => n.id === nodeId)
    const sourceNode = nodeIndex >= 0 ? colNodes[nodeIndex] : undefined
    return {
        color: isSidechain ? "#f59e0b" : sourceNode?.color || getNodeAutoColor(nodeIndex),
        isDisabled: sourceNode?.isEnabled === false
    }
}
