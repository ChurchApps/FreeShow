<script lang="ts">
    import { onDestroy, tick } from "svelte"
    import { get } from "svelte/store"
    import { fade } from "svelte/transition"
    import { uid } from "uid"
    import type { TimelineAction } from "../../../types/Show"
    import { AudioPlayer } from "../../audio/audioPlayer"
    import { createWaveform } from "../../audio/audioWaveform"
    import { activeShow, activeTriggerFunction, localTimelineActive, playingAudio, selected, showsCache } from "../../stores"
    import { translateText } from "../../utils/language"
    import { actionData } from "../actions/actionData"
    import { clone } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import { getExtension, getMediaType } from "../helpers/media"
    import { getLayoutRef } from "../helpers/show"
    import { _show } from "../helpers/shows"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import { ShowTimeline } from "./ShowTimeline"

    let actions: TimelineAction[] = []

    $: showId = $activeShow?.id || ""
    $: layoutId = $showsCache[showId]?.settings?.activeLayout || ""
    $: exists = $showsCache[showId] !== undefined
    $: if (exists && showId) updateActions()
    function updateActions() {
        saveCurrentState()

        selectedActionIds = []

        const timeline = _show().layouts("active").get()[0]?.timeline
        if (!timeline) {
            actions = []
            return
        }

        actions = timeline.actions || []
        previousShowId = showId
        previousLayoutId = layoutId
        // if (timeline.maxTime) fixedDurationSeconds = timeline.maxTime
    }

    onDestroy(saveCurrentState)

    let actionsChanged = false
    let previousShowId = ""
    let previousLayoutId = ""
    function saveCurrentState() {
        if (!actionsChanged) return
        actionsChanged = false

        // save current state
        showsCache.update((a) => {
            if (!a[previousShowId]?.layouts?.[previousLayoutId]) return a

            if (!a[previousShowId].layouts[previousLayoutId].timeline) a[previousShowId].layouts[previousLayoutId].timeline = { actions: [] }
            a[previousShowId].layouts[previousLayoutId].timeline!.actions = clone(actions)

            return a
        })
    }

    // State
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
    let dragInitialTimes = new Map<string, number>()
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

    let usedHeaderWidth = 120
    // Computed
    $: timeString = formatTime(currentTime)
    $: lastActionTime = actions.length > 0 ? Math.max(...actions.map((a) => a.time + (a.duration || 0) * 1000)) : 0
    $: duration = Math.max(minDuration, lastActionTime + 60 * 1000) // 60s buffer
    $: tickInterval = getTickInterval(zoomLevel)
    $: snapInterval = (tickInterval * 1000) / 10
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

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId)
            animationFrameId = 0
        }

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
        let hasPlayed: string[] = [] // don't allow the same file to be started multiple times in one loop (WIP allow multiple if not at same time...)
        for (const action of actions) {
            if (action.type === "audio") {
                const a = action.data
                if (a && a.path && !hasPlayed.includes(a.path)) {
                    hasPlayed.push(a.path)
                    const audioStart = action.time
                    const audioEnd = action.time + (action.duration || 0) * 1000
                    if (currentTime >= audioStart && currentTime < audioEnd) {
                        // Should be playing
                        if (!$playingAudio[a.path]) {
                            AudioPlayer.start(a.path, { name: "" }, { pauseIfPlaying: false, playMultiple: true })
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

    async function resetView() {
        zoomLevel = 50
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
    const MIN_ZOOM = 6
    const MAX_ZOOM = 1000
    async function handleWheel(e: WheelEvent, zoom: boolean = false) {
        const shouldZoom = zoom || e.ctrlKey || e.metaKey
        // If not zooming (just regular scrolling) Disable auto-follow
        if (!shouldZoom && e.deltaY !== 0) {
            autoFollow = false
        }
        if (shouldZoom) {
            e.preventDefault()
            const ZOOM_SPEED = e.altKey ? 0.4 : 0.1
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
            const speed = e.deltaY * (e.altKey ? 4 : 1)
            e.preventDefault()
            trackWrapper.scrollLeft += speed
        }
    }

    const tabs = {
        action: { name: "tabs.actions", icon: "actions", hasData: false },
        slide: { name: "tools.slide", icon: "slide", hasData: false },
        audio: { name: "tabs.audio", icon: "audio", hasData: false }
    }
    let tabIds = Object.keys(tabs)

    const BAR_TOP = 25
    const BAR_HEIGHT = 55
    const BAR_GAP = 12
    const maxTrackIndex = tabIds.length
    $: totalTrackHeight = BAR_TOP + maxTrackIndex * (BAR_HEIGHT + BAR_GAP) - BAR_GAP + BAR_TOP

    $: sortTracks(actions)
    function sortTracks(_updater: any) {
        tabIds = Object.keys(tabs)
        tabIds.forEach((tabId) => {
            tabs[tabId].hasData = actions.some((a) => a.type === tabId)
        })

        tabIds = tabIds.sort((a, b) => {
            const hasActionsA = tabs[a].hasData ? 1 : 0
            const hasActionsB = tabs[b].hasData ? 1 : 0
            if (hasActionsA === hasActionsB) return 0
            return hasActionsA > hasActionsB ? -1 : 1
        })
    }

    function getTrackData(index: number, _updater: any) {
        return tabs[tabIds[index]] || { name: "Unknown", icon: "unknown" }
    }
    function getActionTrack(action: TimelineAction): number {
        return tabIds.indexOf(action.type)
    }
    function getActionBaseY(action: TimelineAction): number {
        return BAR_TOP + getActionTrack(action) * (BAR_HEIGHT + BAR_GAP)
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

    function getActionAtPosition(e: MouseEvent): TimelineAction | null {
        if (!trackWrapper) return null

        const rect = trackWrapper.getBoundingClientRect()
        const offsetX = e.clientX - rect.left + trackWrapper.scrollLeft
        const offsetY = e.clientY - rect.top + trackWrapper.scrollTop

        for (const action of actions) {
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

            // Check if point is inside action rect
            if (offsetX >= ax && offsetX <= ax + aw && offsetY >= ay && offsetY <= ay + ah) {
                return action
            }
        }

        return null
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

        // WIP duplicate of getActionAtPosition
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

        const snappedTime = Math.round(seekTime / snapInterval) * snapInterval
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
                // const snappedTime = Math.round(seekTime / snapInterval) * snapInterval // not smooth
                currentTime = Math.max(0, Math.min(snappedTime, duration))
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

        if (wasPlaying) play()
    }

    function startActionDrag(e: MouseEvent, id: string) {
        // select on right-click
        if (e.button === 2) {
            const clickedAction = getActionAtPosition(e)
            if (clickedAction) {
                if (!selectedActionIds.includes(clickedAction.id)) {
                    selectedActionIds = [clickedAction.id]
                }
            } else {
                selectedActionIds = []
            }
            return
        }

        if (e.button !== 0) return

        if (!selectedActionIds.includes(id)) {
            if (e.ctrlKey || e.shiftKey) {
                selectedActionIds = [...selectedActionIds, id]
            } else {
                selectedActionIds = [id]
            }
        }

        // DUPLICATE
        if (e.altKey) {
            const newSelectedIds: string[] = []
            let newDraggingId: string | null = null

            const newActions = selectedActionIds
                .map((sid) => {
                    const original = actions.find((a) => a.id === sid)
                    if (!original) return null

                    const newId = uid(6)
                    if (sid === id) newDraggingId = newId
                    newSelectedIds.push(newId)

                    return {
                        ...original,
                        id: newId,
                        data: JSON.parse(JSON.stringify(original.data))
                    }
                })
                .filter((a) => a !== null) as TimelineAction[]

            actions = [...actions, ...newActions]
            actionsChanged = true
            selectedActionIds = newSelectedIds
            if (newDraggingId) id = newDraggingId
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
        if (minInitial + delta < 0) {
            delta = -minInitial
        }

        actions = actions.map((a) => {
            if (dragInitialTimes.has(a.id)) {
                return { ...a, time: dragInitialTimes.get(a.id)! + delta }
            }
            return a
        })
        actionsChanged = true
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

        const existingAudioActions = actions.some((a) => a.type === "audio")

        let selection = $selected

        // external files
        const files = e.dataTransfer?.files
        if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i]

                let audioFiles: { path: string; name: string }[] = []
                if (file.type.startsWith("audio/") || getMediaType(getExtension(file.name)) === "audio") {
                    const path = window.api.showFilePath(file)
                    audioFiles.push({ path, name: file.name })
                }

                selection = { id: "audio", data: audioFiles }
            }
        }

        const id = selection.id
        if (!id || !selection.data?.length) return

        const layoutRef = getLayoutRef()

        await Promise.all(
            selection.data.map(async (item) => {
                if (!tabIds.includes(id)) return

                const time = id === "audio" && !existingAudioActions ? 0 : resultTime
                const type = id
                const data = getData()
                const name = getName() || id

                const newAction: TimelineAction = {
                    id: uid(6),
                    time,
                    type,
                    data,
                    name
                }
                if (id === "audio") newAction.duration = await AudioPlayer.getDuration(item.path)

                actions.push(newAction)

                function getData() {
                    if (id === "action") return { triggers: item.triggers || [], actionValues: item.actionValues || {} }
                    if (id === "slide") return { id: layoutRef[item.index]?.id, index: item.index }

                    return item
                }

                function getName() {
                    if (id === "slide") {
                        const slideId = layoutRef[item.index]?.id
                        const groupSlideId = layoutRef[item.index]?.parent?.id || slideId
                        const slideGroup = get(showsCache)[item?.showId]?.slides?.[groupSlideId]?.group
                        return slideGroup || ""
                    }

                    return item.name || ""
                }
            })
        )
        actions = actions
        actionsChanged = true
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
            deleteSelectedNodes()
            return
        }

        if (e.key !== " " || e.repeat) return

        e.preventDefault()
        if (isPlaying) pause()
        else play()
    }

    $: if ($activeTriggerFunction === "delete_selected_nodes") deleteSelectedNodes()
    function deleteSelectedNodes() {
        if (!selectedActionIds.length) return

        actions = actions.filter((a) => !selectedActionIds.includes(a.id))
        actionsChanged = true
        selectedActionIds = []
        setTimeout(() => (actions = actions)) // update properly when deleting from context menu
    }

    // Show timeline
    let isRecording = false
    $: if ($activeShow) isRecording = ShowTimeline.isRecordingActive()
    function toggle() {
        isRecording = ShowTimeline.toggleRecording((sequence) => {
            const time = Number(currentTime.toFixed(2))
            // skip if already exists at this time (within 100ms)
            if (actions.find((a) => a.type === sequence.type && Math.abs(time - a.time) < 100 && JSON.stringify(a.data) === JSON.stringify(sequence.data))) return
            // WIP skip if previous action is the same as current (only "slide")

            actions.push({
                id: uid(6),
                time,
                type: sequence.type,
                data: sequence.data,
                name: sequence.name
            })
            actionsChanged = true
            actions = actions

            // start if changed when paused
            if (!isPlaying) play()
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
</script>

<svelte:window on:keydown={keydown} />

<div class="timeline" bind:offsetHeight>
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
                    <div class="track-header" style="top: {BAR_TOP + i * (BAR_HEIGHT + BAR_GAP)}px;width: 100%;{track.hasData ? '' : 'opacity: 0.3;'}">
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
                        <div class="action-clip context #timeline_node" class:selected={selectedActionIds.includes(action.id)} style="left: {(action.time / 1000) * zoomLevel}px; width: {action.duration * zoomLevel}px; top: {baseY}px;height: {BAR_HEIGHT + 4}px;" data-title="{formatTime(action.time)}-{formatTime(action.duration * 1000)}: {action.name}" on:mousedown|stopPropagation={(e) => startActionDrag(e, action.id)}>
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
        <MaterialButton title={isPlaying ? "media.pause" : "media.play"} on:click={() => (isPlaying ? pause() : play())}>
            <Icon size={1.3} id={isPlaying ? "pause" : "play"} white={!isPlaying} />
        </MaterialButton>

        <MaterialButton disabled={currentTime === 0} title="media.stop" on:click={stop}>
            <Icon size={1.3} id="stop" white={!isPlaying} />
        </MaterialButton>

        <MaterialButton disabled={isPlaying && !isRecording} title="actions.{isRecording ? 'stop_recording' : 'start_recording'}" on:click={toggle} red={isRecording}>
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
        cursor: move;
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

    .clip-delete {
        opacity: 0;
        transition: opacity 0.2s;
        margin: 0;
        padding: 0 5px;
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
</style>
