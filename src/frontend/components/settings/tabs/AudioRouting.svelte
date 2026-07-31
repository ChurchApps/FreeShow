<script lang="ts">
    import { onMount, tick } from "svelte"
    import { uid } from "uid"
    import type { AudioRoutingConfig } from "../../../../types/AudioRouting"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { AudioInputCapture } from "../../../audio/routing/audioInputCapture"
    import { audioRouting, outputs as outputsStore } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import RoutingNode from "./RoutingNode.svelte"

    let config: AudioRoutingConfig
    $: config = $audioRouting || { mergers: [], connections: [] }

    interface RoutingColumnNode {
        id: string
        name: string
        type: string
        isExpanded?: boolean
        hasSubNodes?: boolean
        subNodes?: RoutingColumnNode[]
        channels?: number
        isEnabled?: boolean
    }

    interface RoutingColumn {
        title: string
        type: "input" | "merger" | "output"
        nodes: RoutingColumnNode[]
    }

    // Fixed Inputs & Outputs (no longer persisted in settings store)
    const fixedInputs = [
        { id: "drawer_audio", name: "Audio Files (Drawer)", type: "drawer_audio" },
        { id: "mic_default", name: "Microphone", type: "mic" },
        { id: "metronome", name: "Metronome", type: "metronome" },
        { id: "desktop_default", name: "Desktop Audio", type: "desktop_audio" },
        { id: "output_window", name: "Output Windows", type: "output_window" }
    ]

    const fixedOutputs = [
        { id: "speaker_default", name: "Speaker Output", type: "speaker" },
        { id: "network_default", name: "Network Output", type: "network" },
        { id: "icecast", name: "Icecast Stream", type: "icecast" }
    ]

    let availableAudioInputs: { value: string; label: string }[] = []
    let availableAudioOutputs: { value: string; label: string; channels: number }[] = []

    let expandedNodes: Set<string> = new Set(["output_window", "network_default"])

    let nonStageOutputs: RoutingColumnNode[] = []
    $: nonStageOutputs = Object.entries($outputsStore || {})
        .filter(([_, out]) => out && !out.stageOutput)
        .map(([id, out]) => ({
            id: "output_win_sub_" + id,
            name: out.name || id,
            type: "output_window",
            isEnabled: (out as any).enabled
        }))

    let networkOutputWindows: RoutingColumnNode[] = []
    $: networkOutputWindows = Object.entries($outputsStore || {})
        .filter(([_, out]) => out && (out.rtmp || out.webrtc || out.ndi))
        .map(([id, out]) => {
            let label = out.name || id
            let types: string[] = []
            if (out.rtmp) types.push("RTMP")
            if (out.webrtc) types.push("WebRTC")
            if (out.ndi) types.push("NDI")
            return {
                id: "network_sub_" + id,
                name: `${label} (${types.join(", ")})`,
                type: "network",
                isEnabled: (out as any).enabled
            }
        })

    // Auto-expand if a child node has an active connection
    $: if (config.connections.some((conn) => conn.from.startsWith("mic_sub_"))) {
        expandedNodes.add("mic_default")
        expandedNodes = expandedNodes
    }
    $: if (config.connections.some((conn) => conn.to.startsWith("speaker_sub_"))) {
        expandedNodes.add("speaker_default")
        expandedNodes = expandedNodes
    }

    $: if (config || expandedNodes || nonStageOutputs || networkOutputWindows) {
        tick().then(updateConnectionLines)
    }

    async function refreshDevices() {
        availableAudioOutputs = await AudioPlayer.getOutputs()
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            const inputDevices = devices.filter((d) => d.kind === "audioinput" && d.deviceId !== "default")
            availableAudioInputs = inputDevices.map((d, index) => ({
                value: "mic_sub_" + d.deviceId,
                label: d.label || `Microphone ${index + 1}`
            }))
        } catch (e) {
            console.warn("Could not enumerate audio inputs:", e)
        }
        tick().then(updateConnectionLines)
    }

    function toggleExpand(id: string) {
        if (expandedNodes.has(id)) expandedNodes.delete(id)
        else expandedNodes.add(id)
        expandedNodes = expandedNodes
        tick().then(updateConnectionLines)
    }

    // Dynamic Column Definition
    let columns: RoutingColumn[] = []
    $: columns = [
        {
            title: "Inputs",
            type: "input",
            nodes: fixedInputs.map((node) => {
                const subNodes = node.id === "mic_default" ? availableAudioInputs.map((mic) => ({ id: mic.value, name: mic.label, type: "mic" })) : node.id === "output_window" ? nonStageOutputs : []
                return {
                    ...node,
                    isExpanded: expandedNodes.has(node.id) || node.id === "output_window",
                    hasSubNodes: subNodes.length > 0,
                    subNodes
                }
            })
        },
        {
            title: "Mergers",
            type: "merger",
            nodes: config.mergers.map((m) => ({ id: m.id, name: m.name, type: "merger" }))
        },
        {
            title: "Outputs",
            type: "output",
            nodes: fixedOutputs.map((node) => {
                const subNodes = node.id === "speaker_default" ? availableAudioOutputs.map((s) => ({ id: "speaker_sub_" + s.value, name: s.label, type: "speaker", channels: s.channels })) : node.id === "network_default" ? networkOutputWindows : []
                return {
                    ...node,
                    isExpanded: expandedNodes.has(node.id) || node.id === "network_default",
                    hasSubNodes: subNodes.length > 0,
                    subNodes
                }
            })
        }
    ]

    onMount(() => {
        AudioInputCapture.getInstance().captureDesktopAudio("desktop_default", "Desktop Audio")
        refreshDevices()

        // Listen for hardware changes
        navigator.mediaDevices.addEventListener("devicechange", refreshDevices)

        const resizeObs = new ResizeObserver(() => updateConnectionLines())
        if (spaceEl) resizeObs.observe(spaceEl)
        if (containerEl) containerEl.addEventListener("scroll", updateConnectionLines)

        return () => {
            navigator.mediaDevices.removeEventListener("devicechange", refreshDevices)
            resizeObs.disconnect()
            if (containerEl) containerEl.removeEventListener("scroll", updateConnectionLines)
        }
    })

    function updateConfig(fn: (c: AudioRoutingConfig) => void) {
        audioRouting.update((c) => {
            const copy = { ...c, mergers: [...(c?.mergers || [])], connections: [...(c?.connections || [])] }
            fn(copy)
            return copy
        })
        tick().then(updateConnectionLines)
    }

    function addMerger() {
        updateConfig((c) => {
            const newId = "merger_" + uid()
            const name = "Merger " + (c.mergers.length + 1)
            c.mergers.push({ id: newId, name })
        })
    }

    function removeMerger(id: string) {
        updateConfig((c) => {
            const index = c.mergers.findIndex((m) => m.id === id)
            if (index <= 0) return // First merger cannot be deleted
            c.mergers.splice(index, 1)
            c.connections = c.connections.filter((conn) => conn.from !== id && conn.to !== id)
        })
    }

    function renameMerger(id: string, newName: string) {
        updateConfig((c) => {
            const merger = c.mergers.find((m) => m.id === id)
            if (merger) merger.name = newName
        })
    }

    // --- Interactive Drag-to-Connect & Smooth Canvas Pan Logic ---
    let containerEl: HTMLDivElement
    let spaceEl: HTMLDivElement

    // Panning
    let isPanning = false
    let startPanMouse = { x: 0, y: 0 }
    let startScroll = { left: 0, top: 0 }

    // Connecting
    let isConnecting = false
    let dragStartId: string | null = null
    let dragStartType: "input" | "merger" | "output" | null = null
    let dragStartPortType: "in" | "out" | null = null
    let dragFromPos = { x: 0, y: 0 }
    let dragCurrentPos = { x: 0, y: 0 }
    let hoverTargetId: string | null = null
    let hoverTargetPortEl: HTMLElement | null = null

    interface RenderedLine {
        fromId: string
        toId: string
        channelIndex: number
        x1: number
        y1: number
        x2: number
        y2: number
    }
    let lines: RenderedLine[] = []

    function getNodePortPos(nodeId: string, portType: "in" | "out", portElement?: HTMLElement | null): { x: number; y: number } | null {
        if (!spaceEl) return null
        let portEl = portElement
        if (!portEl) {
            portEl = spaceEl.querySelector(`[data-node-id="${nodeId}"] .port-${portType}`) as HTMLElement
        }
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
            let portEl: HTMLElement | null = null
            const chIndex = (conn as any).channelIndex ?? 0
            if (conn.to.startsWith("speaker_sub_")) {
                portEl = spaceEl.querySelector(`[data-node-id="${conn.to}"] [data-ch-index="${chIndex}"]`) as HTMLElement
                if (!portEl) portEl = spaceEl.querySelector(`[data-node-id="${conn.to}"] .port-multi`) as HTMLElement
            }
            const toPos = getNodePortPos(conn.to, "in", portEl)
            if (fromPos && toPos) {
                newLines.push({
                    fromId: conn.from,
                    toId: conn.to,
                    channelIndex: chIndex,
                    x1: fromPos.x,
                    y1: fromPos.y,
                    x2: toPos.x,
                    y2: toPos.y
                })
            }
        }
        lines = newLines
    }

    // --- Port Mouse Down (Connecting) ---
    function handlePortMouseDown(e: MouseEvent, nodeId: string, nodeType: "input" | "merger" | "output", portType: "in" | "out", _channelIndex: number = 0) {
        e.preventDefault()
        e.stopPropagation()
        const portEl = e.currentTarget as HTMLElement
        const pos = getNodePortPos(nodeId, portType, portEl)
        if (!pos) return
        isConnecting = true
        dragStartId = nodeId
        dragStartType = nodeType
        dragStartPortType = portType
        dragFromPos = pos
        dragCurrentPos = { ...pos }

        window.addEventListener("mousemove", handleGlobalMouseMove)
        window.addEventListener("mouseup", handleGlobalMouseUp)
    }

    // --- Container Mouse Down (Smooth Drag-to-Scroll Pan) ---
    function handleContainerMouseDown(e: MouseEvent) {
        if (e.button !== 0 && e.button !== 1) return
        if ((e.target as HTMLElement).closest(".node-card, .port, button, input, .dropdown")) return

        e.preventDefault()
        isPanning = true
        startPanMouse = { x: e.clientX, y: e.clientY }
        if (containerEl) {
            startScroll = { left: containerEl.scrollLeft, top: containerEl.scrollTop }
        }

        window.addEventListener("mousemove", handleGlobalMouseMove)
        window.addEventListener("mouseup", handleGlobalMouseUp)
    }

    let animFrame: number | null = null

    function handleGlobalMouseMove(e: MouseEvent) {
        if (animFrame) cancelAnimationFrame(animFrame)

        animFrame = requestAnimationFrame(() => {
            if (isConnecting && spaceEl) {
                const spaceRect = spaceEl.getBoundingClientRect()
                dragCurrentPos = {
                    x: e.clientX - spaceRect.left,
                    y: e.clientY - spaceRect.top
                }
            } else if (isPanning && containerEl) {
                containerEl.scrollLeft = startScroll.left - (e.clientX - startPanMouse.x)
                containerEl.scrollTop = startScroll.top - (e.clientY - startPanMouse.y)
            }
        })
    }

    function handleGlobalMouseUp() {
        window.removeEventListener("mousemove", handleGlobalMouseMove)
        window.removeEventListener("mouseup", handleGlobalMouseUp)

        if (isConnecting && hoverTargetId && dragStartId && dragStartId !== hoverTargetId) {
            let fromId = dragStartId
            let toId = hoverTargetId

            const isInput = (id: string) => fixedInputs.some((i) => i.id === id) || id.startsWith("mic_sub_") || id.startsWith("output_win_sub_")
            const isMerger = (id: string) => config.mergers.some((m) => m.id === id)
            const isOutput = (id: string) => fixedOutputs.some((o) => o.id === id) || id.startsWith("speaker_sub_") || id.startsWith("network_sub_")

            let valid = false
            if ((isInput(fromId) && isMerger(toId)) || (isMerger(fromId) && isOutput(toId))) {
                valid = true
            } else if ((isOutput(fromId) && isMerger(toId)) || (isMerger(fromId) && isInput(toId))) {
                ;[fromId, toId] = [toId, fromId]
                valid = true
            }

            if (valid) {
                updateConfig((c) => {
                    const isSpeakerSub = toId.startsWith("speaker_sub_")
                    const deviceId = isSpeakerSub ? toId.replace("speaker_sub_", "") : ""
                    const speakerObj = availableAudioOutputs.find((s) => s.value === deviceId)
                    const chCount = speakerObj?.channels || 2

                    const chIndexStr = hoverTargetPortEl?.dataset?.chIndex
                    const isSpecificCircle = chIndexStr !== undefined

                    if (isSpeakerSub && chCount > 1 && !isSpecificCircle) {
                        // Dropped onto the node card itself -> connect all or disconnect all
                        const activeChannels = c.connections.filter((conn) => conn.from === fromId && conn.to === toId)
                        const allConnected = activeChannels.length >= chCount

                        if (allConnected) {
                            c.connections = c.connections.filter((conn) => !(conn.from === fromId && conn.to === toId))
                        } else {
                            const parentId = "speaker_default"
                            c.connections = c.connections.filter((conn) => !(conn.from === fromId && conn.to === parentId))
                            for (let ch = 0; ch < chCount; ch++) {
                                if (!c.connections.some((conn) => conn.from === fromId && conn.to === toId && ((conn as any).channelIndex ?? 0) === ch)) {
                                    c.connections.push({ from: fromId, to: toId, channelIndex: ch } as any)
                                }
                            }
                        }
                    } else {
                        // Dropped onto a specific channel circle or single node port
                        const targetChIndex = isSpecificCircle ? parseInt(chIndexStr) : 0
                        const existingIndex = c.connections.findIndex((conn) => {
                            if (conn.from !== fromId || conn.to !== toId) return false
                            if (isSpeakerSub) {
                                return ((conn as any).channelIndex ?? 0) === targetChIndex
                            }
                            return true
                        })

                        if (existingIndex !== -1) {
                            c.connections.splice(existingIndex, 1)
                        } else {
                            const isChildInput = fromId.startsWith("drawer_sub_") || fromId.startsWith("mic_sub_") || fromId.startsWith("output_win_sub_")
                            const isParentInput = fromId === "drawer_audio" || fromId === "mic_default"
                            const isChildOutput = toId.startsWith("speaker_sub_") || toId.startsWith("network_sub_")
                            const isParentOutput = toId === "speaker_default" || toId === "network_default"

                            if (isChildInput) {
                                let parentId = ""
                                if (fromId.startsWith("drawer_sub_")) parentId = "drawer_audio"
                                else if (fromId.startsWith("mic_sub_")) parentId = "mic_default"

                                if (parentId) c.connections = c.connections.filter((conn) => !(conn.from === parentId && conn.to === toId))
                            }
                            if (isParentInput) {
                                let prefix = ""
                                if (fromId === "drawer_audio") prefix = "drawer_sub_"
                                else if (fromId === "mic_default") prefix = "mic_sub_"

                                if (prefix) c.connections = c.connections.filter((conn) => !(conn.from.startsWith(prefix) && conn.to === toId))
                            }
                            if (isChildOutput) {
                                const parentId = toId.startsWith("speaker_sub_") ? "speaker_default" : "network_default"
                                c.connections = c.connections.filter((conn) => !(conn.from === fromId && conn.to === parentId))
                            }
                            if (isParentOutput) {
                                const prefix = toId === "speaker_default" ? "speaker_sub_" : "network_sub_"
                                c.connections = c.connections.filter((conn) => !(conn.from === fromId && conn.to.startsWith(prefix)))
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

    // --- Hover Helpers to avoid TS errors in template ---
    function handleNodeMouseEnter(nodeId: string, type: string, columnType: "input" | "merger" | "output") {
        if (!isConnecting) return

        let valid = false
        if (dragStartType === "input" && columnType === "merger") valid = true
        else if (dragStartType === "output" && columnType === "merger") valid = true
        else if (dragStartType === "merger") {
            if (dragStartPortType === "in" && columnType === "input") {
                // For inputs, we can only connect to sub-nodes or direct inputs (like metronome)
                if (type !== "output_window" && type !== "mic") valid = true
            } else if (dragStartPortType === "out" && columnType === "output") {
                // For outputs, we can connect to most things
                if (type !== "network") valid = true
            }
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

    function handlePortMouseEnter(e: MouseEvent, _chIdx?: number) {
        if (!isConnecting) return
        hoverTargetPortEl = e.currentTarget as HTMLElement
    }

    function handlePortMouseLeave() {
        hoverTargetPortEl = null
    }
</script>

<div class="audio-routing-wrapper">
    <!-- MAIN OVERFLOW CONTAINER & CHECKERED CANVAS -->
    <div class="routing-container checkered" bind:this={containerEl} on:mousedown={handleContainerMouseDown} class:is-panning={isPanning}>
        <div class="routing-space" bind:this={spaceEl}>
            <!-- SVG Connections Layer -->
            <svg class="connections-layer">
                <defs>
                    <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#4caf50" />
                        <stop offset="100%" stop-color="#2196f3" />
                    </linearGradient>
                </defs>

                {#each lines as line (line.fromId + "-" + line.toId + "-" + line.channelIndex)}
                    {@const dx = Math.max(20, Math.abs(line.x2 - line.x1) / 2)}
                    <path d="M {line.x1} {line.y1} C {line.x1 + dx} {line.y1}, {line.x2 - dx} {line.y2}, {line.x2} {line.y2}" class="connection-path" on:dblclick={() => removeConnection(line.fromId, line.toId)}>
                        <title>Double click or drag again to disconnect</title>
                    </path>
                {/each}

                {#if isConnecting}
                    {@const dx = Math.max(20, Math.abs(dragCurrentPos.x - dragFromPos.x) / 2)}
                    {@const sign = dragStartPortType === "out" ? 1 : -1}
                    <path d="M {dragFromPos.x} {dragFromPos.y} C {dragFromPos.x + dx * sign} {dragFromPos.y}, {dragCurrentPos.x - dx * sign} {dragCurrentPos.y}, {dragCurrentPos.x} {dragCurrentPos.y}" class="drag-path" />
                {/if}
            </svg>

            <!-- Nodes Grid Inside Moveable Space -->
            <div class="nodes-grid">
                {#each columns as column (column.title)}
                    <div class="space-column">
                        <div class="column-title">
                            <h3>{column.title}</h3>
                        </div>

                        <div class="nodes-list">
                            {#each column.nodes as node (node.id)}
                                <div class="node-card-group" class:has-subnodes={node.hasSubNodes}>
                                    <RoutingNode
                                        {...node}
                                        nodeType={column.type}
                                        {hoverTargetId}
                                        {isConnecting}
                                        {dragStartId}
                                        {dragStartType}
                                        {dragStartPortType}
                                        onToggleExpand={() => toggleExpand(node.id)}
                                        onMouseDown={(e, portType, chIdx) => handlePortMouseDown(e, node.id, column.type, portType, chIdx)}
                                        onMouseEnter={() => handleNodeMouseEnter(node.id, node.type, column.type)}
                                        onMouseLeave={() => handleNodeMouseLeave(node.id)}
                                        onMouseEnterPort={handlePortMouseEnter}
                                        onMouseLeavePort={handlePortMouseLeave}
                                        onRemove={() => removeMerger(node.id)}
                                        onRename={(newName) => renameMerger(node.id, newName)}
                                    />

                                    {#if node.isExpanded && node.subNodes}
                                        <div class="sub-nodes-list">
                                            {#if node.subNodes.length > 0}
                                                {#each node.subNodes as sub (sub.id)}
                                                    <RoutingNode
                                                        {...sub}
                                                        nodeType={column.type}
                                                        isSubNode={true}
                                                        {hoverTargetId}
                                                        {isConnecting}
                                                        {dragStartId}
                                                        {dragStartType}
                                                        {dragStartPortType}
                                                        onMouseDown={(e, portType, chIdx) => handlePortMouseDown(e, sub.id, column.type, portType, chIdx)}
                                                        onMouseEnter={() => handleNodeMouseEnter(sub.id, sub.type, column.type)}
                                                        onMouseLeave={() => handleNodeMouseLeave(sub.id)}
                                                        onMouseEnterPort={(e) => {
                                                            if (isConnecting) {
                                                                hoverTargetId = sub.id
                                                                handlePortMouseEnter(e)
                                                            }
                                                        }}
                                                        onMouseLeavePort={handlePortMouseLeave}
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

                            {#if column.type === "merger"}
                                <button class="add-merger-btn" title="Add merger" on:click={addMerger}>
                                    <Icon id="add" size={1.2} />
                                </button>
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
        stroke: url(#line-grad);
        stroke-width: 3px;
        fill: none;
        pointer-events: stroke;
        cursor: pointer;
        transition: stroke-width 0.15s ease;
    }

    .connection-path:hover {
        stroke-width: 5px;
        stroke: #ff9800;
    }

    .drag-path {
        stroke: #ff9800;
        stroke-width: 3px;
        stroke-dasharray: 6 4;
        fill: none;
    }

    .nodes-grid {
        position: relative;
        z-index: 2;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 40px;
        min-height: 100%;
        padding: 20px;
        box-sizing: border-box;
    }

    .space-column {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .column-title {
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
    }

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
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 8px;
        margin: -4px;
    }

    .sub-nodes-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-left: 12px;
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

    .add-merger-btn {
        background: rgba(255, 255, 255, 0.08);
        border: 1px dashed rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        color: var(--text);
        padding: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition:
            background 0.15s ease,
            border-color 0.15s ease;
        width: 100%;
    }

    .add-merger-btn:hover {
        background: rgba(255, 255, 255, 0.18);
        border-color: var(--secondary, #f0008c);
    }
</style>
