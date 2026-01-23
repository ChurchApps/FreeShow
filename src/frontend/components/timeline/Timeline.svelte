<script lang="ts">
    import { onDestroy, tick } from "svelte"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialCheckbox from "../inputs/MaterialCheckbox.svelte"
    import MaterialNumberInput from "../inputs/MaterialNumberInput.svelte"

    // Data types
    interface TimelineAction {
        id: string
        time: number // in milliseconds
        name: string
        description?: string
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
    let wasPlaying = false
    let lastMouseX = 0
    let trackWrapper: HTMLElement
    let scrollLeft = 0
    let containerWidth = 0
    let autoFollow = true
    let isProgrammaticScroll = false

    let useFixedDuration = false
    let fixedDurationSeconds = 300

    // Computed
    $: timeString = formatTime(currentTime)
    $: lastActionTime = actions.length > 0 ? Math.max(...actions.map((a) => a.time)) : 0
    $: duration = useFixedDuration ? fixedDurationSeconds * 1000 : Math.max(minDuration, lastActionTime + 60 * 1000) // 60s buffer
    $: tickInterval = getTickInterval(zoomLevel)
    $: totalTickCount = Math.ceil(duration / 1000 / tickInterval)
    $: visibleTicksStartIndex = Math.min(totalTickCount, Math.max(0, Math.floor(scrollLeft / (tickInterval * zoomLevel))))
    $: visibleTicksEndIndex = Math.min(totalTickCount, Math.ceil((scrollLeft + containerWidth) / (tickInterval * zoomLevel)))
    $: visibleTickCount = Math.max(0, visibleTicksEndIndex - visibleTicksStartIndex + 1)

    function getTickInterval(zoom: number) {
        const minSpacing = 80 // minimum pixels between ticks
        const target = minSpacing / zoom
        const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60]
        return steps.find((s) => s >= target) || 60
    }

    function formatTime(ms: number): string {
        const offsetMs = ms + 3600000 // Start at 01:00:00;00
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
        loop()
    }

    function pause() {
        isPlaying = false
        if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }

    function stop() {
        pause()
        currentTime = 0
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
            if (action.time > previousTime && action.time <= currentTime) {
                console.log("Action trigger:", action.name)
            }
        }

        // Check for end
        if (currentTime >= duration) {
            currentTime = duration
            pause()
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
            }
        }

        animationFrameId = requestAnimationFrame(loop)
    }

    function addAction() {
        const newAction: TimelineAction = {
            id: crypto.randomUUID(),
            time: currentTime,
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
        } else {
            // Horizontal scroll with vertical wheel
            if (e.deltaY !== 0) {
                e.preventDefault()
                trackWrapper.scrollLeft += e.deltaY
            }
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

    function startScrub(e: MouseEvent) {
        // Only left click
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
        if (!isScrubbing || !trackWrapper) return

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
            // Update time based on new scroll pos
            const offsetX = lastMouseX - rect.left + trackWrapper.scrollLeft
            const seekTime = (offsetX / zoomLevel) * 1000
            // Snap to nearest 10ms (1/100th second)
            const snappedTime = Math.round(seekTime / 10) * 10
            currentTime = Math.max(0, Math.min(snappedTime, duration))
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

    onDestroy(() => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId)
        if (autoScrollFrameId) cancelAnimationFrame(autoScrollFrameId)
        // Cleanup global listeners if component is destroyed while dragging
        if (typeof window !== "undefined") {
            window.removeEventListener("mousemove", updateScrub)
            window.removeEventListener("mouseup", endScrub)
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
</script>

<div class="timeline">
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

    <div class="timeline-track-wrapper" bind:this={trackWrapper} bind:clientWidth={containerWidth} on:scroll={handleScroll} on:wheel={handleWheel}>
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div class="timeline-track" style="width: {(duration / 1000) * zoomLevel}px;" on:mousedown={startScrub}>
            <!-- Ruler / Ticks -->
            <div class="ruler">
                {#each Array(visibleTickCount) as _, i}
                    {@const tickIndex = i + visibleTicksStartIndex}
                    {@const pos = tickIndex * tickInterval * zoomLevel}
                    <div class="tick" style="left: {pos}px">
                        <span class="tick-label">{(tickIndex * tickInterval).toFixed(tickInterval < 1 ? 1 : 0)}s</span>
                    </div>

                    <!-- Subticks -->
                    {#if tickIndex < totalTickCount}
                        {#each Array(10) as _, j}
                            <div class="tick minor" style="left: {pos + j * (tickInterval / 10) * zoomLevel}px;height: {j === 0 ? '20px' : j === 5 ? '10px' : '8px'}"></div>
                        {/each}
                    {/if}
                {/each}
            </div>

            <!-- Actions -->
            {#each actions as action (action.id)}
                <div class="action-marker" style="left: {(action.time / 1000) * zoomLevel}px;" title="{action.name} at {formatTime(action.time)}">
                    <div class="action-head"></div>
                    <div class="action-label">{action.name}</div>
                    <button class="delete-btn" on:mousedown|stopPropagation on:click|stopPropagation={() => removeAction(action.id)}>×</button>
                </div>
            {/each}

            <!-- Playhead -->
            <div class="playhead" style="left: {(currentTime / 1000) * zoomLevel}px;">
                <div class="playhead-line"></div>
                <div class="playhead-knob"></div>
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

        <div class="divider" />

        <!-- total length of playlist -->
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

    .timeline-track-wrapper {
        flex: 1;
        overflow-x: auto;
        overflow-y: hidden;
        position: relative;
        background-color: var(--primary-darker);
    }

    .timeline-track {
        position: relative;
        height: 100%;
        min-height: 150px;
        /* cursor: pointer; */
    }

    .ruler {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }

    .ruler::after {
        content: "";
        position: absolute;
        top: 25px;
        left: 0;
        width: 100%;
        border-bottom: 1px solid transparent;
        box-shadow: 0 2px 3px rgba(0, 0, 0, 0.8);
    }

    .tick {
        position: absolute;
        top: 0;
        bottom: 0;
        border-left: 1px solid rgba(255, 255, 255, 0.03);
    }

    .tick.minor {
        height: 10px;
        bottom: auto;
        border-left: 1px solid rgba(255, 255, 255, 0.2);
    }

    .tick-label {
        font-size: 0.7em;
        padding-left: 2px;
        color: var(--text);
        opacity: 0.5;
        position: absolute;
        top: 2px;
    }

    .playhead {
        position: absolute;
        top: 0;
        bottom: 0;
        pointer-events: none;
        /* cursor: pointer; */
        z-index: 10;
        /* No transition for playhead to ensure instant update during playback */
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
        width: 0;
        height: 0;
        border-left: 7px solid transparent;
        border-right: 7px solid transparent;
        border-top: 10px solid var(--secondary);
        top: 0;
        left: -7px;
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
        width: 12px;
        height: 12px;
        background-color: #00bcd4;
        border-radius: 50%;
        border: 2px solid #fff;
    }

    .action-label {
        margin-top: 4px;
        font-size: 0.8em;
        background: rgba(0, 0, 0, 0.5);
        padding: 2px 4px;
        border-radius: 3px;
        white-space: nowrap;
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

    .fixed-input-wrapper {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    .time-input {
        background: #222;
        border: 1px solid #444;
        color: #eee;
        width: 60px;
        padding: 2px 4px;
        border-radius: 3px;
    }

    .unit {
        opacity: 0.7;
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
