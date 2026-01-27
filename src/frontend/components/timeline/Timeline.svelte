<script lang="ts">
    import { onDestroy, tick } from "svelte"
    import { fade } from "svelte/transition"
    import { uid } from "uid"
    import type { TimelineAction } from "../../../types/Show"
    import { AudioPlayer } from "../../audio/audioPlayer"
    import { createWaveform } from "../../audio/audioWaveform"
    import { activeShow, activeTriggerFunction, playingAudio, resized } from "../../stores"
    import { DEFAULT_WIDTH } from "../../utils/common"
    import { translateText } from "../../utils/language"
    import { actionData } from "../actions/actionData"
    import { clone } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import { ShowTimeline } from "./ShowTimeline"
    import { formatTime, getActionsAtPosition, getTickInterval, getTimelineSections, parseTime, showTimelineSections, TIMELINE_SECTION_GAP, TIMELINE_SECTION_HEIGHT, TIMELINE_SECTION_TOP, timelineZoom } from "./timeline"
    import { TimelineActions, type TimelineType } from "./TimelineActions"
    import { TimelinePlayback } from "./TimelinePlayback"

    export let type: TimelineType
    export let isClosed: boolean = false

    // SECTIONS

    const sections = clone(showTimelineSections)
    let tabIds = Object.keys(sections)

    const maxTrackIndex = tabIds.length
    $: totalTrackHeight = TIMELINE_SECTION_TOP + maxTrackIndex * (TIMELINE_SECTION_HEIGHT + TIMELINE_SECTION_GAP) - TIMELINE_SECTION_GAP + TIMELINE_SECTION_TOP

    function getTrackData(index: number, _updater: any) {
        return sections[tabIds[index]] || { name: "Unknown", icon: "unknown" }
    }
    function getActionTrack(action: TimelineAction): number {
        return tabIds.indexOf(action.type)
    }
    function getActionBaseY(action: TimelineAction): number {
        return TIMELINE_SECTION_TOP + getActionTrack(action) * (TIMELINE_SECTION_HEIGHT + TIMELINE_SECTION_GAP)
    }

    // TIMELINE

    let actions: TimelineAction[] = []

    const player = new TimelinePlayback(type)

    const timeline = new TimelineActions(type, (a) => {
        actions = a
        player.setActions(a)
        tabIds = getTimelineSections(sections, a)
    })
    timeline.onUpdate(() => {
        currentTime = 0
        resetView()
    })
    onDestroy(() => {
        player.stop()
        timeline.close()
    })

    let isPlaying = false
    player.onPlay(() => {
        isPlaying = true
        autoFollow = true

        // start recording if at beginning and no actions
        if (currentTime === 0 && !actions.length && !isRecording) toggleRecording()
    })
    player.onPause(() => {
        isPlaying = false

        // check if any audio is playing and pause it
        for (const action of actions) {
            if (action.type === "audio") {
                const a = action.data
                if (a && a.path && $playingAudio[a.path] && !$playingAudio[a.path].paused) {
                    AudioPlayer.pause(a.path)
                }
            }
        }
    })
    player.onStop(() => {
        isPlaying = false

        if (isRecording) toggleRecording()

        // check if any audio is playing and stop it
        for (const action of actions) {
            if (action.type === "audio") {
                const a = action.data
                if (a && a.path && $playingAudio[a.path]) {
                    AudioPlayer.stop(a.path)
                }
            }
        }
    })

    let duration = 60000 * 5
    player.onDuration((time) => (duration = time))

    let currentTime = 0
    let updateTimer = 0
    player.onTime((time) => {
        currentTime = time

        updateTimer++
        if (updateTimer > 10) {
            // only update part of the time
            checkAutoScroll()
            updateTimer = 0
        }
    })

    // State
    let trackWrapper: HTMLElement
    let rulerContainer: HTMLElement
    let headersContainer: HTMLElement
    let scrollLeft = 0
    let containerWidth = 0
    let autoFollow = true
    let isProgrammaticScroll = false

    let autoScrollFrameId: number
    let autoScrollTimeout: any
    let lastMouseX = 0
    let wasPlaying = false
    let isScrubbing = false
    let draggingActionId: string | null = null
    let dragTimeOffset = 0
    let dragInitialTimes = new Map<string, number>()

    let isSelecting = false
    let selectedActionIds: string[] = []
    let selectionStartIds: string[] = []
    let selectionRect: { x: number; y: number; w: number; h: number } | null = null
    let selectionStart = { x: 0, y: 0 }

    let usedHeaderWidth = 120

    $: timeString = formatTime(currentTime)
    $: tickInterval = getTickInterval(zoomLevel)
    $: snapInterval = (tickInterval * 1000) / 10

    $: totalTickCount = Math.ceil(duration / 1000 / tickInterval)
    $: visibleTicksStartIndex = Math.min(totalTickCount, Math.max(0, Math.floor(scrollLeft / (tickInterval * zoomLevel))))
    $: visibleTicksEndIndex = Math.min(totalTickCount, Math.ceil((scrollLeft + containerWidth) / (tickInterval * zoomLevel)))
    $: visibleTickCount = Math.max(0, visibleTicksEndIndex - visibleTicksStartIndex + 1)

    async function resetView() {
        zoomLevel = 10
        autoFollow = true
        await tick()
        centerPlayhead()
    }

    function centerPlayhead() {
        if (trackWrapper) {
            isProgrammaticScroll = true
            const playheadPixelPos = (currentTime / 1000) * zoomLevel
            const containerWidth = trackWrapper.clientWidth
            trackWrapper.scrollLeft = Math.max(0, playheadPixelPos - containerWidth / 2)
        }
    }

    let zoomLevel = 10 // pixels per second
    async function handleWheel(e: WheelEvent, zoom: boolean = false) {
        const shouldZoom = zoom || e.ctrlKey || e.metaKey
        if (shouldZoom) {
            const currentZoom = zoomLevel

            zoomLevel = await timelineZoom(e, zoomLevel)

            // Store mouse position relative to track start in time
            const rect = trackWrapper.getBoundingClientRect()
            const mouseX = e.clientX - rect.left
            const timeAtMouse = ((mouseX + trackWrapper.scrollLeft) / currentZoom) * 1000

            await tick()

            // Adjust scroll to keep time at mouse position
            const newPixelPos = (timeAtMouse / 1000) * zoomLevel
            isProgrammaticScroll = true
            trackWrapper.scrollLeft = newPixelPos - mouseX
            return
        }

        // if scrolling, disable auto-follow
        if (e.deltaY !== 0) autoFollow = false
        if (e.shiftKey && e.deltaY !== 0) {
            // Horizontal scroll with Shift+Wheel
            const speed = e.deltaY * (e.altKey ? 4 : 1)
            e.preventDefault()
            trackWrapper.scrollLeft += speed
        }
    }

    // RULER

    function startRulerScrub(e: MouseEvent) {
        if (e.button !== 0) return
        isScrubbing = true
        wasPlaying = isPlaying
        player.pause()

        lastMouseX = e.clientX
        updateScrub(e)
        autoScrollTimeout = setTimeout(autoScrollLoop, 300)
        window.addEventListener("mousemove", updateScrub)
        window.addEventListener("mouseup", endScrub)
    }

    function startContentInteraction(e: MouseEvent) {
        if (e.button !== 0) return

        // Store origin in content space (relative to track)
        const rect = trackWrapper.getBoundingClientRect()
        const offsetX = e.clientX - rect.left + trackWrapper.scrollLeft
        const offsetY = e.clientY - rect.top + trackWrapper.scrollTop

        isSelecting = true
        selectionStart = { x: offsetX, y: offsetY }
        selectionRect = { x: offsetX, y: offsetY, w: 0, h: 0 }

        // clear selection if not holding Ctrl/Shift
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            selectedActionIds = []
            selectionStartIds = []
        } else {
            selectionStartIds = [...selectedActionIds]
        }

        window.addEventListener("mousemove", updateSelection)
        window.addEventListener("mouseup", endSelection)
    }

    function updateSelection(e: MouseEvent) {
        if (!isSelecting || !trackWrapper) return

        const rect = trackWrapper.getBoundingClientRect()
        // Current mouse position in content space
        const currentOffsetX = e.clientX - rect.left + trackWrapper.scrollLeft
        const currentOffsetY = e.clientY - rect.top + trackWrapper.scrollTop

        const startX = selectionStart.x
        const startY = selectionStart.y // This was also calculated with clientY - rect.top

        const w = currentOffsetX - startX
        const h = currentOffsetY - startY

        // Normalize rect (top-left width-height)
        const visualX = w < 0 ? currentOffsetX : startX
        const visualY = h < 0 ? currentOffsetY : startY
        const visualW = Math.abs(w)
        const visualH = Math.abs(h)

        selectionRect = { x: visualX, y: visualY, w: visualW, h: visualH }

        const newSelectedIds = getActionsAtPosition(e, trackWrapper, actions, tabIds, zoomLevel, selectionRect)

        if (selectionStartIds.length > 0) {
            const combined = new Set([...selectionStartIds, ...newSelectedIds])
            selectedActionIds = Array.from(combined)
        } else {
            selectedActionIds = newSelectedIds
        }
    }

    function endSelection() {
        isSelecting = false
        selectionRect = null
        window.removeEventListener("mousemove", updateSelection)
        window.removeEventListener("mouseup", endSelection)
    }

    function updateScrub(e: MouseEvent) {
        if (!isScrubbing || !trackWrapper) return

        lastMouseX = e.clientX

        const rect = trackWrapper.getBoundingClientRect()
        const offsetX = e.clientX - rect.left + trackWrapper.scrollLeft
        const seekTime = (offsetX / zoomLevel) * 1000

        const snappedTime = isClosed ? Math.round(seekTime / 10) * 10 : Math.round(seekTime / snapInterval) * snapInterval
        const time = Math.max(0, Math.min(snappedTime, duration))
        player.setTime(time)
    }

    function checkAutoScroll() {
        // Auto-scroll to keep playhead in view
        if (!trackWrapper || !isPlaying || !autoFollow) return

        const playheadPixelPos = (currentTime / 1000) * zoomLevel
        const containerWidth = trackWrapper.clientWidth
        const scrollLeft = trackWrapper.scrollLeft
        let newScrollLeft = -1

        // If playhead moves past the right edge of the visible area
        if (playheadPixelPos > scrollLeft + containerWidth) {
            // Scroll to bring playhead to the beginning (with some padding)
            newScrollLeft = playheadPixelPos - containerWidth * 0.1
        }
        // Optional: If playhead is behind scroll (shouldn't happen in normal forward play but possible if seeked/looped)
        else if (playheadPixelPos < scrollLeft) {
            newScrollLeft = playheadPixelPos - containerWidth * 0.1
        }

        if (newScrollLeft !== -1) {
            isProgrammaticScroll = true
            trackWrapper.scrollLeft = newScrollLeft
            if (rulerContainer) rulerContainer.scrollLeft = newScrollLeft
        }
    }

    function autoScrollLoop() {
        if ((!isScrubbing && !draggingActionId) || !trackWrapper) return

        const rect = trackWrapper.getBoundingClientRect()
        const EDGE_THRESHOLD = 100
        const MAX_SCROLL_SPEED = 18

        const distLeft = lastMouseX - rect.left
        const distRight = rect.right - lastMouseX

        let scrollAmount = 0

        if (distLeft < EDGE_THRESHOLD) {
            const intensity = 1 - distLeft / EDGE_THRESHOLD
            scrollAmount = -MAX_SCROLL_SPEED * intensity
        } else if (distRight < EDGE_THRESHOLD) {
            const intensity = 1 - distRight / EDGE_THRESHOLD
            scrollAmount = MAX_SCROLL_SPEED * intensity
        }

        if (scrollAmount !== 0) {
            isProgrammaticScroll = true
            trackWrapper.scrollLeft += scrollAmount
            if (rulerContainer) rulerContainer.scrollLeft = trackWrapper.scrollLeft

            // Update time based on new scroll pos
            const offsetX = lastMouseX - rect.left + trackWrapper.scrollLeft
            const seekTime = (offsetX / zoomLevel) * 1000

            if (isScrubbing) {
                const snappedTime = Math.round(seekTime / 10) * 10
                // const snappedTime = Math.round(seekTime / snapInterval) * snapInterval // not smooth
                const time = Math.max(0, Math.min(snappedTime, duration))
                player.setTime(time)
            } else if (draggingActionId) {
                const newTime = seekTime - dragTimeOffset
                const snappedTime = Math.round(newTime / snapInterval) * snapInterval
                moveSelectedActions(snappedTime)
            }
        }

        autoScrollFrameId = requestAnimationFrame(autoScrollLoop)
    }

    function endScrub() {
        isScrubbing = false
        if (autoScrollTimeout) clearTimeout(autoScrollTimeout)
        if (autoScrollFrameId) cancelAnimationFrame(autoScrollFrameId)
        window.removeEventListener("mousemove", updateScrub)
        window.removeEventListener("mouseup", endScrub)

        if (wasPlaying) player.play()
    }

    function startActionDrag(e: MouseEvent, id: string) {
        // select on right-click
        if (e.button === 2) {
            const clickedActions = getActionsAtPosition(e, trackWrapper, actions, tabIds, zoomLevel)
            // skip if selection includes any clicked action
            if (clickedActions.some((a) => selectedActionIds.includes(a))) return
            // select all right clicked actions
            selectedActionIds = clickedActions
            return
        }

        if (e.button !== 0) return

        if (!selectedActionIds.includes(id)) {
            if (e.ctrlKey || e.shiftKey) selectedActionIds = [...selectedActionIds, id]
            else selectedActionIds = [id]
        }

        // DUPLICATE
        if (e.altKey) {
            const selectedIdIndex = selectedActionIds.indexOf(id)
            selectedActionIds = timeline.duplicateActions(selectedActionIds)
            id = selectedActionIds[selectedIdIndex]
        }

        draggingActionId = id

        dragInitialTimes.clear()
        selectedActionIds.forEach((selectedId) => {
            const act = actions.find((a) => a.id === selectedId)
            if (act) dragInitialTimes.set(selectedId, act.time)
        })

        const action = actions.find((a) => a.id === id)
        if (action && trackWrapper) {
            const rect = trackWrapper.getBoundingClientRect()
            const offsetX = e.clientX - rect.left + trackWrapper.scrollLeft
            const mouseTime = (offsetX / zoomLevel) * 1000
            dragTimeOffset = mouseTime - action.time
        } else {
            dragTimeOffset = 0
        }

        lastMouseX = e.clientX

        autoScrollTimeout = setTimeout(autoScrollLoop, 300)
        window.addEventListener("mousemove", updateActionDrag)
        window.addEventListener("mouseup", endActionDrag)
    }

    function moveSelectedActions(targetAnchorTime: number) {
        if (!draggingActionId) return

        const initialAnchorTime = dragInitialTimes.get(draggingActionId)
        if (initialAnchorTime === undefined) return

        let delta = targetAnchorTime - initialAnchorTime

        let minInitial = Infinity
        for (const t of dragInitialTimes.values()) {
            if (t < minInitial) minInitial = t
        }
        if (minInitial + delta < 0) delta = -minInitial

        timeline.updateTimes(dragInitialTimes, delta)
    }

    function updateActionDrag(e: MouseEvent) {
        if (!draggingActionId || !trackWrapper) return
        lastMouseX = e.clientX

        const rect = trackWrapper.getBoundingClientRect()
        const offsetX = e.clientX - rect.left + trackWrapper.scrollLeft
        const mouseTime = (offsetX / zoomLevel) * 1000

        const newTime = mouseTime - dragTimeOffset
        const snappedTime = Math.round(newTime / snapInterval) * snapInterval

        moveSelectedActions(snappedTime)
    }

    function endActionDrag() {
        draggingActionId = null
        if (autoScrollTimeout) clearTimeout(autoScrollTimeout)
        if (autoScrollFrameId) cancelAnimationFrame(autoScrollFrameId)
        window.removeEventListener("mousemove", updateActionDrag)
        window.removeEventListener("mouseup", endActionDrag)
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault()
    }

    async function handleDrop(e: DragEvent) {
        e.preventDefault()

        const rect = trackWrapper.getBoundingClientRect()
        const offsetX = e.clientX - rect.left + trackWrapper.scrollLeft
        const dropTime = (offsetX / zoomLevel) * 1000
        const resultTime = Math.max(0, Math.min(Math.round(dropTime / 10) * 10, duration))

        timeline.handleDrop(e, resultTime)
    }

    onDestroy(() => {
        if (autoScrollFrameId) cancelAnimationFrame(autoScrollFrameId)
        // Cleanup global listeners if component is destroyed while dragging
        if (typeof window !== "undefined") {
            window.removeEventListener("mousemove", updateScrub)
            window.removeEventListener("mouseup", endScrub)
            window.removeEventListener("mousemove", updateActionDrag)
            window.removeEventListener("mouseup", endActionDrag)
        }
    })

    // TIME INPUT

    function handleTimeChange(e: Event) {
        const input = (e.target as HTMLInputElement).value
        const ms = parseTime(input)
        let time = currentTime

        if (!isNaN(ms)) {
            time = Math.max(0, Math.min(ms, duration))
            player.setTime(time)
            centerPlayhead()
        }

        // Force update input value in case it was invalid or clamped
        const target = e.target as HTMLInputElement
        target.value = formatTime(time)
        target.blur()
    }

    function handleTimeKeydown(e: KeyboardEvent) {
        e.stopPropagation()
        if (e.key === "Enter") {
            ;(e.target as HTMLInputElement).blur()
        }
    }

    // SCROLL

    function handleScroll() {
        if (rulerContainer) rulerContainer.scrollLeft = trackWrapper.scrollLeft
        if (headersContainer) headersContainer.scrollTop = trackWrapper.scrollTop

        if (isProgrammaticScroll) {
            isProgrammaticScroll = false
            scrollLeft = trackWrapper.scrollLeft
            return
        }

        // user scrolled
        if (isPlaying) autoFollow = false
        scrollLeft = trackWrapper.scrollLeft
    }

    function keydown(e) {
        const target = e.target as HTMLElement
        if (["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable) return

        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault()
            return
        }

        if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault()
            deleteSelectedNodes()
            return
        }

        if (e.key !== " " || e.repeat) return

        e.preventDefault()
        if (isPlaying) player.pause()
        else player.play()
    }

    $: if ($activeTriggerFunction === "delete_selected_nodes") deleteSelectedNodes()
    function deleteSelectedNodes() {
        if (isClosed || !selectedActionIds.length) return

        timeline.deleteActions(selectedActionIds)
        selectedActionIds = []
    }

    // show timeline recording
    let isRecording = false
    $: if ($activeShow) isRecording = ShowTimeline.isRecordingActive()
    function toggleRecording() {
        isRecording = ShowTimeline.toggleRecording((sequence) => {
            const time = Number(currentTime.toFixed(2))
            // skip if already exists at this time (within 100ms)
            if (actions.find((a) => a.type === sequence.type && Math.abs(time - a.time) < 100 && JSON.stringify(a.data) === JSON.stringify(sequence.data))) return
            // WIP skip if previous action is the same as current (only "slide")

            timeline.addAction({
                id: uid(6),
                time,
                type: sequence.type,
                data: sequence.data,
                name: sequence.name
            })

            // start if changed when paused
            if (!isPlaying) player.play()
        })
    }

    // Waveform
    function useWaveform(node: HTMLElement, path: string) {
        const settings = { height: 2.2, samples: 256, type: "line" as const, fill: true, fillOpacity: 0.3 }
        if (path) createWaveform(node, path, settings)

        return {
            update(newPath: string) {
                if (newPath !== path) {
                    path = newPath
                    if (path) createWaveform(node, path, settings)
                }
            }
        }
    }

    $: if (isClosed !== undefined) resetView()
</script>

<svelte:window on:keydown={keydown} />

<div class="timeline">
    {#if isClosed}
        <div class="closed">
            <MaterialButton style="min-width: 40px;padding: 10px;" title={isPlaying ? "media.pause" : "media.play"} on:click={() => (isPlaying ? player.pause() : player.play())}>
                <Icon id={isPlaying ? "pause" : "play"} white={!isPlaying} />
            </MaterialButton>

            <MaterialButton style="min-width: 40px;padding: 10px;" disabled={currentTime === 0} title="media.stop" on:click={() => player.stop()}>
                <Icon id="stop" white={!isPlaying} />
            </MaterialButton>

            {#if !actions.length || isRecording}
                <MaterialButton style="min-width: 40px;padding: 10px;" title="actions.{isRecording ? 'stop_recording' : 'start_recording'}" on:click={toggleRecording} red={isRecording}>
                    <Icon id="record" white />
                </MaterialButton>
            {/if}

            <div class="time-display" style="display: flex;align-items: center;width: auto;">{timeString}</div>

            <div class="timeline-track-wrapper" bind:this={trackWrapper} on:mousedown={startRulerScrub} bind:clientWidth={containerWidth} on:scroll={handleScroll} on:wheel={handleWheel}>
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <div class="timeline-track" style="width: {(duration / 1000) * zoomLevel}px;">
                    <!-- Actions -->
                    {#each actions as action (action.id)}
                        {#if action.duration}
                            <div class="action-clip context #timeline_node" class:selected={selectedActionIds.includes(action.id)} style="left: {(action.time / 1000) * zoomLevel}px; width: {action.duration * zoomLevel}px; top: 50%;transform: translateY(-50%);height: 100%;opacity: 0.3;" data-title={action.name}>
                                <div class="action-clip-content">
                                    <div class="clip-label">{action.name}</div>
                                </div>
                            </div>
                        {:else}
                            <div class="action-marker {action.type} context #timeline_node" class:selected={selectedActionIds.includes(action.id)} style="left: {(action.time / 1000) * zoomLevel}px; top: 50%;transform: translate(-50%, -50%);" data-title={translateText(action.name)}>
                                <div class="action-head">
                                    {#if action.type === "action"}
                                        <Icon id={action.data.triggers?.length === 1 ? actionData[action.data.triggers[0]]?.icon : "actions"} size={0.9} white />
                                    {:else if typeof action.data?.index === "number"}
                                        {action.data.index + 1}
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    {/each}

                    <!-- Playhead (Line Only) -->
                    <div class="playhead" style="left: {(currentTime / 1000) * zoomLevel}px;">
                        <div class="playhead-line"></div>
                    </div>
                </div>
            </div>

            <MaterialButton style="min-width: 40px;padding: 10px;" title="main.open" on:click={() => resized.update((a) => ({ ...a, timeline: DEFAULT_WIDTH }))}>
                <Icon id="up" white />
            </MaterialButton>
        </div>
    {:else}
        <div class="timeline-grid">
            <!-- Top Left Corner -->
            <div class="corner" style="width: {usedHeaderWidth}px; border-bottom: 1px solid rgba(255,255,255,0.1); border-right: 1px solid rgba(255,255,255,0.1);">
                <input class="time-display" value={timeString} on:change={handleTimeChange} on:keydown={handleTimeKeydown} />
            </div>

            <!-- Ruler (Sticky Top) -->
            <div class="ruler-container" bind:this={rulerContainer} on:mousedown={startRulerScrub} on:wheel={(e) => handleWheel(e, true)}>
                <div class="ruler" style="width: {(duration / 1000) * zoomLevel}px">
                    {#each Array(visibleTickCount) as _, i}
                        {@const tickIndex = i + visibleTicksStartIndex}
                        {@const pos = tickIndex * tickInterval * zoomLevel}
                        <div class="tick" style="left: {pos}px">
                            <span class="tick-label">{formatTime(tickIndex * tickInterval * 1000)}</span>
                        </div>

                        <!-- Subticks -->
                        {#if tickIndex < totalTickCount}
                            {#each Array(10) as _, j}
                                <div class="tick minor" style="left: {pos + j * (tickInterval / 10) * zoomLevel}px;height: {j === 0 ? '20px' : j === 5 ? '10px' : '8px'}"></div>
                            {/each}
                        {/if}
                    {/each}

                    <!-- Playhead Knob -->
                    <div class="playhead-knob" style="left: {(currentTime / 1000) * zoomLevel}px;"></div>
                </div>
            </div>

            <!-- Track Headers (Sticky Left) -->
            <div class="headers-container" bind:this={headersContainer} style="width: {usedHeaderWidth}px; min-width: {usedHeaderWidth}px;">
                <div class="track-headers" style="height: {totalTrackHeight}px;">
                    {#each Array(maxTrackIndex) as _, i}
                        {@const track = getTrackData(i, actions)}
                        <div class="track-header" style="top: {TIMELINE_SECTION_TOP + i * (TIMELINE_SECTION_HEIGHT + TIMELINE_SECTION_GAP)}px;width: 100%;{track.hasData ? '' : 'opacity: 0.3;'}">
                            <Icon id={track.icon} white />
                            <span class="track-name">{translateText(track.name)}</span>
                        </div>
                    {/each}
                </div>
            </div>

            <!-- Main Content (Scroll Master) -->
            <div class="timeline-track-wrapper" bind:this={trackWrapper} bind:clientWidth={containerWidth} on:scroll={handleScroll} on:wheel={handleWheel} on:dragover={handleDragOver} on:drop={handleDrop}>
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <div class="timeline-track" style="width: {(duration / 1000) * zoomLevel}px; height: {totalTrackHeight}px;" on:mousedown={startContentInteraction}>
                    <!-- Grid Lines -->
                    <div class="grid">
                        {#each Array(visibleTickCount) as _, i}
                            {@const tickIndex = i + visibleTicksStartIndex}
                            {@const pos = tickIndex * tickInterval * zoomLevel}
                            <div class="grid-line" style="left: {pos}px"></div>
                            <!-- Subticks -->
                            {#if tickIndex < totalTickCount}
                                {#each Array(10) as _, j}
                                    <div class="grid-line minor" style="left: {pos + j * (tickInterval / 10) * zoomLevel}px;"></div>
                                {/each}
                            {/if}
                        {/each}
                    </div>

                    <!-- Actions -->
                    {#each actions as action (action.id)}
                        {@const baseY = getActionBaseY(action)}
                        {#if action.duration}
                            <div class="action-clip context #timeline_node" class:selected={selectedActionIds.includes(action.id)} style="left: {(action.time / 1000) * zoomLevel}px; width: {action.duration * zoomLevel}px; top: {baseY}px;height: {TIMELINE_SECTION_HEIGHT + 4}px;" data-title="{formatTime(action.time)}-{formatTime(action.duration * 1000)}: {action.name}" on:mousedown|stopPropagation={(e) => startActionDrag(e, action.id)}>
                                <div class="action-clip-content">
                                    {#if action.type === "audio"}
                                        <div class="waveform-container" use:useWaveform={action.data.path || ""}></div>
                                    {/if}
                                    <div class="clip-label">{action.name}</div>
                                </div>
                            </div>
                        {:else}
                            <div class="action-marker {action.type} context #timeline_node" class:selected={selectedActionIds.includes(action.id)} style="left: {(action.time / 1000) * zoomLevel}px; top: {baseY + 10}px;" data-title="{formatTime(action.time)}: {action.name}" on:mousedown|stopPropagation={(e) => startActionDrag(e, action.id)}>
                                <div class="action-head">
                                    {#if action.type === "action"}
                                        <Icon id={action.data.triggers?.length === 1 ? actionData[action.data.triggers[0]]?.icon : "actions"} size={0.9} white />
                                    {:else if typeof action.data?.index === "number"}
                                        {action.data.index + 1}
                                    {/if}
                                </div>
                                <div class="action-label">{translateText(action.name)}</div>
                            </div>
                        {/if}
                    {/each}

                    <!-- Selection Box -->
                    {#if selectionRect}
                        <div class="selection-box" style="left: {selectionRect.x}px; top: {selectionRect.y}px; width: {selectionRect.w}px; height: {selectionRect.h}px;" out:fade={{ duration: 80 }}></div>
                    {/if}

                    <!-- Playhead (Line Only) -->
                    <div class="playhead" style="left: {(currentTime / 1000) * zoomLevel}px;">
                        <div class="playhead-line"></div>
                    </div>
                </div>
            </div>
        </div>

        <FloatingInputs side="left" style="margin-bottom: 8px;margin-left: 120px;">
            <MaterialButton title={isPlaying ? "media.pause" : "media.play"} on:click={() => (isPlaying ? player.pause() : player.play())}>
                <Icon size={1.3} id={isPlaying ? "pause" : "play"} white={!isPlaying} />
            </MaterialButton>

            <MaterialButton disabled={currentTime === 0} title="media.stop" on:click={() => player.stop()}>
                <Icon size={1.3} id="stop" white={!isPlaying} />
            </MaterialButton>

            <MaterialButton disabled={isPlaying && !isRecording} title="actions.{isRecording ? 'stop_recording' : 'start_recording'}" on:click={toggleRecording} red={isRecording}>
                <Icon size={1.3} id="record" white />
            </MaterialButton>

            <div class="divider" />

            <MaterialButton icon="focus" title="actions.resetZoom" on:click={resetView} />
        </FloatingInputs>

        <!-- <FloatingInputs style="margin-bottom: 8px;">
        <MaterialButton title="edit.options" on:click={() => (optionsVisible = !optionsVisible)}>
            <Icon id="options" white={!optionsVisible} />
        </MaterialButton>
    </FloatingInputs> -->
    {/if}
</div>

<style>
    .timeline {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .time-display {
        width: 100%;
        min-width: 120px;
        padding: 5px 8px;

        border: none;
        outline: none;
        background: inherit;

        font-family: monospace;
        font-size: 1.25em;
        font-weight: bold;
        color: var(--text);
        text-align: center;
    }
    .time-display:focus {
        border-color: var(--focus);
    }

    .timeline-grid {
        display: grid;
        grid-template-columns: var(--header-width, 120px) 1fr;
        grid-template-rows: 30px 1fr;
        height: 100%;
        overflow: hidden;
        background-color: var(--primary-darker);
    }
    .ruler-container {
        grid-column: 2;
        grid-row: 1;
        overflow: hidden;
        position: relative;
        background-color: var(--primary-darker);
        box-shadow: 0 2px 3px rgba(0, 0, 0, 0.4);
        z-index: 15;
    }
    .headers-container {
        grid-column: 1;
        grid-row: 2;
        overflow: hidden;
        position: relative;
        background: var(--primary-darker);
        border-right: 1px solid rgba(255, 255, 255, 0.1);
        z-index: 10;
    }
    .timeline-track-wrapper {
        grid-column: 2;
        grid-row: 2;
        overflow: auto; /* Scrollbars appear here */
        position: relative;
        background-color: var(--primary-darker);
        /* padding-left: 30px; */ /* Removed */
    }

    .timeline-track {
        position: relative;
        height: 100%;
        min-height: 150px;
        /* cursor: pointer; */
    }

    .grid {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }

    .grid-line {
        position: absolute;
        top: 0;
        bottom: 0;
        border-left: 1px solid rgba(255, 255, 255, 0.03);
    }

    .grid-line.minor {
        border-left: 1px solid rgba(255, 255, 255, 0.01);
    }

    .ruler {
        position: absolute;
        top: 0;
        height: 30px;
    }

    .tick {
        position: absolute;
        top: 0;
        height: 100%;
        /* border-left: 1px solid rgba(255, 255, 255, 0.3); */
        pointer-events: none;
    }

    .tick.minor {
        bottom: auto;
        border-left: 1px solid rgba(255, 255, 255, 0.2);
    }

    .tick-label {
        font-size: 0.7em;
        padding-left: 2px;
        color: var(--text);
        opacity: 0.5;
        position: absolute;
        top: 10px;
    }

    .track-headers {
        position: absolute; /* Changed from sticky */
        top: 0;
        left: 0;
        width: 100%;
        /* height: 100%; */
        pointer-events: none;
    }

    .track-header {
        position: absolute;
        left: 0;
        /* width: 120px; */
        height: 60px;
        display: flex;
        align-items: center;
        padding-left: 10px;
        /* background: rgba(0, 0, 0, 0.6); */
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        pointer-events: auto; /* Allow interaction if needed */

        display: flex;
        align-items: center;
        gap: 6px;
    }

    .playhead {
        position: absolute;
        top: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 110;
    }

    .playhead-line {
        position: absolute;
        width: 2px;
        background-color: var(--secondary);
        box-shadow: 0 0 2px rgb(0 0 0 / 0.6);
        top: 0;
        bottom: 0;
        left: -1px;
    }

    .playhead-knob {
        position: absolute;
        top: 0;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 7px solid transparent;
        border-right: 7px solid transparent;
        border-top: 10px solid var(--secondary);
        z-index: 111;
        cursor: ew-resize; /* Indicate grab */
    }

    .action-marker {
        position: absolute;
        top: 40px;
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translateX(-50%);
        z-index: 5;
        pointer-events: none;
    }

    .action-marker > * {
        pointer-events: auto;
    }

    .action-head {
        width: 18px;
        height: 18px;
        background-color: var(--secondary-opacity);
        border-radius: 50%;
        border: 2px solid var(--secondary);
        box-shadow: 0 0 4px rgb(0 0 0 / 0.6);

        display: flex;
        align-items: center;
        justify-content: center;

        /* cursor: e-resize; */
        font-size: 0.7em;
        font-weight: bold;
    }
    .action-marker.slide .action-head {
        border-radius: 4px;
    }

    .action-clip {
        position: absolute;
        top: 35px;
        height: 60px;
        background-color: var(--secondary-opacity);
        color: var(--secondary-text);
        border: 2px solid var(--secondary);
        border-radius: 4px;
        box-shadow: 0 0 4px rgb(0 0 0 / 0.4);

        z-index: 4;
        /* cursor: move; */
        /* cursor: e-resize; */
        overflow: hidden;
        box-sizing: border-box;
    }

    .action-clip-content {
        display: flex;
        align-items: flex-start;
        width: 100%;
        height: 100%;
        padding: 0 5px;
        position: relative;
    }

    .clip-label {
        background: none;
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        padding: 4px 6px;
        z-index: 1;
        position: relative;
        font-size: 0.8em;
    }

    .waveform-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        /* align-items: center; */
        align-items: flex-end; /* at bottom */
        opacity: 0.3;
        pointer-events: none;
        color: var(--secondary-text);
    }
    .waveform-container :global(.wave-bar) {
        background-color: var(--secondary-text);
    }

    .action-clip.selected {
        border: 2px solid var(--text);
    }

    .action-marker.selected .action-head {
        border-color: var(--text);
    }

    .selection-box {
        position: absolute;
        background-color: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.4);
        pointer-events: none;
        z-index: 100;
    }

    .action-label {
        margin-top: 4px;
        font-size: 0.8em;
        background: rgba(0, 0, 0, 0.5);
        padding: 2px 4px;
        border-radius: 3px;
        white-space: nowrap;
    }

    /* CLOSED */

    .closed {
        display: flex;
    }

    .closed .timeline-track-wrapper {
        overflow: hidden;
        background-color: var(--primary-darkest);
    }
    .closed .timeline-track {
        min-height: 0;
        height: 100%;
    }

    .closed .action-clip {
        cursor: default;
    }
    .closed .action-clip-content {
        align-items: center;
    }
</style>
