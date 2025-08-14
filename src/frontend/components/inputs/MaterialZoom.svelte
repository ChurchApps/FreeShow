<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { slide } from "svelte/transition"
    import { uid } from "uid"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "./MaterialButton.svelte"

    export let columns: number
    export let defaultValue: number = 4
    export let min: number = 2
    export let max: number = 10
    export let hidden: boolean = false

    let zoomOpened = false
    function mousedown(e: any) {
        if (e.target.closest(".zoom_popup") || e.target.closest("button")) return

        zoomOpened = false
    }

    // 50ms debounce for responsive column adjustments
    // const debouncedColumnUpdate = debounce((newValue: number) => dispatch("change", newValue), { wait: 50 })

    const dispatch = createEventDispatcher()
    function update(value: number) {
        const newValue = Math.max(min, Math.min(max, value))
        dispatch("change", newValue)
        // debouncedColumnUpdate(newValue)
    }

    function increase() {
        update(columns + 1)
    }
    function decrease() {
        update(columns - 1)
    }
    function reset() {
        update(defaultValue)
    }

    // WHEEL

    const currentId = "zoom_" + uid()

    let nextScrollTimeout: NodeJS.Timeout | null = null
    function wheel(e: any) {
        if (
            !e.target?.querySelector("#" + currentId) &&
            !e.target?.closest(".center")?.querySelector("#" + currentId) &&
            !e.target
                ?.closest(".scroll")
                ?.closest(".main")
                ?.querySelector("#" + currentId)
        )
            return

        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout) return

        const direction = e.deltaY < 0 ? -1 : 1
        update(columns + direction)

        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }
</script>

<svelte:window on:mousedown={mousedown} on:wheel={wheel} />

<div id={currentId} class="zoom_container" class:hidden>
    <MaterialButton style="width: 100%;height: 100%;" on:click={() => (zoomOpened = !zoomOpened)} title="actions.zoom">
        <Icon size={1.3} id="zoomIn" white={!zoomOpened} />
    </MaterialButton>

    {#if zoomOpened}
        <div class="overflow zoom_popup" transition:slide={{ duration: 150 }}>
            <MaterialButton style="padding: 0 !important;" on:click={reset} bold={false} center>
                <p class="text" data-title={translateText("actions.resetZoom")}>{(100 / columns).toFixed()}%</p>
            </MaterialButton>

            <div class="divider"></div>

            <MaterialButton disabled={columns <= min} on:click={decrease} title="actions.zoomIn" center>
                <Icon size={1.3} id="add" white />
            </MaterialButton>
            <MaterialButton disabled={columns >= max} on:click={increase} title="actions.zoomOut" center>
                <Icon size={1.3} id="remove" white />
            </MaterialButton>
        </div>
    {/if}
</div>

<style>
    .zoom_container {
        position: relative;
        width: var(--size);
    }
    .hidden {
        display: none;
    }

    .text {
        opacity: 0.7;
        font-size: 0.8em;
        font-weight: normal;
    }

    .zoom_container .divider {
        width: 100%;
        height: 1px;
        background-color: var(--primary-lighter);
    }

    .zoom_popup {
        position: absolute;
        inset-inline-end: 0;
        top: 0;
        transform: translateY(-100%);
        overflow: hidden;

        background-color: var(--primary-darkest);

        display: flex;
        flex-direction: column;

        width: 100%;

        border: 1px solid var(--primary-lighter);
        border-top-left-radius: 50px;
        border-top-right-radius: 50px;

        z-index: 2;
    }
</style>
