<script lang="ts">
    import { onMount } from "svelte"
    import { editColumns, resized, localeDirection } from "../../stores"
    import { DEFAULT_WIDTH } from "../../utils/common"
    import Icon from "../helpers/Icon.svelte"

    export let id: string
    export let side: "left" | "right" | "top" | "bottom" = "left";

    const originalSide = side;
    $: if ($localeDirection === "rtl") {
        side = originalSide === "left" ? "right" : originalSide === "right" ? "left" : originalSide;
    } else {
        side = originalSide;
    }

    let width: number = DEFAULT_WIDTH
    let handleWidth: number = 4
    export let maxWidth: number = DEFAULT_WIDTH * 2.2
    export let minWidth: number = handleWidth

    $: if (!mouse && $resized[id]) width = $resized[id]

    let loaded = false
    onMount(() => {
        setTimeout(() => {
            width = $resized[id] ?? DEFAULT_WIDTH
            // reset to default if closed on startup
            if ((id === "leftPanel" || id === "rightPanel") && width <= handleWidth) width = DEFAULT_WIDTH
            loaded = true
        }, 2000)
    })

    let move: boolean = false
    let mouse: null | { x: number; y: number; offset: number; target: any } = null

    $: handleWidth = width <= 8 ? 6 : 4

    const conditions = {
        left: (e: any) => e.target.closest(".panel")?.offsetWidth - e.offsetX <= handleWidth,
        right: (e: any) => e.clientX < e.target.closest(".panel")?.offsetLeft + handleWidth && e.offsetX <= handleWidth && e.offsetX >= 0,
        // top: (e: any) => e.target.closest(".panel")?.offsetHeight - e.offsetY <= handleWidth,
        top: (e: any) => e.clientY < e.target.closest(".panel")?.offsetTop + handleWidth && e.offsetY <= handleWidth && e.offsetY >= 0,
        bottom: (e: any) => e.clientY < e.target.closest(".panel")?.offsetTop + e.target.closest(".panel")?.offsetParent.offsetTop + handleWidth && e.offsetY <= handleWidth && e.offsetY >= 0,
    }

    function mousedown(e: any) {
        if (!conditions[side](e)) return

        mouse = {
            x: e.clientX,
            y: e.clientY,
            offset: side === "top" || side === "bottom" ? window.innerHeight - width - e.clientY : window.innerWidth - width - e.clientX,
            target: e.target,
        }
    }

    const widths = {
        left: (e: any) => e.clientX,
        right: (e: any) => window.innerWidth - e.clientX - mouse!.offset,
        top: (e: any) => e.clientY,
        bottom: (e: any) => window.innerHeight - e.clientY - mouse!.offset,
    }

    function getWidth(width: number) {
        if (width < (DEFAULT_WIDTH * 0.6) / 2) return minWidth
        if (width < DEFAULT_WIDTH * 0.6) return DEFAULT_WIDTH * 0.6
        if (width > DEFAULT_WIDTH - 20 && width < DEFAULT_WIDTH + 20) return DEFAULT_WIDTH
        if (width > maxWidth) return maxWidth
        move = true
        return width
    }

    function mousemove(e: any) {
        if (mouse) width = getWidth(widths[side](e))
    }

    let storeWidth: null | number = null
    function click(e: any) {
        if (move || !conditions[side](e)) {
            move = false
            return
        }

        if (width > minWidth) {
            // don't click to close, only to open (to prevent accidentally closing without knowing)
            // storeWidth = width
            // width = minWidth
            return
        }

        width = storeWidth === null || storeWidth < DEFAULT_WIDTH / 2 ? DEFAULT_WIDTH : storeWidth
        storeWidth = null
    }

    $: if (width !== null) storeValue()
    function storeValue() {
        if (!loaded) return

        resized.update((a) => {
            a[id] = width
            return a
        })

        if (side === 'left') {
            let gap = maxWidth - DEFAULT_WIDTH
            let triple = DEFAULT_WIDTH + gap * 0.8
            let double = DEFAULT_WIDTH + gap * 0.4
            if (width > triple && $editColumns === 2) {
                editColumns.set(3)
            } else if (width > double && width < triple && ($editColumns === 1 || $editColumns === 3)) {
                editColumns.set(2)
            } else if (width <= double && $editColumns === 2) {
                editColumns.set(1)
            }
        }
    }

    function mouseup(e: any) {
        mouse = null
        if (!e.target.closest(".panel")) move = false
    }
</script>

<svelte:window on:mouseup={mouseup} on:mousemove={mousemove} />

<div {id} style="{side === 'left' || side === 'right' ? 'width' : 'height'}: {width}px; --handle-width: {handleWidth}px" class="panel bar_{side}" class:zero={width <= handleWidth} on:mousedown={mousedown} on:click={click}>
    {#if width <= handleWidth}
        <Icon id="arrow_right" size={1.3} white />
    {/if}

    <slot {width} />
</div>

<style>
    div {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
        position: relative;
        /* background: var(--primary); */
    }

    :global(.bar_left) {
        padding-inline-end: var(--handle-width);
        /* border-radius: 0 var(--border-radius) var(--border-radius) 0; */
        /* box-shadow: 2px 0 14px rgb(0 0 0 / 0.12); */
    }
    :global(.bar_right) {
        padding-inline-start: var(--handle-width);
        /* border-radius: var(--border-radius) 0 0 var(--border-radius); */
        /* box-shadow: -2px 0 14px rgb(0 0 0 / 0.12); */
    }
    :global(.bar_top) {
        padding-bottom: var(--handle-width);
        /* box-shadow: 0 2px 14px rgb(0 0 0 / 0.12); */
    }
    :global(.bar_bottom) {
        padding-top: var(--handle-width);
        /* box-shadow: 0 -2px 14px rgb(0 0 0 / 0.12); */
    }

    div::after {
        content: "";
        background-color: var(--primary-lighter);
        position: absolute;
        width: 100%;
        height: 100%;
    }
    .zero::after {
        /* background-color: var(--secondary); */
        background-color: var(--primary-lighter);
    }
    .zero :global(svg) {
        pointer-events: none;

        z-index: 1;
        position: absolute;
        top: 50%;

        inset-inline-start: 50%;
        transform: translate(-50%, -50%);

        /* right: 0;
        transform: translate(62%, -50%); */
    }
    .bar_right.zero :global(svg) {
        transform: translate(-50%, -50%) rotate(180deg);

        /* right: unset;
        left: 0;
        transform: translate(-62%, -50%) rotate(180deg); */
    }

    div:global(.bar_left)::after {
        right: 0; /* stylelint-disable-line */
        width: var(--handle-width);
        cursor: ew-resize;
    }
    div:global(.bar_right)::after {
        left: 0; /* stylelint-disable-line */
        width: var(--handle-width);
        cursor: ew-resize;
    }
    div:global(.bar_top)::after {
        bottom: 0;
        height: var(--handle-width);
        cursor: ns-resize;
    }
    div:global(.bar_bottom)::after {
        top: 0;
        height: var(--handle-width);
        cursor: ns-resize;
    }
</style>
