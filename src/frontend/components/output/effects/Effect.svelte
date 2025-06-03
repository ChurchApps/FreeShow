<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import type { Effect } from "../../../../types/Effects"
    import { EffectRender } from "./effectRenderer"
    import { effects } from "../../../stores"

    export let effect: Effect & { id?: string }
    export let preview: boolean = false
    export let ratio: number = 1
    export let edit: boolean = false
    console.log(ratio)

    let items: any[]
    $: items = effect?.items || []

    let canvasElem: HTMLCanvasElement | undefined
    let renderer: any
    let mounted = false
    onMount(() => {
        if (!canvasElem) return

        canvasElem.style = effect.style

        renderer = new EffectRender(canvasElem, items, preview)
        // renderer.dayNightCycle = { speed: 15 }

        mounted = true
        // return () => renderer.stop()
    })

    onDestroy(() => {
        renderer?.stop()
    })

    $: if (items) update()
    function update() {
        if (!renderer || !canvasElem || !mounted || preview) return

        // renderer?.stop()
        // renderer = new EffectRender(canvasElem, items, preview)
        renderer.updateItems(items)
    }

    let pressed = false
    let movedIndex = -1
    function mousedown(itemIndex: number) {
        pressed = true
        movedIndex = itemIndex
    }

    function mouseup() {
        pressed = false
        movedIndex = -1
    }

    function mousemove(e: any) {
        if (!pressed || movedIndex < 0) return

        const parentSlide = e.target?.closest(".slide")
        const center = e.target?.closest(".editArea")?.closest(".center")
        if (!parentSlide || !center) return

        const mouseX = e.clientX - parentSlide.offsetLeft - center.offsetLeft
        const mouseY = e.clientY - parentSlide.offsetTop - center.offsetTop

        const x = mouseX / parentSlide.clientWidth
        const y = mouseY / parentSlide.clientHeight

        effects.update((a) => {
            const item = a[effect.id!].items[movedIndex]

            if (item.type === "shape") {
                ;(item as any).x = x
                ;(item as any).y = y
            } else if (item.type === "wave") {
                ;(item as any).offset = 1 - y
            }

            return a
        })
    }
</script>

<svelte:window on:mousemove={mousemove} on:mouseup={mouseup} />

<canvas bind:this={canvasElem}></canvas>

<!-- move boxes -->
{#if edit}
    {#each items as item, i}
        {#if item.type === "shape"}
            <div class="mover" style="left: {item.x * 100}%;top: {item.y * 100}%;width: {item.size * 0.5}px;height: {item.size * 0.5}px;" on:mousedown={() => mousedown(i)}></div>
        {:else if item.type === "wave"}
            <div class="mover" style="top: {(1 - item.offset) * 100}%;width: 50px;height: 12px;" on:mousedown={() => mousedown(i)}></div>
        {/if}
    {/each}
{/if}

<style>
    canvas {
        background: transparent;

        border: none;
    }

    .mover {
        position: absolute;
        transform: translate(-50%, -50%);

        left: 50%;
        top: 50%;

        min-width: 10px;
        min-height: 10px;

        cursor: move;
        /* background-color: rgba(37, 186, 197, 0.3); */
        background-color: var(--secondary);
        border: 2px solid white;
    }
</style>
