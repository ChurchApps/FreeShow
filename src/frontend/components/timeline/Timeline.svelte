<script lang="ts">
    import { onDestroy, tick } from "svelte"
    import { fade } from "svelte/transition"
    import { uid } from "uid"
    import type { TimelineAction } from "../../../types/Show"
    import { createWaveform } from "../../audio/audioWaveform"
    import { activeEdit, activePopup, activeShow, activeTriggerFunction, dictionary, resized, selected, showsCache, special, timecode, timeline as timelineStore } from "../../stores"
    import { DEFAULT_WIDTH } from "../../utils/common"
    import { translateText } from "../../utils/language"
    import { actionData } from "../actions/actionData"
    import { clone } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import { getActionEasing, getSegmentCurve, getSegmentCurvePoints, toStoredActionEasing } from "./easingHelper"
    import type { EasingHandles } from "./easingHelper"
    import { ShowTimeline } from "./ShowTimeline"
    import { formatTime, getActionsAtPosition, getProjectShowDurations, getTickInterval, getTimelineSections, parseTime, TIMELINE_SECTION_GAP, TIMELINE_SECTION_HEIGHT, TIMELINE_SECTION_TOP, timelineSections, timelineZoom } from "./timeline"
    import { TimelineActions, type TimelineType } from "./TimelineActions"
    import { getActiveTimelinePlayback, TimelinePlayback } from "./TimelinePlayback"

    export let type: TimelineType
    export let isClosed: boolean = false

    // SECTIONS

    const sections = clone(timelineSections[type] || {})
    let tabIds = Object.keys(sections)

    // smaller height (that broke right click select)
    const SECTION_GAP = TIMELINE_SECTION_GAP // type === "slide" ? 5 : TIMELINE_SECTION_GAP
    const SECTION_HEIGHT = TIMELINE_SECTION_HEIGHT // type === "slide" ? 42 : TIMELINE_SECTION_HEIGHT

    let maxTrackIndex = tabIds.length
    $: totalTrackHeight = TIMELINE_SECTION_TOP + maxTrackIndex * (SECTION_HEIGHT + SECTION_GAP) - SECTION_GAP + TIMELINE_SECTION_TOP

    function getTrackData(index: number, _updater: any) {
        return sections[tabIds[index]] || { name: "Unknown", icon: "unknown" }
    }
    function getActionTrack(action: TimelineAction): number {
        if (type === "slide") return groupedActions.findIndex((group) => group[0].data?.type === action.data?.type && group[0].data?.key === action.data?.key)
        return tabIds.indexOf(action.type)
    }
    function getActionBaseY(action: TimelineAction): number {
        return TIMELINE_SECTION_TOP + getActionTrack(action) * (SECTION_HEIGHT + SECTION_GAP)
    }

    // TIMELINE

    let actions: TimelineAction[] = []
    let groupedActions: TimelineAction[][] = []
    let isDestroyed = false

    const player = new TimelinePlayback(type)

    let shouldLoop: boolean = false
    const timeline = new TimelineActions(type, async (a, data) => {
        await tick()

        if (isDestroyed) return

        shouldLoop = data?.shouldLoop || false
        player.setLoopState(shouldLoop)

        actions = a
        player.setActions(a)
        tabIds = getTimelineSections(sections, a)

        // group based on type
        if (type !== "slide") return

        const newGroups = new Map<string, TimelineAction[]>()
        a.forEach((action) => {
            const groupKey = `${action.data?.type}_${action.data?.key}`
            if (!newGroups.has(groupKey)) newGroups.set(groupKey, [])
            newGroups.get(groupKey)?.push(action)
        })

        groupedActions = Array.from(newGroups.values())
        // sort by action type (item/text)
        groupedActions = groupedActions.sort((a, b) => {
            const aType = a[0].data?.type || ""
            const bType = b[0].data?.type || ""
            return aType.localeCompare(bType)
        })
        maxTrackIndex = groupedActions.length
    })
    timeline.onUpdate(() => {
        currentTime = 0
        resetView()
    })
    onDestroy(() => {
        isDestroyed = true
        player.close()
        timeline.close()
    })

    let isPlaying = player.isPlaying
    player.onPlay(() => {
        isPlaying = true
        autoFollow = true

        // start recording if at beginning and no actions
        if (currentTime === 0 && !actions.length && !isRecording) toggleRecording()
    })
    player.onPause(() => {
        isPlaying = false
    })
    player.onStop(() => {
        isPlaying = false

        if (isRecording) toggleRecording()
    })

    let timelineDuration = 60000 * 5
    player.onDuration((time) => (timelineDuration = time))

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
    let lastMouseEvent: MouseEvent | null = null
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

    $: timeString = formatTime(currentTime, type, $timelineStore)
    $: tickInterval = getTickInterval(zoomLevel)
    $: snapInterval = (tickInterval * 1000) / 10

    $: totalTickCount = Math.ceil(timelineDuration / 1000 / tickInterval)
    $: visibleTicksStartIndex = Math.min(totalTickCount, Math.max(0, Math.floor(scrollLeft / (tickInterval * zoomLevel))))
    $: visibleTicksEndIndex = Math.min(totalTickCount, Math.ceil((scrollLeft + containerWidth) / (tickInterval * zoomLevel)))
    $: visibleTickCount = Math.max(0, visibleTicksEndIndex - visibleTicksStartIndex + 1)

    $: if ($activeTriggerFunction === "reset_timeline_view") resetView()
    async function resetView() {
        zoomLevel = 10
        tickInterval = getTickInterval(zoomLevel) // this should have auto updated but it doesn't sometimes
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
        if (disablePlayback) return
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
        if (e.target?.closest(".easing")) return

        // remove any selection
        selected.set({ id: null, data: [] })

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

        lastMouseEvent = e
        lastMouseX = e.clientX
        autoScrollTimeout = setTimeout(autoScrollLoop, 300)

        window.addEventListener("mousemove", updateSelection)
        window.addEventListener("mouseup", endSelection)
    }

    $: if ($activeTriggerFunction === "timeline_selectAll") selectAll()
    function selectAll() {
        const allActionIds = actions.map((a) => a.id)
        selectedActionIds = allActionIds

        selectOnlyActiveActions()
    }

    function updateSelection(e: MouseEvent) {
        if (!isSelecting || !trackWrapper) return

        lastMouseX = e.clientX
        lastMouseEvent = e

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

        const newSelectedIds = getActionsAtPosition(e, trackWrapper, actions, type === "slide" ? groupedActions : tabIds, zoomLevel, selectionRect, projectShowDurations)

        if (selectionStartIds.length > 0) {
            const combined = new Set([...selectionStartIds, ...newSelectedIds])
            selectedActionIds = Array.from(combined)
        } else {
            selectedActionIds = newSelectedIds
        }

        selectOnlyActiveActions()
    }

    function selectOnlyActiveActions() {
        selectedActionIds = selectedActionIds.filter((id) => {
            const action = actions.find((a) => a.id === id)
            if (!action) return false

            if (type === "slide" && action.type === "style") {
                // only select "active" actions
                const itemIndexes = action.data?.indexes ?? [0]
                return itemIndexes.some((index) => selectedItemIndexes.includes(index))
            }

            return true
        })
    }

    function endSelection() {
        isSelecting = false
        selectionRect = null
        lastMouseEvent = null

        if (autoScrollTimeout) clearTimeout(autoScrollTimeout)
        if (autoScrollFrameId) cancelAnimationFrame(autoScrollFrameId)

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
        const time = Math.max(0, Math.min(snappedTime, timelineDuration))
        player.setTime(time, true)
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
            if (rulerContainer && !isSelecting) rulerContainer.scrollLeft = newScrollLeft
        }
    }

    function autoScrollLoop() {
        if ((!isScrubbing && !draggingActionId && !isSelecting) || !trackWrapper) return

        const rect = trackWrapper.getBoundingClientRect()
        const EDGE_THRESHOLD = 100
        const MAX_SCROLL_SPEED = 14

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
                const time = Math.max(0, Math.min(snappedTime, timelineDuration))
                player.setTime(time)
            } else if (draggingActionId) {
                const newTime = seekTime - dragTimeOffset
                const snappedTime = Math.round(newTime / snapInterval) * snapInterval
                moveSelectedActions(snappedTime)
            } else if (isSelecting && lastMouseEvent) {
                updateSelection(lastMouseEvent)
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
            const clickedActions = getActionsAtPosition(e, trackWrapper, actions, type === "slide" ? groupedActions : tabIds, zoomLevel, null, projectShowDurations)
            // skip if selection includes any clicked action
            if (clickedActions.some((a) => selectedActionIds.includes(a))) return
            // select all right clicked actions
            selectedActionIds = clickedActions
            return
        }

        if (e.button !== 0) return

        // remove any selection
        selected.set({ id: null, data: [] })

        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            const index = selectedActionIds.indexOf(id)
            if (index === -1) selectedActionIds = [...selectedActionIds, id]
            else selectedActionIds.splice(index, 1) // deselect if selected
            selectedActionIds = selectedActionIds
        } else if (!selectedActionIds.includes(id)) {
            selectedActionIds = [id]
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
        const resultTime = Math.max(0, Math.min(Math.round(dropTime / 10) * 10, timelineDuration))

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
            time = Math.max(0, Math.min(ms, timelineDuration))
            player.setTime(time)
            centerPlayhead()
        }

        // Force update input value in case it was invalid or clamped
        const target = e.target as HTMLInputElement
        target.value = formatTime(time, type)
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

        const active = getActiveTimelinePlayback()
        if (active ? active !== player : type === "show" && $special.projectTimelineActive) return

        e.preventDefault()
        if (isPlaying) player.pause()
        else player.play()
    }

    $: if ($activeTriggerFunction === `start_${type}_timeline`) player.play()

    $: if ($activeTriggerFunction === "delete_selected_nodes") deleteSelectedNodes()
    function deleteSelectedNodes() {
        if (isClosed || !selectedActionIds.length) return

        timeline.deleteActions(selectedActionIds)
        selectedActionIds = []
    }

    // show timeline recording
    let isRecording = false
    $: if (type === "show" && $activeShow) isRecording = ShowTimeline.isRecordingActive()
    function toggleRecording() {
        if (type !== "show") return

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
                name: sequence.name,
                color: sequence.color
            })

            // start if changed when paused
            if (!isPlaying) player.play()
        })
    }

    $: if ($activeTriggerFunction === "timeline_update") timeline.refreshActions()

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

    let projectShowDurations: Record<string, number> = {}
    $: if (actions || $showsCache) updateProjectShowDurations()
    function updateProjectShowDurations() {
        if (type !== "project") return

        // load after startup
        setTimeout(() => {
            projectShowDurations = getProjectShowDurations(actions, $showsCache)
        }, 50)
    }

    $: disablePlayback = type === "project" && $timecode.type === "receive"

    $: actionsByTime = actions.slice().sort((a, b) => a.time - b.time)
    $: slideActions = actionsByTime.filter((a) => a.type === "slide")
    $: firstSlideAction = slideActions[0]
    $: lastSlideAction = slideActions[slideActions.length - 1]

    $: selectedItemIndexes = type === "slide" ? ($activeEdit?.items?.length ? $activeEdit?.items : [0]) : []

    let easingActive: number | null = null

    // --- Cubic Bezier Easing Points Calculation ---
    interface EasingPoint {
        id: string
        x: number
        y: number
        action: TimelineAction
    }

    let points: EasingPoint[] = []
    let easingCurvesPx: EasingHandles[] = []
    $: if (easingActive !== null && type === "slide" && groupedActions && groupedActions[easingActive]) {
        const minValue = Math.min(...groupedActions[easingActive].map((a) => (typeof a.data?.value === "number" ? a.data.value : Infinity)))
        const maxValue = Math.max(...groupedActions[easingActive].map((a) => (typeof a.data?.value === "number" ? a.data.value : -Infinity)))
        const valueRange = maxValue - minValue || 1

        points = actions
            .map((action) => {
                const correctKey = groupedActions[easingActive!][0]?.data?.key === action.data?.key
                if (!correctKey) return null
                const faded = type === "slide" && action.type === "style" && !(action.data?.indexes ?? [0])?.some((a) => selectedItemIndexes.includes(a))
                if (faded) return null

                const top = faded ? 100 : 100 - (((typeof action.data?.value === "number" ? action.data.value : 0) - minValue) / valueRange) * 80
                return {
                    id: action.id,
                    x: (action.time / 1000) * zoomLevel,
                    y: top,
                    action: action
                } as EasingPoint
            })
            .filter((p): p is EasingPoint => p !== null)
            .sort((a, b) => a.action.time - b.action.time)

        // Calculate pixel positions for control points based on current zoom/value
        easingCurvesPx = points.slice(0, -1).map((p1, i) => {
            const p2 = points[i + 1]
            const curve = getSegmentCurve(p1.action, p2.action)
            return getSegmentCurvePoints(p1, p2, curve)
        })
    } else {
        points = []
        easingCurvesPx = []
    }

    // --- Curve Pin Drag Logic ---
    let draggingCurveIndex: number | null = null
    let draggingPin: 1 | 2 | null = null
    let dragCurveOffset = { x: 0, y: 0 }

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

    function updateStoredEasing(action: TimelineAction, updater: (easing: EasingHandles) => EasingHandles) {
        action.easing = toStoredActionEasing(updater(getActionEasing(action)))
    }

    function startCurvePinDrag(e: MouseEvent, curveIndex: number, pin: 1 | 2) {
        e.stopPropagation()
        draggingCurveIndex = curveIndex
        draggingPin = pin
        dragCurveOffset = { x: e.clientX, y: e.clientY }
        window.addEventListener("mousemove", updateCurvePinDrag)
        window.addEventListener("mouseup", endCurvePinDrag)
    }

    function updateCurvePinDrag(e: MouseEvent) {
        if (draggingCurveIndex === null || draggingPin === null) return
        const i = draggingCurveIndex
        const pin = draggingPin
        const p1 = points[i]
        const p2 = points[i + 1]
        if (!p1 || !p2) return
        const dx = e.clientX - dragCurveOffset.x
        const dy = e.clientY - dragCurveOffset.y
        dragCurveOffset = { x: e.clientX, y: e.clientY }
        const dt = p2.x - p1.x || 1
        const dv = p2.y - p1.y || 1
        if (pin === 1) {
            // Update the incoming handle on the current keyframe.
            updateStoredEasing(p2.action, (easing) => ({
                x1: clamp(easing.x1 + dx / dt, 0, 1),
                y1: clamp(easing.y1 + dy / dv, -2, 2),
                x2: easing.x2,
                y2: easing.y2
            }))
        } else {
            // Update the outgoing handle on the current keyframe.
            updateStoredEasing(p1.action, (easing) => ({
                x1: easing.x1,
                y1: easing.y1,
                x2: clamp(easing.x2 + dx / dt, 0, 1),
                y2: clamp(easing.y2 + dy / dv, -2, 2)
            }))
        }
        actions = [...actions]
    }

    function endCurvePinDrag() {
        draggingCurveIndex = null
        draggingPin = null
        window.removeEventListener("mousemove", updateCurvePinDrag)
        window.removeEventListener("mouseup", endCurvePinDrag)
    }

    function setCurvePinLinear(i: number, pin: 1 | 2) {
        if (!points[i]) return
        const p = points[i]
        if (pin === 1) {
            // Reset the incoming handle onto the segment diagonal for a 45-degree linear angle.
            updateStoredEasing(p.action, (easing) => ({ x1: 0.5, y1: 0.5, x2: easing.x2, y2: easing.y2 }))
        } else if (pin === 2) {
            // Reset the outgoing handle onto the segment diagonal for a 45-degree linear angle.
            updateStoredEasing(p.action, (easing) => ({ x1: easing.x1, y1: easing.y1, x2: 0.5, y2: 0.5 }))
        }
        actions = [...actions]
    }

    function getLineStyle(x1: number, y1: number, x2: number, y2: number): string {
        const dx = x2 - x1
        const dy = y2 - y1
        const distance = Math.sqrt(dx * dx + dy * dy)
        const angle = Math.atan2(dy, dx) * (180 / Math.PI)
        return `position: absolute; left: ${x1}px; top: ${y1}px; width: ${distance}px; height: 1px; border-top: 1px dashed var(--secondary); transform: rotate(${angle}deg); transform-origin: 0 0; pointer-events: none; z-index: 3;`
    }

    const Y_OFFSET = 12
</script>

<svelte:window on:keydown={keydown} />

<div class="timeline">
    {#if isClosed}
        <div class="closed">
            {#if disablePlayback}
                <MaterialButton style="min-width: 40px;padding: 10px;" title={isPlaying ? "media.stop" : "media.play"} on:click={() => (isPlaying ? player.pause() : player.play())}>
                    <Icon id={isPlaying ? "stop" : "microphone"} white={!isPlaying} />
                </MaterialButton>
            {:else}
                <MaterialButton style="min-width: 40px;padding: 10px;" title={isPlaying ? "media.pause" : "media.play"} on:click={() => (isPlaying ? player.pause() : player.play())}>
                    <Icon id={isPlaying ? "pause" : "play"} white={!isPlaying} />
                </MaterialButton>

                <MaterialButton style="min-width: 40px;padding: 10px;" disabled={currentTime === 0} title="media.stop" on:click={() => player.stop()}>
                    <Icon id="stop" white={!isPlaying} />
                </MaterialButton>
            {/if}

            {#if (type === "show" && !actions.length) || isRecording}
                <MaterialButton style="min-width: 40px;padding: 10px;" title="actions.{isRecording ? 'stop_recording' : 'start_recording'}" on:click={toggleRecording} red={isRecording}>
                    <Icon id="record" white />
                </MaterialButton>
            {/if}

            <div class="time-display" style="display: flex;align-items: center;width: auto;">{timeString}</div>

            <div class="timeline-track-wrapper" bind:this={trackWrapper} on:mousedown={startRulerScrub} bind:clientWidth={containerWidth} on:scroll={handleScroll} on:wheel={handleWheel}>
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <div class="timeline-track" style="width: {(timelineDuration / 1000) * zoomLevel}px;">
                    <!-- Actions -->
                    {#each actions as action (action.id)}
                        {@const duration = action.duration || (type === "project" && action.type === "show" ? projectShowDurations[action.data.id || ""] : 0) || 0}

                        {#if duration}
                            <div class="action-clip context #timeline_node" class:selected={selectedActionIds.includes(action.id)} style="left: {(action.time / 1000) * zoomLevel}px; width: {duration * zoomLevel}px; top: 50%;transform: translateY(-50%);height: 100%;opacity: 0.3;" data-title={action.name}>
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

            <MaterialButton style="min-width: 40px;padding: 10px;" title="main.open" on:click={() => resized.update((a) => ({ ...a, [(type === "project" ? "project_" : type === "slide" ? "slide_" : "") + "timeline"]: DEFAULT_WIDTH }))}>
                <Icon id="up" white />
            </MaterialButton>
        </div>
    {:else}
        <!-- {#if type === "project" && projectShowTimelines.length}
            <div class="header">
                {#each projectShowTimelines as showTimeline}
                    <div class="tag">{showTimeline.name}</div>
                {/each}
            </div>
        {/if} -->

        <div class="timeline-grid">
            <!-- Top Left Corner -->
            <div class="corner" style="width: {usedHeaderWidth}px; border-bottom: 1px solid rgba(255,255,255,0.1); border-right: 1px solid rgba(255,255,255,0.1);">
                <input class="time-display" value={timeString} on:change={handleTimeChange} on:keydown={handleTimeKeydown} />
            </div>

            <!-- Ruler (Sticky Top) -->
            <div class="ruler-container" bind:this={rulerContainer} on:mousedown={startRulerScrub} on:wheel={(e) => handleWheel(e, true)}>
                <div class="ruler" style="width: {(timelineDuration / 1000) * zoomLevel}px">
                    {#each Array(visibleTickCount) as _, i}
                        {@const tickIndex = i + visibleTicksStartIndex}
                        {@const pos = tickIndex * tickInterval * zoomLevel}
                        <div class="tick" style="left: {pos}px">
                            <span class="tick-label">{formatTime(tickIndex * tickInterval * 1000, type, $timelineStore)}</span>
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
                    {#if type === "slide"}
                        {#each groupedActions as actions, i}
                            <div class="track-header" style="top: {TIMELINE_SECTION_TOP + i * (SECTION_HEIGHT + SECTION_GAP)}px;height: {SECTION_HEIGHT}px;width: 100%;">
                                <Icon id={actions[0]?.data?.type === "text" ? "text" : "item"} white />
                                <span class="track-name">{translateText(actions[0]?.name)}</span>

                                <!-- easing -->
                                <MaterialButton title="timeline.toggle_curve_editor" style="padding: 8px;margin-left: 30px;" isActive={easingActive === i} on:click={() => (easingActive = easingActive === null || easingActive !== i ? i : null)}>
                                    <Icon id="easing" white />
                                </MaterialButton>
                            </div>
                        {/each}
                    {:else}
                        {#each Array(maxTrackIndex) as _, i}
                            {@const track = getTrackData(i, actions)}
                            <div class="track-header" style="top: {TIMELINE_SECTION_TOP + i * (SECTION_HEIGHT + SECTION_GAP)}px;height: {SECTION_HEIGHT}px;width: 100%;{track.hasData ? '' : 'opacity: 0.3;'}">
                                <Icon id={track.icon} white />
                                <span class="track-name">{translateText(track.name)}</span>
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>

            <!-- Main Content (Scroll Master) -->
            <div class="timeline-track-wrapper" bind:this={trackWrapper} bind:clientWidth={containerWidth} on:scroll={handleScroll} on:wheel={handleWheel} on:dragover={handleDragOver} on:drop={handleDrop}>
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <div class="timeline-track" style="width: {(timelineDuration / 1000) * zoomLevel}px; height: {totalTrackHeight}px;" on:mousedown={startContentInteraction}>
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

                    <!-- Slide Action Bar -->
                    {#if firstSlideAction}
                        <div class="slide-action-bar" style="left: {(firstSlideAction.time / 1000) * zoomLevel}px;top: {getActionBaseY(firstSlideAction)}px;width: {((lastSlideAction.time - firstSlideAction.time) / 1000) * zoomLevel}px;"></div>
                    {/if}

                    <!-- Actions -->
                    {#each actions as action (action.id)}
                        {@const duration = action.duration || (type === "project" && action.type === "show" ? projectShowDurations[action.data.id || ""] : 0) || 0}
                        {@const baseY = getActionBaseY(action)}

                        {#if duration}
                            <div class="action-clip context #timeline_node" class:selected={selectedActionIds.includes(action.id)} style="left: {(action.time / 1000) * zoomLevel}px; width: {duration * zoomLevel}px; top: {baseY}px;height: {SECTION_HEIGHT + 4}px;" data-title="{formatTime(action.time, type, $timelineStore)}-{formatTime(duration * 1000, type, $timelineStore)}: {action.name}" on:mousedown|stopPropagation={(e) => startActionDrag(e, action.id)}>
                                <div class="action-clip-content">
                                    {#if action.type === "audio"}
                                        <div class="waveform-container" use:useWaveform={action.data.path || ""}></div>
                                    {/if}
                                    <div class="clip-label">{action.name}</div>
                                </div>
                            </div>
                        {:else}
                            <div
                                class="action-marker {action.type} context #timeline_node"
                                class:selected={selectedActionIds.includes(action.id)}
                                class:faded={type === "slide" && action.type === "style" && !(action.data?.indexes ?? [0])?.some((a) => selectedItemIndexes.includes(a))}
                                style="left: {(action.time / 1000) * zoomLevel}px; top: {baseY + 10}px;"
                                data-title="{formatTime(action.time, type, $timelineStore)}: {action.name}"
                                on:mousedown|stopPropagation={(e) => startActionDrag(e, action.id)}
                            >
                                <div class="action-head">
                                    {#if action.type === "action"}
                                        <Icon id={action.data.triggers?.length === 1 ? actionData[action.data.triggers[0]]?.icon : "actions"} size={0.9} white />
                                    {:else if typeof action.data?.index === "number"}
                                        {action.data.index + 1}
                                    {/if}
                                </div>
                                <div class="action-label" style="{action.color ? `border-bottom: 1px solid ${action.color};` : ''}{type === 'slide' ? 'font-size: 0.7em;' : ''}">
                                    {#if action.type === "style"}
                                        {#if typeof action.data.value === "number"}
                                            {parseFloat(action.data.value.toFixed(1))}
                                        {:else}
                                            {action.data.value}
                                        {/if}
                                    {:else}
                                        {translateText(action.name)}
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    {/each}

                    <!-- Easing -->
                    {#if easingActive !== null && type === "slide"}
                        <div class="track-header easing" style="top: {TIMELINE_SECTION_TOP + easingActive * (SECTION_HEIGHT + SECTION_GAP) + SECTION_HEIGHT}px;height: 120px;width: 100%;" on:mousedown={() => (selectedActionIds = [])}>
                            {#if groupedActions && groupedActions[easingActive]}
                                <!-- Calculate points for the bezier curve in a reactive statement in <script>. -->
                                {#if points.length > 1}
                                    <svg class="easing-curve-svg" style="position:absolute;left:0;top:0;width:100%;height:100%;z-index:2;" width="100%" height="100%">
                                        {#each points.slice(0, -1) as p, i}
                                            {@const p1 = p}
                                            {@const p2 = points[i + 1]}
                                            {@const px = easingCurvesPx[i]}
                                            <path d={`M ${p1.x},${p1.y - Y_OFFSET} C ${px.x1},${px.y1 - Y_OFFSET} ${px.x2},${px.y2 - Y_OFFSET} ${p2.x},${p2.y - Y_OFFSET}`} stroke="var(--secondary)" stroke-width="2" fill="none" opacity="0.7" style="pointer-events:none;" />
                                        {/each}
                                    </svg>

                                    <!-- Dashed lines connecting points to handles (rendered as HTML divs to allow overflow) -->
                                    {#each points as p, i}
                                        {#if selectedActionIds.includes(p.id)}
                                            {#if i > 0}
                                                <div class="easing-line" style={getLineStyle(easingCurvesPx[i - 1].x2, easingCurvesPx[i - 1].y2 - Y_OFFSET, points[i].x, points[i].y - Y_OFFSET)} />
                                            {/if}
                                            {#if i < points.length - 1}
                                                <div class="easing-line" style={getLineStyle(easingCurvesPx[i].x1, easingCurvesPx[i].y1 - Y_OFFSET, points[i].x, points[i].y - Y_OFFSET)} />
                                            {/if}
                                        {/if}
                                    {/each}

                                    <!-- Control point circles rendered as HTML divs to allow overflow -->
                                    {#each points as p, i}
                                        {#if selectedActionIds.includes(p.id)}
                                            {#if i > 0}
                                                <div
                                                    class="easing-control-point"
                                                    style="left: {easingCurvesPx[i - 1].x2}px; top: {easingCurvesPx[i - 1].y2 - Y_OFFSET}px;"
                                                    on:mousedown={(e) => {
                                                        if (e.button === 1) {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                            setCurvePinLinear(i, 1)
                                                        } else if (e.button === 0) {
                                                            startCurvePinDrag(e, i - 1, 1)
                                                        }
                                                    }}
                                                />
                                            {/if}
                                            {#if i < points.length - 1}
                                                <div
                                                    class="easing-control-point"
                                                    style="left: {easingCurvesPx[i].x1}px; top: {easingCurvesPx[i].y1 - Y_OFFSET}px;"
                                                    on:mousedown={(e) => {
                                                        if (e.button === 1) {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                            setCurvePinLinear(i, 2)
                                                        } else if (e.button === 0) {
                                                            startCurvePinDrag(e, i, 2)
                                                        }
                                                    }}
                                                />
                                            {/if}
                                        {/if}
                                    {/each}
                                {/if}

                                {#each points as p}
                                    <div class="action-marker {p.action.type} context #timeline_node" class:selected={selectedActionIds.includes(p.action.id)} style="left: {p.x}px;top: {p.y}px;transform: translate(-50%, -50%);" on:mousedown|stopPropagation={(e) => startActionDrag(e, p.action.id)}>
                                        <div class="action-head">
                                            {#if p.action.type === "action"}
                                                <Icon id={p.action.data.triggers?.length === 1 ? actionData[p.action.data.triggers[0]]?.icon : "actions"} size={0.9} white />
                                            {:else if typeof p.action.data?.index === "number"}
                                                {p.action.data.index + 1}
                                            {/if}
                                        </div>
                                        <div class="action-label" style="{p.action.color ? `border-bottom: 1px solid ${p.action.color};` : ''}{type === 'slide' ? 'font-size: 0.7em;' : ''}">
                                            {#if p.action.type === "style"}
                                                {#if typeof p.action.data.value === "number"}
                                                    {parseFloat(p.action.data.value.toFixed(1))}
                                                {:else}
                                                    {p.action.data.value}
                                                {/if}
                                            {:else}
                                                {translateText(p.action.name)}
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            {/if}
                        </div>
                    {/if}

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

        {#if easingActive === null || type !== "slide"}
            <FloatingInputs side="left" style="margin-bottom: 8px;margin-left: 120px;">
                {#if disablePlayback}
                    <MaterialButton style="min-width: 40px;padding: 10px;" title={isPlaying ? "media.stop" : "media.play"} on:click={() => (isPlaying ? player.pause() : player.play())}>
                        <Icon id={isPlaying ? "stop" : "microphone"} white={!isPlaying} />
                    </MaterialButton>
                {:else}
                    <MaterialButton title={isPlaying ? "media.pause" : "media.play"} on:click={() => (isPlaying ? player.pause() : player.play())}>
                        <Icon size={1.3} id={isPlaying ? "pause" : "play"} white={!isPlaying} />
                    </MaterialButton>

                    <MaterialButton disabled={currentTime === 0} title="media.stop" on:click={() => player.stop()}>
                        <Icon size={1.3} id="stop" white={!isPlaying} />
                    </MaterialButton>
                {/if}

                {#if type === "show"}
                    <div class="divider"></div>

                    <MaterialButton disabled={isPlaying && !isRecording} title="actions.{isRecording ? 'stop_recording' : 'start_recording'}" on:click={toggleRecording} red={isRecording}>
                        <Icon size={1.3} id="record" white />
                    </MaterialButton>
                {:else if type === "slide"}
                    <div class="divider"></div>

                    <MaterialButton title={translateText("media._loop" + (shouldLoop ? ": settings.enabled" : ""), $dictionary) || "Loop"} on:click={() => (shouldLoop = timeline.toggleLoop())} active={shouldLoop}>
                        <Icon size={1.1} id="loop" white={!shouldLoop} />
                    </MaterialButton>
                {/if}

                <!-- <div class="divider" />

            <MaterialButton icon="focus" title="actions.resetZoom" on:click={resetView} /> -->
            </FloatingInputs>
        {/if}

        {#if type === "project"}
            <FloatingInputs style="margin-bottom: 8px;">
                <MaterialButton title="popup.timecode" on:click={() => activePopup.set("timecode")}>
                    <Icon id="clock" white />
                </MaterialButton>

                <div class="divider"></div>

                <MaterialButton title="popup.timeline" on:click={() => activePopup.set("timeline")}>
                    <Icon id="options" white />
                </MaterialButton>
            </FloatingInputs>
        {/if}
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

    .easing {
        background-color: var(--primary-darkest);
        border-bottom: 2px solid rgba(255, 255, 255, 0.05);
        border-top: 2px solid rgba(255, 255, 255, 0.05);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
        z-index: 198;
        overflow: visible;
    }

    .easing-control-point {
        position: absolute;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--secondary);
        cursor: pointer;
        transform: translate(-50%, -50%);
        z-index: 3;
    }

    .easing-line {
        pointer-events: none;
        z-index: 3;
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
        /* cursor: ew-resize; */
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

    .action-marker:not(.faded) > * {
        pointer-events: auto;
    }

    .action-marker.faded {
        pointer-events: none;
        opacity: 0.5;
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

        /* cursor: ew-resize; */
        font-size: 0.7em;
        font-weight: bold;
    }
    .action-marker.slide .action-head {
        border-radius: 4px;
    }
    .action-marker.style .action-head {
        border-radius: 2px;
        transform: rotate(45deg);
        width: 12px;
        height: 12px;
        font-size: 0.5em;
    }

    .slide-action-bar {
        position: absolute;
        transform: translateY(15px);
        height: 8px;
        width: 100%;

        border-radius: 4px;
        background-color: var(--secondary);
        opacity: 0.3;
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
        /* cursor: ew-resize; */
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

    /* header */

    .header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        background-color: var(--primary-darker);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* .header .tag {
        background-color: var(--secondary-opacity);
        color: var(--secondary-text);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.9em;
        white-space: nowrap;
    } */
</style>
