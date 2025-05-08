<script lang="ts">
    import { fade } from "svelte/transition"
    import { os } from "../../stores"

    export let active = false
    export let outlineColor: string | null = null
    export let outline = false
    export let title = ""
    export let flipTitlePos = false
    export let zoom = 1
    export let center = false
    export let border = false
    export let dark = false
    export let bold = true
    export let red = false
    export let redHover = false
    export let brighterHover = false

    let tooltipTime = 800
    let showTooltip = false
    let timeout: NodeJS.Timeout | null = null
    let autoHideTimeout: NodeJS.Timeout | null = null
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
        if (timeout) clearTimeout(timeout)
        timeout = null
    }

    let tooltipStyle = ""
    let mouse: { x: number; y: number } = { x: 0, y: 0 }
    function mousemove(e: any) {
        if (!title?.length) return

        startTimer()
        mouse = { x: e.clientX, y: e.clientY }
        tooltipStyle = ""

        const RIGHT_CLIP = mouse.x + 250 > window.innerWidth
        const BOTTOM_CLIP = mouse.y + 80 > window.innerHeight
        if (RIGHT_CLIP) tooltipStyle += `transform: translate(-100%, ${BOTTOM_CLIP ? "-100%" : "0"});` + (title.length > 30 ? "width: 250px;" : "white-space: nowrap;")
        else if (flipTitlePos || BOTTOM_CLIP) tooltipStyle += "transform: translateY(-100%);"
    }

    const ctrl = $os.platform === "darwin" ? "Cmd" : "Ctrl"

    // extract shortcuts in brackets "[]"
    function extractShortcuts(input: string) {
        if (typeof input !== "string") return []
        const match = input.match(/^(.+?)\s*(?:\[(.*?)\])?$/)
        return match ? match.slice(1).filter(Boolean) : [input]
    }
    let titleContent: string[] = []
    $: if (title) titleContent = extractShortcuts(title)
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
            {titleContent[0]}
            {#if titleContent[1]}<span style="display: block;font-weight: bold;text-transform: uppercase;">{titleContent[1].replace("Ctrl", ctrl)}</span>{/if}
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

        border-radius: var(--border-radius);

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
        fill: var(--text);
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
        padding-inline-start: 0.8em;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow-x: hidden;
        line-height: 150%;
    }

    button :global(svg) {
        /* padding: 0 0.5em; */
        /* padding-left: 0.2em; */
        box-sizing: content-box;
        border: 0 !important; /* remove CombinedInput border */
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
        border-radius: var(--border-radius);
        padding: 5px 10px;
        top: 0;
        left: 0; /* stylelint-disable-line */ /* this is set by mousemove */
        max-width: 250px;
        text-align: start;
        white-space: normal;
        font-weight: normal;
    }
</style>
