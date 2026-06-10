<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import type { TimelineAction } from "../../../types/Show"
    import { actionData } from "../actions/actionData"
    import Icon from "../helpers/Icon.svelte"
    import { getActionEasing, getSegmentCurve, getSegmentCurvePoints, toStoredActionEasing } from "./easingHelper"
    import type { EasingHandles } from "./easingHelper"
    import { translateText } from "../../utils/language"
    import type { TimelineActions } from "./TimelineActions"

    export let groupedActions: TimelineAction[][]
    export let actions: TimelineAction[]
    export let selectedActionIds: string[]
    export let selectedItemIndexes: number[]
    export let activeGroupIndex: number | null
    export let zoomLevel: number
    export let sectionHeight: number
    export let sectionGap: number
    export let sectionTop: number
    export let onActionDrag: (e: MouseEvent, id: string) => void
    export let timeline: TimelineActions

    const dispatch = createEventDispatcher<{ clearSelection: void }>()

    interface EasingPoint {
        id: string
        x: number
        y: number
        action: TimelineAction
    }

    let points: EasingPoint[] = []
    let easingCurvesPx: EasingHandles[] = []

    let draggingCurveIndex: number | null = null
    let draggingPin: 1 | 2 | null = null
    let dragCurveOffset = { x: 0, y: 0 }
    let contextMenuState: { curveIndex: number; pin: 1 | 2; x: number; y: number } | null = null

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
    const Y_OFFSET = 12

    $: if (activeGroupIndex !== null && groupedActions && groupedActions[activeGroupIndex]) {
        const minValue = Math.min(...groupedActions[activeGroupIndex].map((a) => (typeof a.data?.value === "number" ? a.data.value : Infinity)))
        const maxValue = Math.max(...groupedActions[activeGroupIndex].map((a) => (typeof a.data?.value === "number" ? a.data.value : -Infinity)))
        const valueRange = maxValue - minValue || 1

        points = actions
            .map((action) => {
                const correctKey = groupedActions[activeGroupIndex!][0]?.data?.key === action.data?.key
                if (!correctKey) return null
                const faded = action.type === "style" && !(action.data?.indexes ?? [0])?.some((a) => selectedItemIndexes.includes(a))
                if (faded) return null

                const top = faded ? 100 : 100 - (((typeof action.data?.value === "number" ? action.data.value : 0) - minValue) / valueRange) * 80
                return {
                    id: action.id,
                    x: (action.time / 1000) * zoomLevel,
                    y: top,
                    action
                } as EasingPoint
            })
            .filter((p): p is EasingPoint => p !== null)
            .sort((a, b) => a.action.time - b.action.time)

        easingCurvesPx = points.slice(0, -1).map((p1, i) => {
            const p2 = points[i + 1]
            const curve = getSegmentCurve(p1.action, p2.action)
            return getSegmentCurvePoints(p1, p2, curve)
        })
    } else {
        points = []
        easingCurvesPx = []
    }

    function updateStoredEasing(action: TimelineAction, updater: (easing: EasingHandles) => EasingHandles) {
        const newEasing = toStoredActionEasing(updater(getActionEasing(action)))
        timeline.updateAction(action.id, { easing: newEasing })
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
            updateStoredEasing(p2.action, (easing) => ({
                x1: clamp(easing.x1 + dx / dt, 0, 1),
                y1: clamp(easing.y1 + dy / dv, -2, 2),
                x2: easing.x2,
                y2: easing.y2
            }))
        } else {
            updateStoredEasing(p1.action, (easing) => ({
                x1: easing.x1,
                y1: easing.y1,
                x2: clamp(easing.x2 + dx / dt, 0, 1),
                y2: clamp(easing.y2 + dy / dv, -2, 2)
            }))
        }
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
            updateStoredEasing(p.action, (easing) => ({ x1: 0.5, y1: 0.5, x2: easing.x2, y2: easing.y2 }))
        } else if (pin === 2) {
            updateStoredEasing(p.action, (easing) => ({ x1: easing.x1, y1: easing.y1, x2: 0.5, y2: 0.5 }))
        }
    }

    // WIP it should update all selected points when I have multiple actions selected
    function applyCurvePinPreset(i: number, pin: 1 | 2, preset: "linear" | "ease") {
        const value = preset === "linear" ? { x: 0.5, y: 0.5 } : pin === 1 ? { x: 0.58, y: 1 } : { x: 0.42, y: 0 }

        // Apply to all visible selected points for the clicked pin type.
        // If none match (edge-case), fall back to the clicked curve target.
        const targetActionIndexes = new Set<number>()

        points.forEach((point, index) => {
            if (!selectedActionIds.includes(point.id)) return
            const pinVisible = pin === 1 ? index > 0 : index < points.length - 1
            if (pinVisible) targetActionIndexes.add(index)
        })

        if (targetActionIndexes.size === 0) {
            const fallbackIndex = pin === 1 ? i + 1 : i
            if (fallbackIndex >= 0 && fallbackIndex < points.length) {
                targetActionIndexes.add(fallbackIndex)
            }
        }

        targetActionIndexes.forEach((actionIndex) => {
            const p = points[actionIndex]
            if (!p) return

            if (pin === 1) {
                updateStoredEasing(p.action, (easing) => ({ x1: value.x, y1: value.y, x2: easing.x2, y2: easing.y2 }))
            } else if (pin === 2) {
                updateStoredEasing(p.action, (easing) => ({ x1: easing.x1, y1: easing.y1, x2: value.x, y2: value.y }))
            }
        })

        contextMenuState = null
    }

    function handleGlobalKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            contextMenuState = null
        }
    }

    function handleGlobalClick(e: MouseEvent) {
        if (contextMenuState) {
            const menu = document.querySelector(".easing-context-menu")
            if (menu && !menu.contains(e.target as Node)) {
                contextMenuState = null
            }
        }
    }

    onMount(() => {
        window.addEventListener("keydown", handleGlobalKeydown)
        return () => {
            window.removeEventListener("keydown", handleGlobalKeydown)
        }
    })

    function getLineStyle(x1: number, y1: number, x2: number, y2: number): string {
        const dx = x2 - x1
        const dy = y2 - y1
        const distance = Math.sqrt(dx * dx + dy * dy)
        const angle = Math.atan2(dy, dx) * (180 / Math.PI)
        return `position: absolute; left: ${x1}px; top: ${y1}px; width: ${distance}px; height: 1px; border-top: 1px dashed var(--secondary); transform: rotate(${angle}deg); transform-origin: 0 0; pointer-events: none; z-index: 3;`
    }
</script>

<svelte:window on:click={handleGlobalClick} />

{#if activeGroupIndex !== null && groupedActions && groupedActions[activeGroupIndex]}
    <div class="track-header easing" style="top: {sectionTop + activeGroupIndex * (sectionHeight + sectionGap) + sectionHeight}px;height: 120px;width: 100%;" on:mousedown={(e) => e.button === 0 && dispatch("clearSelection")}>
        {#if points.length > 1}
            <svg class="easing-curve-svg" style="position:absolute;left:0;top:0;width:100%;height:100%;z-index:2;" width="100%" height="100%">
                {#each points.slice(0, -1) as p, i}
                    {@const p1 = p}
                    {@const p2 = points[i + 1]}
                    {@const px = easingCurvesPx[i]}
                    <path d={`M ${p1.x},${p1.y - Y_OFFSET} C ${px.x1},${px.y1 - Y_OFFSET} ${px.x2},${px.y2 - Y_OFFSET} ${p2.x},${p2.y - Y_OFFSET}`} stroke="var(--secondary)" stroke-width="2" fill="none" opacity="0.7" style="pointer-events:none;" />
                {/each}
            </svg>

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
                                } else if (e.button === 2) {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    contextMenuState = { curveIndex: i - 1, pin: 1, x: e.clientX, y: e.clientY }
                                }
                            }}
                            on:contextmenu={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
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
                                } else if (e.button === 2) {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    contextMenuState = { curveIndex: i, pin: 2, x: e.clientX, y: e.clientY }
                                }
                            }}
                            on:contextmenu={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                            }}
                        />
                    {/if}
                {/if}
            {/each}
        {/if}

        {#each points as p}
            <div class="action-marker {p.action.type} context #timeline_node" class:selected={selectedActionIds.includes(p.action.id)} style="left: {p.x}px;top: {p.y}px;transform: translate(-50%, -50%);" on:mousedown|stopPropagation={(e) => e.button === 0 && onActionDrag(e, p.action.id)}>
                <div class="action-head">
                    {#if p.action.type === "action"}
                        <Icon id={p.action.data.triggers?.length === 1 ? actionData[p.action.data.triggers[0]]?.icon : "actions"} size={0.9} white />
                    {:else if typeof p.action.data?.index === "number"}
                        {p.action.data.index + 1}
                    {/if}
                </div>
                <div class="action-label" style="{p.action.color ? `border-bottom: 1px solid ${p.action.color};` : ''}font-size: 0.7em;">
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
    </div>
{/if}

{#if contextMenuState}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div class="easing-context-menu" style="left: {contextMenuState.x}px; top: {contextMenuState.y}px;" on:click={(e) => e.stopPropagation()}>
        <button class="easing-context-menu-item" on:click={() => applyCurvePinPreset(contextMenuState?.curveIndex ?? 0, contextMenuState?.pin ?? 1, "linear")}>
            <svg class="preset-preview" viewBox="0 0 40 24" width="40" height="24" fill="none">
                <path d="M 0,24 L 40,0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            <span>Linear</span>
        </button>
        <button class="easing-context-menu-item" on:click={() => applyCurvePinPreset(contextMenuState?.curveIndex ?? 0, contextMenuState?.pin ?? 1, "ease")}>
            <svg class="preset-preview" viewBox="0 0 40 24" width="40" height="24" fill="none">
                {#if contextMenuState.pin === 1}
                    <path d="M 0,24 C 20,0 36,0 40,0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                {:else}
                    <path d="M 0,24 C 4,24 20,24 40,0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                {/if}
            </svg>
            <span>Ease</span>
        </button>
    </div>
{/if}

<style>
    .track-header {
        position: absolute;
        left: 0;
        height: 60px;
        display: flex;
        align-items: center;
        padding-left: 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        pointer-events: auto;
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

    .easing-line {
        pointer-events: none;
        z-index: 3;
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

    .action-marker.selected .action-head {
        border-color: var(--text);
    }

    .action-label {
        margin-top: 4px;
        font-size: 0.8em;
        background: rgba(0, 0, 0, 0.5);
        padding: 2px 4px;
        border-radius: 3px;
        white-space: nowrap;
    }

    .easing-context-menu {
        position: fixed;
        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        z-index: 9999;
        min-width: 120px;
    }

    .easing-context-menu-item {
        padding: 8px 12px;
        cursor: pointer;
        font-size: 0.85em;
        transition: background-color 0.15s ease;
        user-select: none;
        border: none;
        background: none;
        color: inherit;
        font-family: inherit;
        text-align: left;
        width: 100%;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .preset-preview {
        flex-shrink: 0;
        opacity: 0.7;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background-color: var(--primary-darkest);
        border-radius: 3px;
        padding: 2px;
        box-sizing: content-box;
    }

    .easing-context-menu-item:hover .preset-preview {
        opacity: 1;
    }

    .easing-context-menu-item:hover {
        background-color: var(--hover);
        color: var(--text);
    }

    .easing-context-menu-item:first-child {
        border-radius: 3px 3px 0 0;
    }

    .easing-context-menu-item:last-child {
        border-radius: 0 0 3px 3px;
    }
</style>
