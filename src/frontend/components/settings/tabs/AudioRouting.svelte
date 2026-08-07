<script lang="ts">
    import { onMount, tick } from "svelte"
    import { get } from "svelte/store"
    import { uid } from "uid"
    import type { AudioRoutingConfig } from "../../../../types/AudioRouting"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { AudioInputCapture } from "../../../audio/routing/audioInputCapture"
    import { deduplicateConnections } from "../../../audio/routing/audioRoutingInit"
    import { activePopup, audioChannelsData, audioPlaylists, audioRouting, outputs, selected } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { keysToID } from "../../helpers/array"
    import { getAllOutputs } from "../../helpers/output"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import AudioRoutingNode from "./AudioRoutingNode.svelte"

    interface RoutingColumnNode {
        id: string
        name: string
        type: string
        isExpanded?: boolean
        hasSubNodes?: boolean
        subNodes?: RoutingColumnNode[]
        channels?: number
        isEnabled?: boolean
        color?: string
        isMuted?: boolean
        hasInputConnection?: boolean
        icon?: string
    }

    interface RoutingColumn {
        title: string
        type: "input" | "channel" | "merger" | "output"
        nodes: RoutingColumnNode[]
    }

    interface RenderedLine {
        fromId: string
        toId: string
        channelIndex: number
        x1: number
        y1: number
        x2: number
        y2: number
    }

    const PARENT_PREFIX_MAP: Record<string, { parentId: string; prefix: string }> = {
        playlist_sub_: { parentId: "playlists_default", prefix: "playlist_sub_" },
        mic_sub_: { parentId: "mic_default", prefix: "mic_sub_" },
        drawer_sub_: { parentId: "drawer_audio", prefix: "drawer_sub_" },
        speaker_sub_: { parentId: "speaker_default", prefix: "speaker_sub_" },
        network_sub_: { parentId: "network_default", prefix: "network_sub_" },
        output_win_sub_: { parentId: "output_window", prefix: "output_win_sub_" }
    }

    const fixedInputs = [
        { id: "drawer_audio", name: translateText("tabs.audio"), type: "drawer_audio" },
        { id: "playlists_default", name: translateText("audio.playlists"), type: "playlist" },
        { id: "mic_default", name: translateText("live.microphones"), type: "mic" },
        { id: "metronome", name: translateText("audio.metronome"), type: "metronome" },
        { id: "desktop_default", name: translateText("audio.desktop_audio"), type: "desktop_audio" },
        { id: "output_window", name: translateText("settings.display_settings"), type: "output_window" }
    ]

    const fixedOutputs = [
        { id: "speaker_default", name: translateText("audio.speakers"), type: "speaker" },
        { id: "network_default", name: translateText("settings.network_output"), type: "network" },
        { id: "icecast", name: "Icecast", type: "icecast" }
    ]

    let availableAudioInputs: { value: string; label: string }[] = []
    let availableAudioOutputs: { value: string; label: string; channels: number }[] = []
    let expandedNodes: Set<string> = new Set(["output_window", "network_default"])

    let containerEl: HTMLDivElement
    let spaceEl: HTMLDivElement

    let isPanning = false
    let startPanMouse = { x: 0, y: 0 }
    let startScroll = { left: 0, top: 0 }

    let isConnecting = false
    let dragStartId: string | null = null
    let dragStartType: "input" | "channel" | "merger" | "output" | null = null
    let dragStartPortType: "in" | "out" | null = null
    let dragFromPos = { x: 0, y: 0 }
    let dragCurrentPos = { x: 0, y: 0 }
    let hoverTargetId: string | null = null
    let hoverTargetPortEl: HTMLElement | null = null
    let hoveredPort: { nodeId: string; portType: "in" | "out"; channelIndex?: number } | null = null

    let lines: RenderedLine[] = []
    let connectionFrame: number | null = null

    $: config = $audioRouting || { channels: [], connections: [] }
    $: channelsList = config.channels || []
    $: inactiveOutputIds = keysToID($outputs).filter((a) => !a.enabled)

    $: availablePlaylists = keysToID($audioPlaylists).map((p) => ({
        id: `playlist_sub_${p.id}`,
        name: p.name || p.id,
        type: "playlist"
    }))

    $: nonStageOutputs = getAllOutputs()
        .filter((out) => out && !out.stageOutput)
        .map((out) => ({
            id: `output_win_sub_${out.id}`,
            name: out.name || out.id,
            type: "output_window",
            color: out.color,
            isEnabled: (out as any).enabled
        }))

    $: networkOutputWindows = getAllOutputs()
        .filter((out) => out && (out.rtmp || out.webrtc || out.ndi))
        .map((out) => {
            const connId = `network_sub_${out.id}`
            return {
                id: connId,
                name: out.name || out.id,
                type: "network",
                icon: out.ndi ? "ndi" : "broadcast",
                color: out.color,
                isEnabled: (out as any).enabled,
                hasInputConnection: config.connections.some((c) => c.to === connId)
            }
        })

    // Auto-expand parent nodes if a child has active connections
    $: {
        let changed = false
        for (const conn of config.connections) {
            for (const [, { parentId, prefix }] of Object.entries(PARENT_PREFIX_MAP)) {
                if ((conn.from.startsWith(prefix) || conn.to.startsWith(prefix)) && !expandedNodes.has(parentId)) {
                    expandedNodes.add(parentId)
                    changed = true
                }
            }
        }
        if (changed) expandedNodes = expandedNodes
    }

    $: columns = [
        {
            title: "Inputs",
            type: "input",
            nodes: fixedInputs.map((node) => {
                const subNodes = node.id === "playlists_default" ? availablePlaylists : node.id === "mic_default" ? availableAudioInputs.map((mic) => ({ id: mic.value, name: mic.label, type: "mic" })) : node.id === "output_window" ? nonStageOutputs : []
                const isEnabled = node.type === "desktop_audio" ? !!config.desktopAudioEnabled : true
                return {
                    ...node,
                    isEnabled,
                    isExpanded: expandedNodes.has(node.id) || node.id === "output_window",
                    hasSubNodes: subNodes.length > 0,
                    subNodes,
                    onToggleEnabled: node.type === "desktop_audio" ? toggleDesktopAudio : undefined
                }
            })
        },
        {
            title: "Channels",
            type: "channel",
            nodes: channelsList.map((m) => {
                const inactive = inactiveOutputIds.some((a) => `channel_${a.id}` === m.id)
                const chData = get(audioChannelsData)[m.id]
                const muted = chData ? chData.isMuted || chData.volume === 0 : false
                return {
                    id: m.id,
                    name: m.name,
                    type: "channel",
                    color: m.color,
                    isEnabled: !inactive,
                    isMuted: muted,
                    hasInputConnection: config.connections.some((c) => c.to === m.id)
                }
            })
        },
        {
            title: "Outputs",
            type: "output",
            nodes: fixedOutputs.map((node) => {
                const subNodes =
                    node.id === "speaker_default"
                        ? availableAudioOutputs.map((s) => ({
                              id: `speaker_sub_${s.value}`,
                              name: s.label,
                              type: "speaker",
                              channels: s.channels,
                              hasInputConnection: config.connections.some((c) => c.to === `speaker_sub_${s.value}`)
                          }))
                        : node.id === "network_default"
                          ? networkOutputWindows
                          : []

                return {
                    ...node,
                    isExpanded: expandedNodes.has(node.id) || node.id === "network_default",
                    hasSubNodes: subNodes.length > 0,
                    subNodes,
                    hasInputConnection: config.connections.some((c) => c.to === node.id)
                }
            })
        }
    ] as RoutingColumn[]

    $: if (config || expandedNodes || nonStageOutputs || networkOutputWindows || availablePlaylists) {
        tick().then(requestUpdateConnectionLines)
    }

    $: activeHoverPort = isConnecting ? (dragStartId && dragStartPortType ? { nodeId: dragStartId, portType: dragStartPortType } : null) : hoveredPort

    $: sortedLines = activeHoverPort
        ? [...lines].sort((a, b) => {
              const aHigh = isLineConnectedToPort(a, activeHoverPort)
              const bHigh = isLineConnectedToPort(b, activeHoverPort)
              return aHigh === bHigh ? 0 : aHigh ? 1 : -1
          })
        : lines

    function toggleDesktopAudio(enabled: boolean) {
        updateConfig((c) => {
            c.desktopAudioEnabled = enabled
        })
    }

    onMount(() => {
        refreshDevices()

        navigator.mediaDevices.addEventListener("devicechange", refreshDevices)
        const resizeObs = new ResizeObserver(requestUpdateConnectionLines)

        if (spaceEl) resizeObs.observe(spaceEl)
        if (containerEl) containerEl.addEventListener("scroll", requestUpdateConnectionLines)

        return () => {
            navigator.mediaDevices.removeEventListener("devicechange", refreshDevices)
            resizeObs.disconnect()
            if (containerEl) containerEl.removeEventListener("scroll", requestUpdateConnectionLines)
            if (connectionFrame !== null) cancelAnimationFrame(connectionFrame)
        }
    })

    function requestUpdateConnectionLines() {
        if (connectionFrame !== null) return
        connectionFrame = requestAnimationFrame(() => {
            connectionFrame = null
            updateConnectionLines()
        })
    }

    async function refreshDevices() {
        availableAudioOutputs = await AudioPlayer.getOutputs()
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            availableAudioInputs = devices
                .filter((d) => d.kind === "audioinput" && d.deviceId !== "default")
                .map((d, index) => ({
                    value: `mic_sub_${d.deviceId}`,
                    label: d.label || `Microphone ${index + 1}`
                }))
        } catch (e) {
            console.warn("Could not enumerate audio inputs:", e)
        }
        tick().then(updateConnectionLines)
    }

    function toggleExpand(id: string) {
        expandedNodes.has(id) ? expandedNodes.delete(id) : expandedNodes.add(id)
        expandedNodes = expandedNodes
        tick().then(updateConnectionLines)
    }

    function updateConfig(fn: (c: AudioRoutingConfig) => void) {
        audioRouting.update((c) => {
            const copy: AudioRoutingConfig = {
                ...c,
                channels: [...(c?.channels || [])],
                connections: [...(c?.connections || [])]
            }
            fn(copy)
            copy.connections = deduplicateConnections(copy.connections)
            return copy
        })
        tick().then(requestUpdateConnectionLines)
    }

    function addChannel() {
        const id = `channel_${uid()}`
        updateConfig((c) => {
            const list = c.channels || []
            list.push({ id, name: `${translateText("midi.channel")} ${list.length + 1}` })
            c.channels = list
        })
        selected.set({ id: "audio_channel", data: [{ id }] })
        activePopup.set("rename")
    }

    function getNodePortPos(nodeId: string, portType: "in" | "out", portElement?: HTMLElement | null): { x: number; y: number } | null {
        if (!spaceEl) return null
        const portEl = portElement || spaceEl.querySelector<HTMLElement>(`[data-node-id="${nodeId}"] .port-${portType}`)
        if (!portEl) return null

        const spaceRect = spaceEl.getBoundingClientRect()
        const portRect = portEl.getBoundingClientRect()
        return {
            x: portRect.left + portRect.width / 2 - spaceRect.left,
            y: portRect.top + portRect.height / 2 - spaceRect.top
        }
    }

    function updateConnectionLines() {
        if (!spaceEl) return
        const newLines: RenderedLine[] = []

        for (const conn of config.connections) {
            const fromPos = getNodePortPos(conn.from, "out")
            const isSpeakerSub = conn.to.startsWith("speaker_sub_")
            let toPos: { x: number; y: number } | null = null

            if (isSpeakerSub && (conn as any).channelIndex !== undefined) {
                const chEl = spaceEl.querySelector<HTMLElement>(`[data-node-id="${conn.to}"] [data-ch-index="${(conn as any).channelIndex}"]`)
                if (chEl) toPos = getNodePortPos(conn.to, "in", chEl)
            }
            toPos ??= getNodePortPos(conn.to, "in")

            if (fromPos && toPos) {
                newLines.push({
                    fromId: conn.from,
                    toId: conn.to,
                    channelIndex: (conn as any).channelIndex ?? 0,
                    x1: fromPos.x,
                    y1: fromPos.y,
                    x2: toPos.x,
                    y2: toPos.y
                })
            }
        }
        lines = newLines
    }

    function handlePortMouseDown(e: MouseEvent, nodeId: string, nodeType: "input" | "channel" | "merger" | "output", portType: "in" | "out", _channelIndex = 0) {
        e.preventDefault()
        e.stopPropagation()
        isConnecting = true
        dragStartId = nodeId
        dragStartType = nodeType
        dragStartPortType = portType

        const pos = getNodePortPos(nodeId, portType, e.currentTarget as HTMLElement)
        if (pos) {
            dragFromPos = pos
            dragCurrentPos = pos
        }

        window.addEventListener("mousemove", handleGlobalMouseMove)
        window.addEventListener("mouseup", handleGlobalMouseUp)
    }

    function handleContainerMouseDown(e: MouseEvent) {
        if (e.button !== 0 && e.button !== 1) return
        if ((e.target as HTMLElement).closest(".node-card, .port, button, input, .dropdown")) return

        isPanning = true
        startPanMouse = { x: e.clientX, y: e.clientY }
        startScroll = { left: containerEl.scrollLeft, top: containerEl.scrollTop }

        window.addEventListener("mousemove", handleGlobalMouseMove)
        window.addEventListener("mouseup", handleGlobalMouseUp)
    }

    function handleGlobalMouseMove(e: MouseEvent) {
        if (!spaceEl) return
        const spaceRect = spaceEl.getBoundingClientRect()

        if (isConnecting) {
            dragCurrentPos = { x: e.clientX - spaceRect.left, y: e.clientY - spaceRect.top }
        } else if (isPanning && containerEl) {
            containerEl.scrollLeft = startScroll.left - (e.clientX - startPanMouse.x)
            containerEl.scrollTop = startScroll.top - (e.clientY - startPanMouse.y)
        }
    }

    function isValidConnection(fromId: string, toId: string): { valid: boolean; from: string; to: string } {
        const isInput = (id: string) => fixedInputs.some((i) => i.id === id) || id.startsWith("playlist_sub_") || id.startsWith("mic_sub_") || id.startsWith("output_win_sub_")
        const isChannel = (id: string) => channelsList.some((m) => m.id === id)
        const isOutput = (id: string) => fixedOutputs.some((o) => o.id === id) || id.startsWith("speaker_sub_") || id.startsWith("network_sub_")

        if ((isInput(fromId) && isChannel(toId)) || (isChannel(fromId) && isOutput(toId))) {
            return { valid: true, from: fromId, to: toId }
        }
        if ((isOutput(fromId) && isChannel(toId)) || (isChannel(fromId) && isInput(toId))) {
            return { valid: true, from: toId, to: fromId }
        }
        return { valid: false, from: fromId, to: toId }
    }

    function handleGlobalMouseUp() {
        window.removeEventListener("mousemove", handleGlobalMouseMove)
        window.removeEventListener("mouseup", handleGlobalMouseUp)

        if (isConnecting && hoverTargetId && dragStartId && dragStartId !== hoverTargetId) {
            const { valid, from: fromId, to: toId } = isValidConnection(dragStartId, hoverTargetId)

            if (valid) {
                updateConfig((c) => {
                    const isSpeakerSub = toId.startsWith("speaker_sub_")
                    const deviceId = isSpeakerSub ? toId.replace("speaker_sub_", "") : ""
                    const chCount = availableAudioOutputs.find((s) => s.value === deviceId)?.channels || 2

                    const chIndexStr = hoverTargetPortEl?.dataset?.chIndex
                    const isSpecificCircle = chIndexStr !== undefined

                    if (isSpeakerSub && chCount > 1 && !isSpecificCircle) {
                        const activeConns = c.connections.filter((conn) => conn.from === fromId && conn.to === toId)
                        if (activeConns.length >= chCount) {
                            c.connections = c.connections.filter((conn) => !(conn.from === fromId && conn.to === toId))
                        } else {
                            c.connections = c.connections.filter((conn) => !(conn.from === fromId && conn.to === "speaker_default"))
                            for (let ch = 0; ch < chCount; ch++) {
                                if (!c.connections.some((conn) => conn.from === fromId && conn.to === toId && ((conn as any).channelIndex ?? 0) === ch)) {
                                    c.connections.push({ from: fromId, to: toId, channelIndex: ch } as any)
                                }
                            }
                        }
                    } else {
                        const targetChIndex = isSpecificCircle ? parseInt(chIndexStr) : 0
                        const existingIndex = c.connections.findIndex((conn) => conn.from === fromId && conn.to === toId && (!isSpeakerSub || ((conn as any).channelIndex ?? 0) === targetChIndex))

                        if (existingIndex !== -1) {
                            c.connections.splice(existingIndex, 1)
                        } else {
                            for (const [, { parentId, prefix }] of Object.entries(PARENT_PREFIX_MAP)) {
                                if (fromId.startsWith(prefix)) {
                                    c.connections = c.connections.filter((conn) => !(conn.from === parentId && conn.to === toId))
                                } else if (fromId === parentId) {
                                    c.connections = c.connections.filter((conn) => !(conn.from.startsWith(prefix) && conn.to === toId))
                                }
                                if (toId.startsWith(prefix)) {
                                    c.connections = c.connections.filter((conn) => !(conn.from === fromId && conn.to === parentId))
                                } else if (toId === parentId) {
                                    c.connections = c.connections.filter((conn) => !(conn.from === fromId && conn.to.startsWith(prefix)))
                                }
                            }
                            c.connections.push({ from: fromId, to: toId, channelIndex: targetChIndex } as any)
                        }
                    }
                })
            }
        }

        isConnecting = false
        dragStartId = null
        dragStartType = null
        dragStartPortType = null
        hoverTargetId = null
        isPanning = false
    }

    function removeConnection(fromId: string, toId: string) {
        updateConfig((c) => {
            c.connections = c.connections.filter((conn) => !(conn.from === fromId && conn.to === toId))
        })
    }

    function handlePortContextMenu(e: MouseEvent, nodeId: string, portType: "in" | "out", channelIndex = 0) {
        e.preventDefault()
        e.stopPropagation()

        updateConfig((c) => {
            c.connections = c.connections.filter((conn) => {
                if (portType === "in") {
                    if (conn.to !== nodeId) return true
                    return nodeId.startsWith("speaker_sub_") ? ((conn as any).channelIndex ?? 0) !== channelIndex : false
                }
                return conn.from !== nodeId
            })
        })
    }

    function handleNodeMouseEnter(nodeId: string, columnType: "input" | "channel" | "merger" | "output") {
        if (!isConnecting) return

        let valid = false
        if (dragStartType === "input" && (columnType === "channel" || columnType === "merger")) valid = true
        else if (dragStartType === "output" && (columnType === "channel" || columnType === "merger")) valid = true
        else if (dragStartType === "channel" || dragStartType === "merger") {
            if (dragStartPortType === "in" && columnType === "input" && nodeId !== "output_window") valid = true
            else if (dragStartPortType === "out" && columnType === "output" && nodeId !== "network_default") valid = true
        }

        if (valid) {
            hoverTargetId = nodeId
            hoverTargetPortEl = null
        }
    }

    function handleNodeMouseLeave(nodeId: string) {
        if (hoverTargetId === nodeId) {
            hoverTargetId = null
            hoverTargetPortEl = null
        }
    }

    function handlePortMouseEnter(e: MouseEvent) {
        if (isConnecting) hoverTargetPortEl = e.currentTarget as HTMLElement
    }

    function handlePortMouseLeave() {
        hoverTargetPortEl = null
    }

    function handleHoverPort(nodeId: string, portType: "in" | "out", channelIndex?: number) {
        hoveredPort = { nodeId, portType, channelIndex }
    }

    function handleHoverPortEnd() {
        hoveredPort = null
    }

    function isLineConnectedToPort(line: RenderedLine, port: typeof hoveredPort): boolean {
        if (!port) return false
        if (port.portType === "out") return line.fromId === port.nodeId
        if (port.portType === "in") {
            if (line.toId !== port.nodeId) return false
            return port.channelIndex !== undefined ? (line.channelIndex ?? 0) === port.channelIndex : true
        }
        return false
    }
</script>

<div class="audio-routing-wrapper">
    <!-- MAIN OVERFLOW CONTAINER & CHECKERED CANVAS -->
    <div class="routing-container checkered" bind:this={containerEl} on:mousedown={handleContainerMouseDown} class:is-panning={isPanning}>
        <div class="routing-space" bind:this={spaceEl}>
            <!-- SVG Connections Layer -->
            <svg class="connections-layer">
                {#each sortedLines as line (line.fromId + "-" + line.toId + "-" + line.channelIndex)}
                    {@const sourceCol = columns.find((col) => col.nodes.some((n) => n.id === line.fromId || (n.subNodes || []).some((s) => s.id === line.fromId)))}
                    {@const colNodes = (sourceCol?.nodes || []).flatMap((n) => [n, ...(n.subNodes || [])])}
                    {@const sourceNode = colNodes.find((n) => n.id === line.fromId)}
                    {@const nodeIndex = colNodes.findIndex((n) => n.id === line.fromId)}
                    {@const hue = (275 + (nodeIndex >= 0 ? nodeIndex : 0) * 6) % 360}
                    {@const strokeColor = sourceNode?.color || `hsl(${hue}, 80%, 65%)`}
                    {@const isDisabled = sourceNode?.isEnabled === false}
                    {@const isHighlighted = isLineConnectedToPort(line, activeHoverPort)}
                    {@const isDimmed = activeHoverPort !== null && !isHighlighted}
                    {@const dx = Math.max(20, Math.abs(line.x2 - line.x1) / 2)}
                    <path d="M {line.x1} {line.y1} C {line.x1 + dx} {line.y1}, {line.x2 - dx} {line.y2}, {line.x2} {line.y2}" stroke={strokeColor} class="connection-path" class:disabled={isDisabled} class:highlighted={isHighlighted} class:dimmed={isDimmed} style={isHighlighted ? "z-index: 10;" : isDimmed ? "z-index: 1;" : ""} on:dblclick={() => removeConnection(line.fromId, line.toId)} />
                {/each}

                {#if isConnecting && dragStartId}
                    {@const dragSourceCol = columns.find((col) => col.nodes.some((n) => n.id === dragStartId || (n.subNodes || []).some((s) => s.id === dragStartId)))}
                    {@const dragColNodes = (dragSourceCol?.nodes || []).flatMap((n) => [n, ...(n.subNodes || [])])}
                    {@const dragSourceNode = dragColNodes.find((n) => n.id === dragStartId)}
                    {@const dragNodeIndex = dragColNodes.findIndex((n) => n.id === dragStartId)}
                    {@const dragHue = (275 + (dragNodeIndex >= 0 ? dragNodeIndex : 0) * 6) % 360}
                    {@const dragColor = dragSourceNode?.color || `hsl(${dragHue}, 80%, 65%)`}
                    {@const dx = Math.max(20, Math.abs(dragCurrentPos.x - dragFromPos.x) / 2)}
                    {@const sign = dragStartPortType === "out" ? 1 : -1}
                    <path d="M {dragFromPos.x} {dragFromPos.y} C {dragFromPos.x + dx * sign} {dragFromPos.y}, {dragCurrentPos.x - dx * sign} {dragCurrentPos.y}, {dragCurrentPos.x} {dragCurrentPos.y}" stroke={dragColor} class="drag-path" />
                {/if}
            </svg>

            <!-- Nodes Grid Inside Moveable Space -->
            <div class="nodes-grid">
                {#each columns as column (column.title)}
                    <div class="space-column">
                        <!-- <div class="column-title">
                            <h3>{column.title}</h3>
                        </div> -->

                        <div class="nodes-list">
                            {#each column.nodes as node (node.id)}
                                {@const colNodes = column.nodes.flatMap((n) => [n, ...(n.subNodes || [])])}
                                {@const nodeIndex = colNodes.findIndex((n) => n.id === node.id)}
                                {@const defaultHue = (275 + (nodeIndex >= 0 ? nodeIndex : 0) * 6) % 360}
                                {@const autoColor = `hsl(${defaultHue}, 80%, 65%)`}
                                <div class="node-card-group" class:has-subnodes={node.hasSubNodes}>
                                    <AudioRoutingNode
                                        {...node}
                                        {autoColor}
                                        nodeType={column.type}
                                        {hoverTargetId}
                                        {isConnecting}
                                        {dragStartId}
                                        {dragStartType}
                                        {dragStartPortType}
                                        onToggleExpand={() => toggleExpand(node.id)}
                                        onMouseDown={(e, portType, chIdx) => handlePortMouseDown(e, node.id, column.type, portType, chIdx)}
                                        onMouseEnter={() => handleNodeMouseEnter(node.id, column.type)}
                                        onMouseLeave={() => handleNodeMouseLeave(node.id)}
                                        onMouseEnterPort={handlePortMouseEnter}
                                        onMouseLeavePort={handlePortMouseLeave}
                                        onHoverPort={(_e, portType, chIdx) => handleHoverPort(node.id, portType, chIdx)}
                                        onHoverPortEnd={handleHoverPortEnd}
                                        onPortContextMenu={(e, portType, chIdx) => handlePortContextMenu(e, node.id, portType, chIdx)}
                                    />

                                    {#if node.isExpanded && node.subNodes}
                                        <div class="sub-nodes-list" style={column.type === "input" ? "margin-left: 12px;" : column.type === "output" ? "margin-right: 12px;" : ""}>
                                            {#if node.subNodes.length > 0}
                                                {#each node.subNodes as sub (sub.id)}
                                                    {@const subIndex = colNodes.findIndex((n) => n.id === sub.id)}
                                                    {@const subHue = (275 + (subIndex >= 0 ? subIndex : 0) * 6) % 360}
                                                    {@const subAutoColor = `hsl(${subHue}, 80%, 65%)`}
                                                    <AudioRoutingNode
                                                        {...sub}
                                                        autoColor={subAutoColor}
                                                        nodeType={column.type}
                                                        isSubNode={true}
                                                        {hoverTargetId}
                                                        {isConnecting}
                                                        {dragStartId}
                                                        {dragStartType}
                                                        {dragStartPortType}
                                                        onMouseDown={(e, portType, chIdx) => handlePortMouseDown(e, sub.id, column.type, portType, chIdx)}
                                                        onMouseEnter={() => handleNodeMouseEnter(sub.id, column.type)}
                                                        onMouseLeave={() => handleNodeMouseLeave(sub.id)}
                                                        onMouseEnterPort={(e) => {
                                                            if (isConnecting) {
                                                                hoverTargetId = sub.id
                                                                handlePortMouseEnter(e)
                                                            }
                                                        }}
                                                        onMouseLeavePort={handlePortMouseLeave}
                                                        onHoverPort={(_e, portType, chIdx) => handleHoverPort(sub.id, portType, chIdx)}
                                                        onHoverPortEnd={handleHoverPortEnd}
                                                        onPortContextMenu={(e, portType, chIdx) => handlePortContextMenu(e, sub.id, portType, chIdx)}
                                                    />
                                                {/each}
                                            {:else}
                                                <div class="disabled-hint">
                                                    <span class="sub-name" style="opacity:0.6;">No devices found</span>
                                                </div>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            {/each}

                            {#if column.type === "channel" || column.type === "merger"}
                                <MaterialButton variant="outlined" icon="add" on:click={addChannel} white />
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    .audio-routing-wrapper {
        display: flex;
        flex-direction: column;
        gap: 10px;
        height: 100%;
        box-sizing: border-box;
    }

    /* Outer Viewport Container */
    .routing-container {
        position: relative;
        flex: 1;
        width: 100%;
        min-height: 450px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        overflow: auto;
        cursor: grab;
        will-change: scroll-position;
    }

    .routing-container.is-panning {
        cursor: grabbing;
    }

    /* Inner Moveable Canvas */
    .routing-space {
        position: relative;
        width: 100%;
        min-width: 750px;
        min-height: 100%;
        display: flex;
        flex-direction: column;
    }

    .connections-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
        z-index: 1;
    }

    .connection-path {
        stroke-width: 3px;
        fill: none;
        pointer-events: stroke;
        cursor: pointer;
        transition:
            stroke-width 0.15s ease,
            opacity 0.2s ease;
    }

    .connection-path.disabled {
        opacity: 0.4;
    }

    .connection-path.dimmed {
        opacity: 0.15 !important;
    }

    .connection-path.highlighted {
        stroke-width: 4px;
        opacity: 1 !important;
    }

    .drag-path {
        stroke-width: 3px;
        stroke-dasharray: 6 4;
        fill: none;
    }

    .nodes-grid {
        position: relative;
        z-index: 2;
        display: grid;
        grid-template-columns: repeat(3, minmax(200px, 1fr));
        justify-items: center;
        gap: 40px;
        min-height: 100%;
        padding: 20px;
        box-sizing: border-box;
    }

    .space-column {
        display: flex;
        flex-direction: column;
        gap: 15px;
        max-width: 400px;
        min-width: 200px;
        width: 100%;
    }

    /* .column-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(0, 0, 0, 0.4);
        padding: 8px 12px;
        border-radius: 6px;
        backdrop-filter: blur(4px);
    }
    .column-title h3 {
        margin: 0;
        font-size: 1em;
        font-weight: 600;
        color: var(--text);
    } */

    .nodes-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .node-card-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        transition: all 0.2s ease;
    }

    .node-card-group.has-subnodes {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 6px;
    }

    .sub-nodes-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .disabled-hint {
        padding: 6px 12px;
        border: 1px dashed rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        background: rgba(20, 20, 30, 0.8);
    }

    .sub-name {
        font-size: 0.9em;
        opacity: 0.9;
    }
</style>
