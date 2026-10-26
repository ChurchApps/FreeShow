<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { get } from "svelte/store"
    import { playingVideoState } from "../../../stores"
    import type { MediaStyle } from "../../../../types/Main"
    import { addMediaSlot, removeMediaSlot, type MediaSlot } from "./mediaLayers"

    // Where a background video would be: the capture worker draws it here (see mediaLayers.ts). An offscreen
    // page only paints when something in it changed, so a 1px canvas is redrawn on every frame of the source.
    export let outputId: string
    export let path: string
    export let mediaStyle: MediaStyle = {}
    export let startAt = 0

    const dispatch = createEventDispatcher()
    let el: HTMLDivElement
    let canvas: HTMLCanvasElement
    let ctx: CanvasRenderingContext2D | null = null
    let flip = false
    let loaded = false
    let slot: MediaSlot | null = null

    function onTick() {
        if (!loaded) {
            // the first frame of the source: the background can start its transition now
            loaded = true
            dispatch("loaded")
        }
        if (!ctx) ctx = canvas?.getContext("2d") || null
        if (!ctx) return
        flip = !flip
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = flip ? "rgba(0,0,0,0.004)" : "rgba(0,0,0,0.008)"
        ctx.fillRect(0, 0, 1, 1)
    }

    onMount(() => {
        const state = get(playingVideoState)[`${path}_${outputId}`]
        const clock = state && !state.paused ? Date.now() - (state.currentTime || 0) * 1000 : null
        slot = { el, outputId, path, mediaStyle, startAt: startAt || 0, clock, onTick }
        addMediaSlot(slot)
    })
    onDestroy(() => {
        if (slot) removeMediaSlot(slot)
    })
</script>

<div class="slot" bind:this={el}>
    <canvas bind:this={canvas} data-source={path} width="1" height="1" />
</div>

<style>
    .slot {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }
    canvas {
        position: absolute;
        left: 0;
        top: 0;
        width: 1px;
        height: 1px;
    }
</style>
