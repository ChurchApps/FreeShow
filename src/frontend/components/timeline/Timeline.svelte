<script lang="ts">
    import { onDestroy, tick } from "svelte"
    import { uid } from "uid"
    import { AudioPlayer } from "../../audio/audioPlayer"
    import { activeShow, localTimelineActive, playingAudio, selected } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import { getExtension, getMediaType } from "../helpers/media"
    import T from "../helpers/T.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialCheckbox from "../inputs/MaterialCheckbox.svelte"
    import MaterialNumberInput from "../inputs/MaterialNumberInput.svelte"
    import { ShowTimeline } from "./ShowTimeline"

    // Data types
    interface TimelineAction {
        id: string
        time: number // in milliseconds
        type: string
        data: any
        name: string
        description?: string
        duration?: number
    }

    // State
    let actions: TimelineAction[] = []
    let currentTime = 0
    let minDuration = 60000 * 5 // 5 minutes default
    let isPlaying = false
    let zoomLevel = 50 // pixels per second

    let animationFrameId: number
    let autoScrollFrameId: number
    let autoScrollTimeout: any
    let lastTime: number
    let isScrubbing = false
    let draggingActionId: string | null = null
    let dragTimeOffset = 0
    let wasPlaying = false
    let lastMouseX = 0
    let trackWrapper: HTMLElement
    let rulerContainer: HTMLElement
    let headersContainer: HTMLElement
    let scrollLeft = 0
    let containerWidth = 0
    let autoFollow = true
    let isProgrammaticScroll = false

    let selectedActionIds: string[] = []
    let selectionStartIds: string[] = []
    let isSelecting = false
    let selectionRect: { x: number; y: number; w: number; h: number } | null = null
    let selectionStart = { x: 0, y: 0 }

    let useFixedDuration = false
    let fixedDurationSeconds = 300

    let usedHeaderWidth = 100
    // Computed
    $: timeString = formatTime(currentTime)
    $: lastActionTime = actions.length > 0 ? Math.max(...actions.map((a) => a.time)) : 0
    $: duration = useFixedDuration ? fixedDurationSeconds * 1000 : Math.max(minDuration, lastActionTime + 60 * 1000) // 60s buffer
    $: tickInterval = getTickInterval(zoomLevel)
    $: totalTickCount = Math.ceil(duration / 1000 / tickInterval)
    $: visibleTicksStartIndex = Math.min(totalTickCount, Math.max(0, Math.floor(scrollLeft / (tickInterval * zoomLevel))))
    $: visibleTicksEndIndex = Math.min(totalTickCount, Math.ceil((scrollLeft + containerWidth) / (tickInterval * zoomLevel)))
    $: visibleTickCount = Math.max(0, visibleTicksEndIndex - visibleTicksStartIndex + 1)

    $: maxTrackIndex = actions.reduce((max, action) => Math.max(max, getActionTrack(action)), 2)
    $: totalTrackHeight = 35 + (maxTrackIndex + 1) * 70 + 50

    function getTrackName(index: number) {
        switch (index) {
            case 0:
                return "Slide"
            case 1:
                return "Action"
            case 2:
                return "Audio"
            default:
                return `Track ${index + 1}`
        }
    }

    function getTickInterval(zoom: number) {
        const minSpacing = 80 // minimum pixels between ticks
        const target = minSpacing / zoom
        const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60]
        return steps.find((s) => s >= target) || 60
    }

    function formatTime(ms: number): string {
        const offsetMs = ms // + 3600000 // Start at 01:00:00;00
        const totalSeconds = Math.floor(offsetMs / 1000)
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60
        // Use centiseconds (0-99) to look like frames/decimal
        const centiseconds = Math.floor((offsetMs % 1000) / 10)

        const h = hours.toString().padStart(2, "0")
        const m = minutes.toString().padStart(2, "0")
        const s = seconds.toString().padStart(2, "0")
        const cs = centiseconds.toString().padStart(2, "0")

        return `${h}:${m}:${s};${cs}`
    }

    function play() {
        if (isPlaying) return
        isPlaying = true
        autoFollow = true
        lastTime = performance.now()

        if (animationFrameId) cancelAnimationFrame(animationFrameId)
        animationFrameId = requestAnimationFrame(loop)

        // start recording if at beginning and no actions
        if (currentTime === 0 && !actions.length && !isRecording) toggle()
    }

    function pause() {
        isPlaying = false
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId)
            animationFrameId = 0
        }

        // check if any audio is playing and pause it
        for (const action of actions) {
            if (action.type === "audio") {
                const a = action.data
                if (a && a.path && $playingAudio[a.path] && !$playingAudio[a.path].paused) {
                    AudioPlayer.pause(a.path)
                }
            }
        }
    }

    function stop() {
        pause()
        currentTime = 0
        if (isRecording) toggle()

        // check if any audio is playing and stop it
        for (const action of actions) {
            if (action.type === "audio") {
                const a = action.data
                if (a && a.path && $playingAudio[a.path]) {
                    AudioPlayer.stop(a.path)
                }
            }
        }
    }

    function loop() {
        if (!isPlaying) return
        const now = performance.now()
        const delta = now - lastTime
        lastTime = now

        const previousTime = currentTime
        currentTime += delta

        // Check for triggers
        for (const action of actions) {
            if (action.time >= previousTime && action.time < currentTime) {
                ShowTimeline.playAction(action)
            }
        }

        // Check for end
        if (currentTime >= duration) {
            currentTime = duration
            pause()
        }

        // Check if there's an audio file that's supposed to be playing at this time
        for (const action of actions) {
            if (action.type === "audio") {
                const a = action.data
                if (a && a.path) {
                    const audioStart = action.time
                    const audioEnd = action.time + (action.duration || 0) * 1000
                    if (currentTime >= audioStart && currentTime < audioEnd) {
                        // Should be playing
                        if (!$playingAudio[a.path]) {
                            AudioPlayer.start(a.path, { name: a.name }, { pauseIfPlaying: false, playMultiple: true })
                        } else if ($playingAudio[a.path].paused) {
                            AudioPlayer.play(a.path)
                        }

                        // Seek to correct position (with tolerance)
                        const tolerance = 20 // ms
                        if ($playingAudio[a.path]) {
                            const seekPos = (currentTime - audioStart) / 1000
                            const currentAudioTime = $playingAudio[a.path].audio?.currentTime || 0
                            const diff = Math.abs(currentAudioTime - seekPos) * 1000
                            if (diff > tolerance) {
                                AudioPlayer.setTime(a.path, seekPos)
                            }
                        }
                    } else {
                        // Should be stopped
                        if ($playingAudio[a.path]) {
                            AudioPlayer.stop(a.path)
                        }
                    }
                }
            }
        }

        // Auto-scroll to keep playhead in view
        if (trackWrapper && autoFollow) {
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

        animationFrameId = requestAnimationFrame(loop)
    }

    function addAction() {
        const newAction: TimelineAction = {
            id: crypto.randomUUID(),
            time: currentTime,
            type: "action",
            data: "",
            name: `Action ${actions.length + 1}`
        }
        actions = [...actions, newAction]
    }

    function removeAction(id: string) {
        actions = actions.filter((a) => a.id !== id)
    }
    async function resetView() {
        zoomLevel = 50
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
    const MIN_ZOOM = 5
    const MAX_ZOOM = 1000
    async function handleWheel(e: WheelEvent) {
        // If not zooming (just regular scrolling) Disable auto-follow
        if (!e.ctrlKey && e.deltaY !== 0) {
            autoFollow = false
        }
        if (e.ctrlKey) {
            e.preventDefault()
            const ZOOM_SPEED = 0.1
            // Store mouse position relative to track start in time
            const rect = trackWrapper.getBoundingClientRect()
            const mouseX = e.clientX - rect.left
            const scrollLeft = trackWrapper.scrollLeft

            // Time at mouse position
            const mouseTime = ((mouseX + scrollLeft) / zoomLevel) * 1000

            // Apply zoom
            const newZoom = zoomLevel - Math.sign(e.deltaY) * zoomLevel * ZOOM_SPEED
            zoomLevel = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM))

            await tick()

            // Adjust scroll to keep time at mouse position
            const newPixelPos = (mouseTime / 1000) * zoomLevel
            isProgrammaticScroll = true
            trackWrapper.scrollLeft = newPixelPos - mouseX
        } else if (e.shiftKey && e.deltaY !== 0) {
            // Horizontal scroll with Shift+Wheel
            e.preventDefault()
            trackWrapper.scrollLeft += e.deltaY
        }
    }

    async function handleZoomSlider(e: Event) {
        const input = e.target as HTMLInputElement
        const newZoom = parseInt(input.value)

        // Calculate playhead position relative to view
        const playheadPixelPos = (currentTime / 1000) * zoomLevel
        const scrollLeft = trackWrapper.scrollLeft

        // Distance of playhead from left edge of view (screen offset)
        // If playhead is off screen, this might be negative or > width.
        // We probably still want to keep it at that relative position?
        // OR better: ensure playhead stays centered if it was centered?
        // Let's stick to: maintain screen offset of playhead.
        const screenOffset = playheadPixelPos - scrollLeft

        zoomLevel = newZoom

        await tick()

        // New pixel position of playhead
        const newPlayheadPixelPos = (currentTime / 1000) * zoomLevel

        // Restore screen offset
        isProgrammaticScroll = true
        trackWrapper.scrollLeft = newPlayheadPixelPos - screenOffset
    }

    function getActionTrack(action: TimelineAction): number {
        switch (action.type) {
            case "slide":
                return 0
            case "action":
                return 1
            case "audio":
                return 2
            default:
                return 3
        }
    }

    function getActionBaseY(action: TimelineAction): number {
        return 35 + getActionTrack(action) * 70
    }

    function startRulerScrub(e: MouseEvent) {
        if (e.button !== 0) return
        isScrubbing = true
        wasPlaying = isPlaying
        pause()

        lastMouseX = e.clientX
        updateScrub(e)
        autoScrollTimeout = setTimeout(autoScrollLoop, 300)
        window.addEventListener("mousemove", updateScrub)
        window.addEventListener("mouseup", endScrub)
    }

    function startContentInteraction(e: MouseEvent) {
        if (e.button !== 0) return

        const rect = trackWrapper.getBoundingClientRect()
        // Start Selection
        isSelecting = true
        // Store origin in content space (relative to track)
        const offsetX = e.clientX - rect.left + trackWrapper.scrollLeft
        const offsetY = e.clientY - rect.top + trackWrapper.scrollTop
        selectionStart = { x: offsetX, y: offsetY }
        selectionRect = { x: offsetX, y: offsetY, w: 0, h: 0 }

        // Clear selection if not holding Shift/Ctrl
        if (!e.shiftKey && !e.ctrlKey) {
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

        const newSelectedIds: string[] = []

        actions.forEach((action) => {
            let ax = (action.time / 1000) * zoomLevel
            let baseY = getActionBaseY(action)
            let ay = baseY
            let aw = 0
            let ah = 60 // default clip H

            if (action.duration) {
                aw = action.duration * zoomLevel
            } else {
                ay = baseY + 5
                ax -= 7 // centered
                aw = 14
                ah = 14
            }

            // Intersection check:
            // Two rectangles R1 and R2 intersect if:
            // R1.x < R2.x + R2.w &&
            // R1.x + R1.w > R2.x &&
            // R1.y < R2.y + R2.h &&
            // R1.y + R1.h > R2.y

            if (visualX < ax + aw && visualX + visualW > ax && visualY < ay + ah && visualY + visualH > ay) {
                newSelectedIds.push(action.id)
            }
        })

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
        // Snap to nearest 10ms (1/100th second)
        const snappedTime = Math.round(seekTime / 10) * 10
        currentTime = Math.max(0, Math.min(snappedTime, duration))
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
            const intensity = 1 - Math.max(0, distLeft) / EDGE_THRESHOLD
            scrollAmount = -MAX_SCROLL_SPEED * intensity
        } else if (distRight < EDGE_THRESHOLD) {
            const intensity = 1 - Math.max(0, distRight) / EDGE_THRESHOLD
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
                currentTime = Math.max(0, Math.min(snappedTime, duration))
            } else if (draggingActionId) {
                const newTime = seekTime - dragTimeOffset
                const snappedTime = Math.round(newTime / 10) * 10
                const clampedTime = Math.max(0, Math.min(snappedTime, duration))

                const index = actions.findIndex((a) => a.id === draggingActionId)
                if (index !== -1) {
                    actions[index].time = clampedTime
                    actions = actions
                }
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

        if (wasPlaying) play()
    }

    function startActionDrag(e: MouseEvent, id: string) {
        if (e.button !== 0) return

        draggingActionId = id

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

    function updateActionDrag(e: MouseEvent) {
        if (!draggingActionId || !trackWrapper) return
        lastMouseX = e.clientX

        const rect = trackWrapper.getBoundingClientRect()
        const offsetX = e.clientX - rect.left + trackWrapper.scrollLeft
        const mouseTime = (offsetX / zoomLevel) * 1000

        const newTime = mouseTime - dragTimeOffset
        const snappedTime = Math.round(newTime / 10) * 10
        const clampedTime = Math.max(0, Math.min(snappedTime, duration))

        const index = actions.findIndex((a) => a.id === draggingActionId)
        if (index !== -1) {
            actions[index].time = clampedTime
            actions = actions
        }
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

    function handleDrop(e: DragEvent) {
        e.preventDefault()

        const rect = trackWrapper.getBoundingClientRect()
        const offsetX = e.clientX - rect.left + trackWrapper.scrollLeft
        const dropTime = (offsetX / zoomLevel) * 1000
        const resultTime = Math.max(0, Math.min(Math.round(dropTime / 10) * 10, duration))

        const files = e.dataTransfer?.files
        if (files && files.length > 0) {
            // Handle external files (Audio)
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                const type = getMediaType(getExtension(file.name))
                // Check if audio
                if (file.type.startsWith("audio/") || type === "audio") {
                    actions.push({
                        id: uid(6),
                        time: resultTime,
                        type: "audio",
                        data: { path: (file as any).path, name: file.name },
                        duration: AudioPlayer.getDurationSync((file as any).path),
                        name: file.name
                    })
                }
            }
            actions = actions
            return
        }

        // Handle internal selection
        if ($selected.id && $selected.data && $selected.data.length > 0) {
            const items = $selected.data
            items.forEach((item) => {
                let newAction: TimelineAction | null = null
                if ($selected.id === "audio") {
                    newAction = {
                        id: uid(6),
                        time: resultTime,
                        type: "audio",
                        data: item,
                        name: item.name || "Audio",
                        duration: AudioPlayer.getDurationSync(item.path)
                    }
                } else if ($selected.id === "media" && item.type === "audio") {
                    newAction = {
                        id: uid(6),
                        time: resultTime,
                        type: "audio",
                        data: { path: item.path, name: item.name },
                        name: item.name
                    }
                }

                if (newAction) {
                    actions.push(newAction)
                }
            })
            if (items.length > 0) actions = actions
        }
    }

    onDestroy(() => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId)
        if (autoScrollFrameId) cancelAnimationFrame(autoScrollFrameId)
        // Cleanup global listeners if component is destroyed while dragging
        if (typeof window !== "undefined") {
            window.removeEventListener("mousemove", updateScrub)
            window.removeEventListener("mouseup", endScrub)
            window.removeEventListener("mousemove", updateActionDrag)
            window.removeEventListener("mouseup", endActionDrag)
        }
    })

    // Type time in input to go to specific time

    function handleTimeChange(e: Event) {
        const input = (e.target as HTMLInputElement).value
        const ms = parseTime(input)
        if (!isNaN(ms)) {
            currentTime = Math.max(0, Math.min(ms, duration))
            centerPlayhead()
        }
        // Force update input value in case it was invalid or clamped
        const target = e.target as HTMLInputElement
        target.value = formatTime(currentTime)
        target.blur()
    }

    function handleTimeKeydown(e: KeyboardEvent) {
        e.stopPropagation()
        if (e.key === "Enter") {
            ;(e.target as HTMLInputElement).blur()
        }
    }

    function parseTime(str: string): number {
        // Split Centiseconds
        let cs = 0
        let main = str
        if (str.includes(";")) {
            const parts = str.split(";")
            main = parts[0]
            cs = parseInt(parts[1]) || 0
        } else if (str.includes(".")) {
            const parts = str.split(".")
            main = parts[0]
            cs = parseInt(parts[1]) || 0
        }

        const parts = main
            .split(":")
            .reverse()
            .map((p) => parseInt(p) || 0)
        let s = parts[0] || 0
        let m = parts[1] || 0
        let h = parts[2] || 0

        // Calculate total ms
        let ms = (h * 3600 + m * 60 + s) * 1000 + cs * 10

        // Offset logic
        // If >= 1 hour (start offset), assume absolute. Subtract offset.
        // If < 1 hour, assume relative (offset from start of show).
        const offset = 3600000
        if (ms >= offset) {
            return ms - offset
        }
        return ms
    }

    function handleScroll() {
        if (rulerContainer) rulerContainer.scrollLeft = trackWrapper.scrollLeft
        if (headersContainer) headersContainer.scrollTop = trackWrapper.scrollTop

        if (isProgrammaticScroll) {
            isProgrammaticScroll = false
            scrollLeft = trackWrapper.scrollLeft
            return
        }
        // User scrolled
        if (isPlaying) {
            autoFollow = false
        }
        scrollLeft = trackWrapper.scrollLeft
    }

    let optionsVisible = false

    let offsetHeight = 0
    $: localTimelineActive.set(offsetHeight > 0)
    function keydown(e) {
        if (!$localTimelineActive) return

        const target = e.target as HTMLElement
        if (["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable) return

        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault()
            return
        }

        if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault()
            if (selectedActionIds.length > 0) {
                actions = actions.filter((a) => !selectedActionIds.includes(a.id))
                selectedActionIds = []
            }
            return
        }

        if (e.key !== " " || e.repeat) return

        e.preventDefault()
        if (isPlaying) pause()
        else play()
    }

    // Show timeline
    let isRecording = false
    $: if ($activeShow) isRecording = ShowTimeline.isRecordingActive()
    function toggle() {
        isRecording = ShowTimeline.toggleRecording((sequence) => {
            actions.push({
                id: uid(6),
                time: currentTime,
                type: "slide",
                data: sequence,
                name: `Slide ${sequence.slideRef.index + 1}`
            })
            actions = actions

            // start if changed when paused
            if (!isPlaying) play()
        })
    }
</script>

<svelte:window on:keydown={keydown} />

<div class="timeline" bind:offsetHeight>
    {#if optionsVisible}
        <div class="toolbar">
            <div class="duration-controls">
                <MaterialCheckbox label="Set max length" checked={useFixedDuration} on:change={(e) => (useFixedDuration = e.detail)} />
                {#if useFixedDuration}
                    <MaterialNumberInput label="Duration (s)" min={1} value={fixedDurationSeconds} on:change={(e) => (fixedDurationSeconds = e.detail)} />
                {/if}
            </div>

            <div style="flex:1"></div>

            <MaterialButton icon="focus" title="Reset View" on:click={resetView} />

            <div class="zoom-controls">
                <span style="font-size: 0.8em; opacity: 0.7;">Zoom:</span>
                <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} value={zoomLevel} on:input={handleZoomSlider} />
            </div>
        </div>
    {/if}

    <div class="timeline-grid">
        <!-- Top Left Corner -->
        <div class="corner" style="width: {usedHeaderWidth}px; border-bottom: 1px solid #444; border-right: 1px solid rgba(255,255,255,0.1); background-color: var(--primary-darker); box-sizing: border-box;"></div>

        <!-- Ruler (Sticky Top) -->
        <div class="ruler-container" bind:this={rulerContainer} on:mousedown={startRulerScrub}>
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
                {#each Array(maxTrackIndex + 1) as _, i}
                    <div class="track-header" style="top: {35 + i * 70}px; width: 100%;">
                        <span class="track-name">{getTrackName(i)}</span>
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
                        <div class="action-clip" class:selected={selectedActionIds.includes(action.id)} style="left: {(action.time / 1000) * zoomLevel}px; width: {action.duration * zoomLevel}px; top: {baseY}px;" title="{action.name} ({formatTime(action.duration * 1000)}) at {formatTime(action.time)}" on:mousedown|stopPropagation={(e) => startActionDrag(e, action.id)}>
                            <div class="action-clip-content">
                                <div class="action-label clip-label">{action.name}</div>
                                <button class="delete-btn clip-delete" on:mousedown|stopPropagation on:click|stopPropagation={() => removeAction(action.id)}>×</button>
                            </div>
                        </div>
                    {:else}
                        <div class="action-marker" class:selected={selectedActionIds.includes(action.id)} style="left: {(action.time / 1000) * zoomLevel}px; top: {baseY + 5}px;" title="{action.name} at {formatTime(action.time)}" on:mousedown|stopPropagation={(e) => startActionDrag(e, action.id)}>
                            <div class="action-head"></div>
                            <div class="action-label">{action.name}</div>
                            <button class="delete-btn" on:mousedown|stopPropagation on:click|stopPropagation={() => removeAction(action.id)}>×</button>
                        </div>
                    {/if}
                {/each}

                <!-- Selection Box -->
                {#if selectionRect}
                    <div class="selection-box" style="left: {selectionRect.x}px; top: {selectionRect.y}px; width: {selectionRect.w}px; height: {selectionRect.h}px;"></div>
                {/if}

                <!-- Playhead (Line Only) -->
                <div class="playhead" style="left: {(currentTime / 1000) * zoomLevel}px;">
                    <div class="playhead-line"></div>
                </div>
            </div>
        </div>
    </div>

    <FloatingInputs side="left" style="margin-bottom: 8px;">
        <MaterialButton title={isPlaying ? "media.pause" : "media.play"} on:click={() => (isPlaying ? pause() : play())}>
            <Icon size={1.3} id={isPlaying ? "pause" : "play"} white={!isPlaying} />
        </MaterialButton>

        <MaterialButton disabled={currentTime === 0} title="media.stop" on:click={stop}>
            <Icon size={1.3} id="stop" white={!isPlaying} />
        </MaterialButton>

        <MaterialButton title="actions.{isRecording ? 'stop_recording' : 'start_recording'}" on:click={toggle} red={isRecording}>
            <Icon size={1.3} id="record" white />
        </MaterialButton>

        <div class="divider" />

        <p class="time">
            <input class="time-display" value={timeString} on:change={handleTimeChange} on:keydown={handleTimeKeydown} />
        </p>
    </FloatingInputs>

    <FloatingInputs style="margin-bottom: 8px;">
        <MaterialButton title="edit.options" on:click={() => (optionsVisible = !optionsVisible)}>
            <Icon id="options" white={!optionsVisible} />
        </MaterialButton>

        <div class="divider" />

        <MaterialButton icon="add" title="new.action" on:click={addAction}>
            <T id="new.action" />
        </MaterialButton>
    </FloatingInputs>
</div>

<style>
    .timeline {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .toolbar {
        display: flex;
        align-items: center;
        padding: 10px;
        background-color: var(--primary-darkest);
        gap: 10px;
        border-bottom: 1px solid #444;
    }

    .time-display {
        font-family: monospace;
        font-size: 1.25em;
        background: #111;
        padding: 5px 10px;
        border-radius: 4px;
        min-width: 100px;
        text-align: center;
        margin: 0 10px;
        border: 1px solid #444;
        color: #eee;
        outline: none;
    }
    .time-display:focus {
        border-color: var(--focus);
    }

    .timeline-grid {
        display: grid;
        grid-template-columns: var(--header-width, 100px) 1fr;
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
        position: absolute; /* Changed from sticky */
        top: 0;
        height: 30px;
        /* pointer-events: none; */ /* Now interactive */
        /* z-index: 100; */
    }

    /* .ruler::after { ... } */ /* Removed shadow or keep if desired */

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
        top: 8px;
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
        /* width: 100px; */
        height: 60px;
        display: flex;
        align-items: center;
        padding-left: 10px;
        /* background: rgba(0, 0, 0, 0.6); */
        border-bottom: 1px solid rgba(255, 255, 255, 0.05); /* Separators */
        pointer-events: auto; /* Allow interaction if needed */
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
        width: 14px;
        height: 14px;
        background-color: var(--secondary);
        border-radius: 50%;
        border: 2px solid var(--text);
    }

    .action-clip {
        position: absolute;
        top: 35px;
        height: 60px;
        background-color: var(--primary-light);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        z-index: 4;
        cursor: move;
        overflow: hidden;
        box-sizing: border-box;
    }

    .action-clip-content {
        display: flex;
        align-items: center;
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
        padding: 0;
    }

    .clip-delete {
        opacity: 0;
        transition: opacity 0.2s;
        margin: 0;
        padding: 0 5px;
    }

    .action-clip:hover .clip-delete {
        opacity: 1;
    }

    .action-clip.selected {
        border-color: var(--secondary);
        box-shadow: 0 0 0 1px var(--secondary);
    }

    .action-marker.selected .action-head {
        background-color: #fff;
        border-color: var(--secondary);
        transform: scale(1.2);
    }

    .selection-box {
        position: absolute;
        background-color: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.5);
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

    .selection-box {
        position: absolute;
        background-color: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.5);
        pointer-events: none;
        z-index: 100;
    }

    .action-clip:hover .clip-delete {
        opacity: 1;
    }

    .action-clip.selected {
        border-color: var(--secondary);
        box-shadow: 0 0 0 1px var(--secondary);
    }

    .action-marker.selected .action-head {
        background-color: #fff;
        border-color: var(--secondary);
        transform: scale(1.2);
    }

    .delete-btn {
        margin-top: 2px;
        background: none;
        border: none;
        color: #ff5555;
        font-weight: bold;
        cursor: pointer;
        font-size: 1.2em;
        line-height: 1;
    }

    .zoom-controls {
        display: flex;
        align-items: center;
        gap: 5px;
        margin-left: auto;
    }

    .duration-controls {
        display: flex;
        align-items: center;
        gap: 5px;
        margin-left: 10px;
        font-size: 0.8em;
    }

    /* bottom */

    .time {
        display: flex;
        align-items: center;

        font-size: 0.9em;
        padding: 0 10px;
        opacity: 0.8;
    }
</style>
