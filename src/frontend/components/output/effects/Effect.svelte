<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import type { Effect } from "../../../../types/Effects"
    import { activeEdit, activePage, currentWindow, effects } from "../../../stores"
    import { clone, getChangedKeys } from "../../helpers/array"
    import { EffectRender } from "./effectRenderer"

    export let effect: Effect & { id?: string }
    export let preview = false
    export let edit = false

    let items: any[]
    $: items = effect?.items || [] // .filter((a) => !a.hidden)

    let canvasElem: HTMLCanvasElement | undefined
    let renderer: any
    let mounted = false
    onMount(() => {
        if (!canvasElem) return

        renderer = new EffectRender(canvasElem, items, preview)
        // renderer.dayNightCycle = { speed: 15 }

        previousItems = clone(items)
        mounted = true
        // return () => renderer.stop()
    })

    $: style = `${effect.style};background: ${effect.background};opacity: ${effect.opacity ?? 1};`
    $: if (style && canvasElem) canvasElem.style = style

    onDestroy(() => {
        renderer?.stop()
    })

    const fullReloadTypes = ["stars", "galaxy"]
    const fullReloadKeys = ["count", "color", "flareDiscNum"]
    const fullReloadKeysSpecific = {
        rain: ["length", "width"],
        city: ["height", "width"],
        grass: ["height", "speed"]
    }
    let previousItems: any[] = []
    $: if (items) update()
    function update() {
        if (!renderer || !canvasElem || !mounted) return

        // find out which key has changed
        let _changedKeys = getChangedKeys(
            items.filter((a) => !a.hidden),
            previousItems.filter((a) => !a.hidden)
        )

        if (!edit && $activePage === "edit" && $activeEdit.type === "effect") {
            // item added or removed
            if (items.length !== previousItems.length) {
                renderer?.stop()
                renderer = new EffectRender(canvasElem, items, preview)
                previousItems = clone(items)
            }
            return
        }

        const changedKeys = _changedKeys.filter((a) => a.key !== "x" && a.key !== "y" && a.key !== "offset")

        if (_changedKeys.length && !changedKeys.length && !$currentWindow) return

        previousItems = clone(items)
        const itemType = effect.items[changedKeys[0]?.index]?.type
        if (changedKeys.length === 1 && !fullReloadTypes.includes(itemType) && !fullReloadKeys.includes(changedKeys[0].key) && !fullReloadKeysSpecific[itemType]?.includes(changedKeys[0].key)) return

        if (preview) {
            renderer?.stop()
            renderer = new EffectRender(canvasElem, items, preview)
        } else {
            renderer.updateItems(items, !changedKeys.length)
        }
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

    const basicMove = ["circle", "rectangle", "triangle", "galaxy", "sun", "lens_flare", "spotlight", "neon", "asset"]
    const verticalMove = ["aurora", "fog", "fireworks", "city", "grass", "rainbow"]

    function mousemove(e: any) {
        if (!pressed || movedIndex < 0) return

        const parentSlide = e.target?.closest(".slide")
        const center = e.target?.closest(".editArea")?.closest(".center")
        if (!parentSlide || !center) return

        const mouseX = e.clientX - parentSlide.offsetLeft - center.offsetLeft
        const mouseY = e.clientY - parentSlide.offsetTop - center.offsetTop

        const x = Math.max(0, mouseX / parentSlide.clientWidth)
        const y = Math.max(0, mouseY / parentSlide.clientHeight)

        effects.update((a) => {
            const item: any = a[effect.id!].items[movedIndex]

            if (basicMove.includes(item.type)) {
                item.x = x
                item.y = y
            } else if (item.type === "wave") {
                if (item.side === "left") item.offset = x
                else if (item.side === "right") item.offset = 1 - x
                else if (item.side === "top") item.offset = y
                else item.offset = 1 - y
            } else if (verticalMove.includes(item.type)) {
                if (item.type === "fireworks" || item.type === "city") item.offset = 1 - y
                else item.offset = y
            }

            return a
        })
    }

    function getTopOffset(item: any) {
        if (item.type === "aurora") return item.offset ?? 0.2
        if (item.type === "fog") return item.offset ?? 0.3
        if (item.type === "fireworks") return 1 - (item.offset ?? 0.7)
        if (item.type === "city") return 1 - (item.offset ?? 0)
        if (item.type === "grass") return item.offset ?? 1
        if (item.type === "rainbow") return item.offset ?? 0.2
        return item.offset ?? 0.5
    }
</script>

<svelte:window on:mousemove={mousemove} on:mouseup={mouseup} />

<canvas bind:this={canvasElem}></canvas>

<!-- move boxes -->
{#if edit}
    {#each items as item, i}
        {#if !item.hidden}
            {#if basicMove.includes(item.type)}
                <div class="mover" style="left: {item.x * 100}%;top: {item.y * 100}%;" on:mousedown={() => mousedown(i)}></div>
            {:else if item.type === "wave"}
                {#if item.side === "left" || item.side === "right"}
                    <div class="mover" style="left: {(item.side === 'left' ? item.offset : 1 - item.offset) * 100}%;width: 12px;height: 50px;" on:mousedown={() => mousedown(i)}></div>
                {:else}
                    <div class="mover" style="top: {(item.side === 'top' ? item.offset : 1 - item.offset) * 100}%;width: 50px;height: 12px;" on:mousedown={() => mousedown(i)}></div>
                {/if}
            {:else if verticalMove.includes(item.type)}
                <div class="mover" style="top: {getTopOffset(item) * 100}%;width: 50px;height: 12px;" on:mousedown={() => mousedown(i)}></div>
            {/if}
        {/if}
    {/each}
{/if}

<style>
    canvas {
        width: 100%;
        height: 100%;

        background: transparent;

        border: none;
    }

    .mover {
        position: absolute;
        transform: translate(-50%, -50%);

        inset-inline-start: 50%;
        top: 50%;

        min-width: 10px;
        min-height: 10px;
        width: 30px;
        height: 30px;

        cursor: move;
        /* background-color: rgba(37, 186, 197, 0.3); */
        background-color: var(--secondary);
        border: 2px solid white;
    }
</style>
