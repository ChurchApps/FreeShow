<script lang="ts">
    import { fade } from "svelte/transition"

    export let active: boolean = false
    export let outlineColor: string | null = null
    export let outline: boolean = false
    export let title: string = ""
    export let zoom: number = 1
    export let center: boolean = false
    export let border: boolean = false
    export let dark: boolean = false
    export let bold: boolean = true
    export let red: boolean = false
    export let redHover: boolean = false
    export let brighterHover: boolean = false

    let tooltipTime: number = 800
    let showTooltip: boolean = false
    let timeout: any = null
    let autoHideTimeout: any = null
    function startTimer() {
        if (timeout || !title?.length) return

        if (autoHideTimeout) clearTimeout(autoHideTimeout)
        timeout = setTimeout(() => {
            showTooltip = true
            timeout = null
            if (document)
                // hide after 5 seconds
                autoHideTimeout = setTimeout(() => {
                    if (!timeout) showTooltip = false
                    autoHideTimeout = null
                }, 5000)
        }, tooltipTime)
    }

    $: if ($$props.disabled) hideTooltip()
    function hideTooltip() {
        showTooltip = false
        clearTimeout(timeout)
        timeout = null
    }

    let tooltipStyle: string = ""
    let mouse: any = { x: 0, y: 0 }
    function mousemove(e: any) {
        if (!title?.length) return
        startTimer()
        mouse = { x: e.clientX, y: e.clientY }
        if (mouse.x + 250 > window.innerWidth) tooltipStyle += "transform: translateX(-100%);"
        if (mouse.y + 80 > window.innerHeight) tooltipStyle += "transform: translateY(-100%);"
    }
</script>

<button
    on:mousemove={mousemove}
    on:mousedown={hideTooltip}
    on:mouseleave={hideTooltip}
    id={$$props.id}
    data-testid={$$props["data-testid"]}
    style="{outlineColor ? 'outline-offset: -2px;outline: 2px solid ' + outlineColor + ' !important;' : ''}{$$props.style || ''}"
    class:active
    class:outline
    class:center
    class:border
    class:bold
    class:dark
    class:red
    class:redHover
    class:brighterHover
    class={$$props.class}
    on:click
    on:dblclick
    disabled={$$props.disabled}
    tabindex={active ? -1 : 0}
>
    {#if showTooltip}
        <div class="tooltip" transition:fade={{ duration: 200 }} style="left: {mouse.x}px;top: {mouse.y}px;{tooltipStyle};zoom: {1 / zoom};">
            {title}
        </div>
    {/if}
    <slot />
</button>

<style>
    button {
        position: relative;
        background-color: inherit;
        color: inherit;
        font-family: inherit;
        /* font-size: inherit; */
        font-size: 0.9em;
        border: none;
        display: flex;
        align-items: center;
        padding: 0.2em 0.8em;

        transition:
            background-color 0.2s,
            border 0.2s;
    }
    button.dark {
        background-color: var(--primary-darker);
    }
    button.center {
        justify-content: center;
        text-align: center;
    }
    button.center :global(p) {
        text-align: center;
    }
    button.bold {
        font-weight: 600;
        letter-spacing: 0.5px;
        padding: 0.3em 0.8em;
        /* text-transform: uppercase; */
    }

    /* red */
    button.red:not(:disabled) {
        background-color: rgb(255 0 0 / 0.25);
    }
    button.red:hover:not(:disabled):not(.active) {
        background-color: rgb(255 0 0 / 0.35);
    }
    button.red:active:not(:disabled):not(.active),
    button.red:focus:not(:disabled):not(.active) {
        background-color: rgb(255 0 0 / 0.3);
    }
    button.red:not(:disabled) :global(svg) {
        fill: white;
    }

    button:not(:disabled):not(.active) {
        cursor: pointer;
    }
    button:hover:not(:disabled):not(.active) {
        background-color: var(--hover);
    }
    button:hover.brighterHover:not(:disabled):not(.active) {
        background-color: rgb(255 255 255 / 0.3);
    }
    button:hover.redHover:not(:disabled):not(.active) {
        background-color: rgb(255 0 0 / 0.3);
    }
    button:active:not(:disabled):not(.active),
    button:focus:not(.active) {
        background-color: var(--focus);
    }
    button.active {
        /* background-color: var(--secondary-opacity); */
        /* background-color: var(--primary-darkest); */
        background-color: var(--primary-darker);
        color: var(--secondary-text);
        outline: none;
    }
    button.dark.active {
        background-color: var(--primary-darkest);
    }
    button.active.border {
        outline-offset: -2px;
        /* outline: 2px solid var(--secondary); */
        outline: 2px solid var(--primary-lighter);
    }

    button.outline {
        outline-offset: -2px;
        outline: 2px solid var(--secondary) !important;
    }

    button :global(div) {
        padding-left: 0.8em;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow-x: hidden;
        line-height: 150%;
    }

    button :global(svg) {
        /* padding: 0 0.5em; */
        /* padding-left: 0.2em; */
        box-sizing: content-box;
    }
    button.active :global(svg) {
        fill: var(--text);
    }

    button:disabled {
        opacity: 0.5;
        /* this is to prevent interfearing with mouse event listeners */
        pointer-events: none;
    }

    /* tooltip */
    /* WIP clipping on right side & placed under (Slice icons) */
    button:hover > .tooltip {
        /* display: block; */
        display: table;
    }
    .tooltip {
        z-index: 30;
        pointer-events: none;
        position: fixed;
        background-color: var(--primary-darkest);
        border: 2px solid var(--primary-lighter);
        padding: 5px 10px;
        top: 0;
        left: 0;
        max-width: 250px;
        text-align: left;
        white-space: normal;
    }
</style>
