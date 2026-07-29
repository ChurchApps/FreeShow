<script lang="ts">
    import { onMount, tick } from "svelte"
    import { uid } from "uid"
    import type { AudioRoutingConfig } from "../../../../types/AudioRouting"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { audioRouting, outputs as outputsStore } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import AudioNodeVisualizer from "./AudioNodeVisualizer.svelte"

    let config: AudioRoutingConfig
    $: config = $audioRouting || { mergers: [], connections: [] }

    // Fixed Inputs & Outputs (no longer persisted in settings store)
    const fixedInputs = [
        { id: "drawer_audio", name: "Audio Files (Drawer)", type: "drawer_audio" },
        { id: "mic_default", name: "Microphone", type: "mic" },
        { id: "metronome", name: "Metronome", type: "metronome" },
        { id: "output_window", name: "Output Windows", type: "output_window" }
    ]

    const fixedOutputs = [
        { id: "speaker_default", name: "Speaker Output", type: "speaker" },
        { id: "network_default", name: "Network Output", type: "network" },
        { id: "icecast", name: "Icecast Stream", type: "icecast" }
    ]

    // Dynamic Lists
    let availableAudioInputs: { value: string; label: string }[] = []
    let availableAudioOutputs: { value: string; label: string; channels: number }[] = []

    let micInputsExpanded = false
    let speakerOutputsExpanded = false

    // Non-stage output windows for "Output Windows" input node
    $: nonStageOutputs = Object.entries($outputsStore || {})
        .filter(([_, out]) => out && !out.stageOutput)
        .map(([id, out]) => ({
            id: "output_win_sub_" + id,
            name: out.name || id
        }))

    // Active network output windows (sending to RTMP / WebRTC / NDI)
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
                name: `${label} (${types.join(", ")})`
            }
        })

    // Auto-expand if a child node has an active connection (and retain expanded state)
    $: if (config.connections.some((conn) => conn.from.startsWith("mic_sub_"))) {
        micInputsExpanded = true
    }
    $: if (config.connections.some((conn) => conn.to.startsWith("speaker_sub_"))) {
        speakerOutputsExpanded = true
    }

    $: isMicExpanded = micInputsExpanded
    $: isSpeakerExpanded = speakerOutputsExpanded
    $: isNetworkExpanded = true

    $: if (config || isMicExpanded || isSpeakerExpanded || nonStageOutputs || networkOutputWindows) {
        tick().then(updateConnectionLines)
    }

    onMount(async () => {
        availableAudioOutputs = await AudioPlayer.getOutputs()

        // Fetch microphone input devices
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            const inputDevices = devices.filter((d) => d.kind === "audioinput" && d.deviceId !== "default")
            availableAudioInputs = inputDevices.map((d, index) => {
                return {
                    value: "mic_sub_" + d.deviceId,
                    label: d.label || `Microphone ${index + 1}`
                }
            })
        } catch (e) {
            console.warn("Could not enumerate audio inputs:", e)
        }

        updateConnectionLines()
        const resizeObs = new ResizeObserver(() => updateConnectionLines())
        if (spaceEl) resizeObs.observe(spaceEl)
        if (containerEl) containerEl.addEventListener("scroll", updateConnectionLines)
        return () => {
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

    function toggleMicExpanded() {
        micInputsExpanded = !micInputsExpanded
        tick().then(updateConnectionLines)
    }

    function toggleSpeakerExpanded() {
        speakerOutputsExpanded = !speakerOutputsExpanded
        tick().then(updateConnectionLines)
    }

    function getIcon(type: string): string {
        const icons: Record<string, string> = {
            drawer_audio: "audio",
            mic: "mic",
            metronome: "timer",
            output_window: "display_settings",
            speaker: "volume",
            network: "connection",
            icecast: "cloud"
        }
        return icons[type] || "settings"
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
                                const parentId = fromId.startsWith("drawer_sub_") ? "drawer_audio" : "mic_default"
                                c.connections = c.connections.filter((conn) => !(conn.from === parentId && conn.to === toId))
                            }
                            if (isParentInput) {
                                const prefix = fromId === "drawer_audio" ? "drawer_sub_" : "mic_sub_"
                                c.connections = c.connections.filter((conn) => !(conn.from.startsWith(prefix) && conn.to === toId))
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
        hoverTargetId = null
        isPanning = false
    }

    function removeConnection(fromId: string, toId: string) {
        updateConfig((c) => {
            c.connections = c.connections.filter((conn) => !(conn.from === fromId && conn.to === toId))
        })
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
                    {@const dx = Math.abs(line.x2 - line.x1) / 2}
                    <path d="M {line.x1} {line.y1} C {line.x1 + dx} {line.y1}, {line.x2 - dx} {line.y2}, {line.x2} {line.y2}" class="connection-path" on:dblclick={() => removeConnection(line.fromId, line.toId)}>
                        <title>Double click or drag again to disconnect</title>
                    </path>
                {/each}

                {#if isConnecting}
                    {@const dx = Math.abs(dragCurrentPos.x - dragFromPos.x) / 2}
                    <path d="M {dragFromPos.x} {dragFromPos.y} C {dragFromPos.x + dx} {dragFromPos.y}, {dragCurrentPos.x - dx} {dragCurrentPos.y}, {dragCurrentPos.x} {dragCurrentPos.y}" class="drag-path" />
                {/if}
            </svg>

            <!-- Nodes Grid Inside Moveable Space -->
            <div class="nodes-grid">
                <!-- INPUTS COLUMN -->
                <div class="space-column">
                    <div class="column-title">
                        <h3>Inputs</h3>
                    </div>

                    <div class="nodes-list">
                        {#each fixedInputs as item (item.id)}
                            <div class="node-card-group">
                                <div
                                    class="node-card"
                                    class:hover-valid={hoverTargetId === item.id}
                                    data-node-id={item.id}
                                    on:mouseenter={() => {
                                        if (isConnecting && dragStartType === "merger" && item.type !== "output_window" && item.type !== "mic") hoverTargetId = item.id
                                    }}
                                    on:mouseleave={() => {
                                        if (hoverTargetId === item.id) hoverTargetId = null
                                    }}
                                >
                                    <div class="card-content">
                                        {#if item.type === "mic"}
                                            <button class="expand-btn" on:click={toggleMicExpanded}>
                                                <Icon id={isMicExpanded ? "chevron_down" : "chevron_right"} size={0.9} />
                                            </button>
                                        {/if}
                                        <Icon id={getIcon(item.type)} size={1.1} />
                                        <span class="card-name">{item.name}</span>
                                    </div>
                                    {#if item.type !== "output_window"}
                                        <AudioNodeVisualizer channelId={item.id} width={140} height={4} />
                                    {/if}
                                    {#if item.type !== "output_window"}
                                        <div class="port port-out" title="Drag to connect or disconnect Merger" on:mousedown={(e) => handlePortMouseDown(e, item.id, "input", "out")}></div>
                                    {/if}
                                </div>

                                {#if item.type === "mic" && isMicExpanded}
                                    <div class="sub-nodes-list">
                                        {#if availableAudioInputs.length > 0}
                                            {#each availableAudioInputs as mic (mic.value)}
                                                {@const subId = mic.value}
                                                <div
                                                    class="node-card sub-card"
                                                    class:hover-valid={hoverTargetId === subId}
                                                    data-node-id={subId}
                                                    on:mouseenter={() => {
                                                        if (isConnecting && dragStartType === "merger") hoverTargetId = subId
                                                    }}
                                                    on:mouseleave={() => {
                                                        if (hoverTargetId === subId) hoverTargetId = null
                                                    }}
                                                >
                                                    <div class="card-content">
                                                        <Icon id="mic" size={0.9} />
                                                        <span class="card-name sub-name">{mic.label}</span>
                                                    </div>
                                                    <AudioNodeVisualizer channelId={subId} width={120} height={3} />
                                                    <div class="port port-out" title="Drag to connect or disconnect Merger" on:mousedown={(e) => handlePortMouseDown(e, subId, "input", "out")}></div>
                                                </div>
                                            {/each}
                                        {:else}
                                            <div class="node-card sub-card disabled-hint">
                                                <span class="sub-name" style="opacity:0.6;">No mic devices found</span>
                                            </div>
                                        {/if}
                                    </div>
                                {:else if item.type === "output_window"}
                                    <div class="sub-nodes-list">
                                        {#if nonStageOutputs.length > 0}
                                            {#each nonStageOutputs as win (win.id)}
                                                <div
                                                    class="node-card sub-card"
                                                    class:hover-valid={hoverTargetId === win.id}
                                                    data-node-id={win.id}
                                                    on:mouseenter={() => {
                                                        if (isConnecting && dragStartType === "merger") hoverTargetId = win.id
                                                    }}
                                                    on:mouseleave={() => {
                                                        if (hoverTargetId === win.id) hoverTargetId = null
                                                    }}
                                                >
                                                    <div class="card-content">
                                                        <Icon id="display_settings" size={0.9} />
                                                        <span class="card-name sub-name">{win.name}</span>
                                                    </div>
                                                    <AudioNodeVisualizer channelId={win.id} width={120} height={3} />
                                                    <div class="port port-out" title="Drag to connect or disconnect Merger" on:mousedown={(e) => handlePortMouseDown(e, win.id, "input", "out")}></div>
                                                </div>
                                            {/each}
                                        {:else}
                                            <div class="node-card sub-card disabled-hint">
                                                <span class="sub-name" style="opacity:0.6;">No non-stage output windows found</span>
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>

                <!-- MERGERS COLUMN -->
                <div class="space-column">
                    <div class="column-title">
                        <h3>Mergers</h3>
                    </div>

                    <div class="nodes-list">
                        {#each config.mergers as merger, index (merger.id)}
                            <div
                                class="node-card merger-card"
                                class:hover-valid={hoverTargetId === merger.id}
                                data-node-id={merger.id}
                                on:mouseenter={() => {
                                    if (isConnecting && (dragStartType === "input" || dragStartType === "output")) hoverTargetId = merger.id
                                }}
                                on:mouseleave={() => {
                                    if (hoverTargetId === merger.id) hoverTargetId = null
                                }}
                            >
                                <div class="port port-in" title="Input connection port" on:mousedown={(e) => handlePortMouseDown(e, merger.id, "merger", "in")}></div>

                                <div class="card-content">
                                    <Icon id="options" size={1.1} />
                                    <MaterialTextInput label="Merger Name" value={merger.name} style="margin: 0; width: 100%;" on:change={(e) => renameMerger(merger.id, e.detail)} />
                                    {#if index > 0}
                                        <button class="delete-btn" title="Delete merger" on:click|stopPropagation={() => removeMerger(merger.id)}>
                                            <Icon id="delete" size={0.8} />
                                        </button>
                                    {/if}
                                </div>
                                <AudioNodeVisualizer channelId={merger.id} width={140} height={4} />

                                <div class="port port-out" title="Drag to connect or disconnect Output" on:mousedown={(e) => handlePortMouseDown(e, merger.id, "merger", "out")}></div>
                            </div>
                        {/each}

                        <button class="add-merger-btn" title="Add merger" on:click={addMerger}>
                            <Icon id="add" size={1.2} />
                        </button>
                    </div>
                </div>

                <!-- OUTPUTS COLUMN -->
                <div class="space-column">
                    <div class="column-title">
                        <h3>Outputs</h3>
                    </div>

                    <div class="nodes-list">
                        {#each fixedOutputs as item (item.id)}
                            <div class="node-card-group">
                                <div
                                    class="node-card"
                                    class:hover-valid={hoverTargetId === item.id}
                                    data-node-id={item.id}
                                    on:mouseenter={() => {
                                        if (isConnecting && dragStartType === "merger" && item.type !== "network") hoverTargetId = item.id
                                    }}
                                    on:mouseleave={() => {
                                        if (hoverTargetId === item.id) hoverTargetId = null
                                    }}
                                >
                                    {#if item.type !== "network"}
                                        <div class="port port-in" title="Input connection port" on:mousedown={(e) => handlePortMouseDown(e, item.id, "output", "in")}></div>
                                    {/if}

                                    <div class="card-content">
                                        {#if item.type === "speaker"}
                                            <button class="expand-btn" on:click={toggleSpeakerExpanded}>
                                                <Icon id={isSpeakerExpanded ? "chevron_down" : "chevron_right"} size={0.9} />
                                            </button>
                                        {/if}
                                        <Icon id={getIcon(item.type)} size={1.1} />
                                        <span class="card-name">{item.name}</span>
                                    </div>
                                    {#if item.type !== "network"}
                                        <AudioNodeVisualizer channelId={item.id} width={140} height={4} />
                                    {/if}
                                </div>

                                {#if item.type === "speaker" && isSpeakerExpanded}
                                    <div class="sub-nodes-list">
                                        {#if availableAudioOutputs.length > 0}
                                            {#each availableAudioOutputs as speaker (speaker.value)}
                                                {@const subId = "speaker_sub_" + speaker.value}
                                                {@const chCount = speaker.channels || 2}
                                                <div
                                                    class="node-card sub-card"
                                                    class:hover-valid={hoverTargetId === subId}
                                                    data-node-id={subId}
                                                    on:mouseenter={() => {
                                                        if (isConnecting && dragStartType === "merger") {
                                                            hoverTargetId = subId
                                                            hoverTargetPortEl = null
                                                        }
                                                    }}
                                                    on:mouseleave={() => {
                                                        if (hoverTargetId === subId) {
                                                            hoverTargetId = null
                                                            hoverTargetPortEl = null
                                                        }
                                                    }}
                                                >
                                                    <div class="ports-column-in">
                                                        {#each Array(chCount) as _, chIdx}
                                                            <div
                                                                class="port port-in port-multi"
                                                                data-ch-index={chIdx}
                                                                title="Channel {chIdx + 1}"
                                                                on:mouseenter={(e) => {
                                                                    if (isConnecting && dragStartType === "merger") {
                                                                        hoverTargetId = subId
                                                                        hoverTargetPortEl = e.currentTarget
                                                                    }
                                                                }}
                                                                on:mouseleave={() => {
                                                                    if (isConnecting) {
                                                                        hoverTargetPortEl = null
                                                                    }
                                                                }}
                                                                on:mousedown={(e) => handlePortMouseDown(e, subId, "output", "in", chIdx)}
                                                            ></div>
                                                        {/each}
                                                    </div>

                                                    <div class="card-content">
                                                        <Icon id="volume" size={0.9} />
                                                        <span class="card-name sub-name">{speaker.label}</span>
                                                    </div>
                                                    <AudioNodeVisualizer channelId={subId} width={120} height={3} />
                                                </div>
                                            {/each}
                                        {:else}
                                            <div class="node-card sub-card disabled-hint">
                                                <span class="sub-name" style="opacity:0.6;">No speaker devices found</span>
                                            </div>
                                        {/if}
                                    </div>
                                {:else if item.type === "network" && isNetworkExpanded}
                                    <div class="sub-nodes-list">
                                        {#if networkOutputWindows.length > 0}
                                            {#each networkOutputWindows as netWin (netWin.id)}
                                                <div
                                                    class="node-card sub-card"
                                                    class:hover-valid={hoverTargetId === netWin.id}
                                                    data-node-id={netWin.id}
                                                    on:mouseenter={() => {
                                                        if (isConnecting && dragStartType === "merger") hoverTargetId = netWin.id
                                                    }}
                                                    on:mouseleave={() => {
                                                        if (hoverTargetId === netWin.id) hoverTargetId = null
                                                    }}
                                                >
                                                    <div class="port port-in" title="Input connection port" on:mousedown={(e) => handlePortMouseDown(e, netWin.id, "output", "in")}></div>

                                                    <div class="card-content">
                                                        <Icon id="broadcast" size={0.9} />
                                                        <span class="card-name sub-name">{netWin.name}</span>
                                                    </div>
                                                    <AudioNodeVisualizer channelId={netWin.id} width={120} height={3} />
                                                </div>
                                            {/each}
                                        {:else}
                                            <div class="node-card sub-card disabled-hint">
                                                <span class="sub-name" style="opacity:0.6;">No active streaming/NDI output windows</span>
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
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
    }

    .node-card {
        position: relative;
        background: var(--primary-darker, rgba(30, 30, 40, 0.9));
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        padding: 10px 14px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
    }

    .sub-nodes-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-left: 20px;
    }

    .sub-card {
        background: rgba(20, 20, 30, 0.8);
        padding: 8px 12px;
    }

    .sub-name {
        font-size: 0.9em;
        opacity: 0.9;
    }

    .disabled-hint {
        padding: 6px 12px;
        border: 1px dashed rgba(255, 255, 255, 0.1);
    }

    .expand-btn {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 0 4px;
        display: flex;
        align-items: center;
    }

    .node-card:hover {
        border-color: rgba(255, 255, 255, 0.3);
    }

    .node-card.hover-valid {
        border-color: #ff9800;
        box-shadow: 0 0 12px rgba(255, 152, 0, 0.5);
    }

    .card-content {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
    }

    .card-name {
        font-weight: 500;
        flex: 1;
    }

    .delete-btn {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        padding: 2px;
        display: flex;
        align-items: center;
    }

    .delete-btn:hover {
        color: #f44336;
    }

    /* Port Connection Handles */
    .port {
        position: absolute;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--secondary, #f0008c);
        border: 2px solid #fff;
        box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
        top: 50%;
        transform: translateY(-50%);
        cursor: crosshair;
        transition:
            transform 0.15s ease,
            background-color 0.15s ease;
    }

    .port:hover {
        transform: translateY(-50%) scale(1.3);
        background: #ff9800;
    }

    .port-in {
        left: -8px;
    }

    .port-out {
        right: -8px;
    }

    .ports-column-in {
        position: absolute;
        left: -8px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        gap: 6px;
        z-index: 5;
    }

    .ports-column-in .port-multi {
        position: relative;
        top: 0;
        left: 0;
        transform: none;
    }

    .ports-column-in .port-multi:hover {
        transform: scale(1.3);
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
