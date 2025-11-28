<script lang="ts">
    import { onMount } from "svelte"
    import { resized } from "../../../../util/stores"
    import Icon from "../../../../../common/components/Icon.svelte"

    export let id: string
    export let side: "left" | "right" | "top" | "bottom" = "left"

    const DEFAULT_WIDTH = 260
    // Visual handle stays thin, but touch target is larger
    const VISUAL_HANDLE = 4
    const TOUCH_TARGET = 20 // Invisible larger touch area

    let width: number = DEFAULT_WIDTH
    let handleWidth = VISUAL_HANDLE
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
        }, 500)
    })

    let move = false
    let mouse: null | { x: number; y: number; offset: number; target: any } = null

    $: handleWidth = width <= 8 ? 6 : 4

    const conditions = {
        left: (e: any) => {
            const panel = e.target.closest(".panel")
            if (!panel) return false
            const panelWidth = panel.offsetWidth
            // Larger invisible touch area for easier grabbing
            return panelWidth - e.offsetX <= TOUCH_TARGET
        },
        right: (e: any) => {
            const panel = e.target.closest(".panel")
            if (!panel) return false
            return e.clientX < panel.offsetLeft + TOUCH_TARGET && e.offsetX <= TOUCH_TARGET && e.offsetX >= 0
        },
        top: (e: any) => {
            const panel = e.target.closest(".panel")
            if (!panel) return false
            return e.clientY < panel.offsetTop + TOUCH_TARGET && e.offsetY <= TOUCH_TARGET && e.offsetY >= 0
        },
        bottom: (e: any) => {
            const panel = e.target.closest(".panel")
            if (!panel || !panel.offsetParent) return false
            return e.clientY < panel.offsetTop + panel.offsetParent.offsetTop + TOUCH_TARGET && e.offsetY <= TOUCH_TARGET && e.offsetY >= 0
        }
    }

    function pointerdown(e: PointerEvent) {
        if (!conditions[side](e)) return
        e.preventDefault()
        
        // Capture pointer for touch devices
        const target = e.target as HTMLElement
        target.setPointerCapture?.(e.pointerId)

        mouse = {
            x: e.clientX,
            y: e.clientY,
            offset: side === "top" || side === "bottom" ? window.innerHeight - width - e.clientY : window.innerWidth - width - e.clientX,
            target: e.target
        }
        
        window.addEventListener("pointermove", pointermove)
        window.addEventListener("pointerup", pointerup)
        window.addEventListener("pointercancel", pointerup)
    }

    // Legacy mouse support
    function mousedown(e: any) {
        if (!conditions[side](e)) return

        mouse = {
            x: e.clientX,
            y: e.clientY,
            offset: side === "top" || side === "bottom" ? window.innerHeight - width - e.clientY : window.innerWidth - width - e.clientX,
            target: e.target
        }
    }

    const widths = {
        left: (e: any) => e.clientX,
        right: (e: any) => window.innerWidth - e.clientX - mouse!.offset,
        top: (e: any) => e.clientY,
        bottom: (e: any) => window.innerHeight - e.clientY - mouse!.offset
    }

    const MIN_WIDTH = 0.69
    function getWidth(width: number) {
        if (width < (DEFAULT_WIDTH * MIN_WIDTH) / 2) return minWidth
        if (width < DEFAULT_WIDTH * MIN_WIDTH) return DEFAULT_WIDTH * MIN_WIDTH
        if (width > DEFAULT_WIDTH - 20 && width < DEFAULT_WIDTH + 20) return DEFAULT_WIDTH
        if (width > maxWidth) return maxWidth
        move = true
        return width
    }

    function pointermove(e: PointerEvent) {
        if (mouse) {
            e.preventDefault()
            width = getWidth(widths[side](e))
        }
    }

    function pointerup(e: PointerEvent) {
        const target = e.target as HTMLElement
        target.releasePointerCapture?.(e.pointerId)
        mouse = null
        move = false
        window.removeEventListener("pointermove", pointermove)
        window.removeEventListener("pointerup", pointerup)
        window.removeEventListener("pointercancel", pointerup)
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
            return
        }

        width = storeWidth === null || storeWidth < DEFAULT_WIDTH / 2 ? DEFAULT_WIDTH : storeWidth
        storeWidth = null
    }

    $: if (width !== null) storeValue()
    function storeValue() {
        if (!loaded) return

        resized.update(a => {
            a[id] = width
            return a
        })
    }

    function mouseup(e: any) {
        mouse = null
        if (!e.target.closest(".panel")) move = false
    }
</script>

<svelte:window on:mouseup={mouseup} on:mousemove={mousemove} />

<div {id} style="{side === 'left' || side === 'right' ? 'width' : 'height'}: {width}px; --handle-width: {handleWidth}px" class="panel bar_{side}" class:zero={width <= handleWidth} on:pointerdown={pointerdown} on:mousedown={mousedown} on:click={click}>
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
        outline: none;
    }

    :global(.bar_left) {
        padding-inline-end: var(--handle-width);
    }
    :global(.bar_right) {
        padding-inline-start: var(--handle-width);
    }
    :global(.bar_top) {
        padding-bottom: var(--handle-width);
    }
    :global(.bar_bottom) {
        padding-top: var(--handle-width);
    }

    div::after {
        content: "";
        background-color: var(--primary-lighter);
        position: absolute;
        width: 100%;
        height: 100%;
    }
    .zero::after {
        background-color: var(--primary-lighter);
    }
    .zero :global(svg) {
        pointer-events: none;
        z-index: 1;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }
    .bar_right.zero :global(svg) {
        transform: translate(-50%, -50%) rotate(180deg);
    }

    div:global(.bar_left)::after {
        right: 0;
        width: var(--handle-width);
        cursor: ew-resize;
    }
    div:global(.bar_right)::after {
        left: 0;
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

    /* Touch-friendly - larger invisible hit area, visual stays thin */
    div {
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
    }
</style>
