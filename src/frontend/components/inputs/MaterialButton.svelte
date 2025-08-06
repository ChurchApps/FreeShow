<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import Icon from "../helpers/Icon.svelte"
    import { fade } from "svelte/transition"
    import { os } from "../../stores"

    export let variant: "contained" | "outlined" | "text" = "contained"
    export let title: string = ""
    export let zoom = 1 // slide zoom ratio
    export let icon: string = ""
    export let white: boolean = false
    export let disabled = false
    let button

    let ripples: { x: number; y: number; size: number; id: number }[] = []

    let dispatch = createEventDispatcher()
    function click() {
        dispatch("click")
    }

    function triggerRipple(event) {
        if (disabled) return

        const rect = button.getBoundingClientRect()
        const size = Math.max(rect.width, rect.height)
        const x = (event.clientX ?? rect.width / 2) - rect.left - size / 2
        const y = (event.clientY ?? rect.height / 2) - rect.top - size / 2

        const ripple = {
            x,
            y,
            size,
            id: Date.now() + Math.random()
        }

        ripples = [...ripples, ripple]
    }

    function handleKey(event) {
        if (disabled) return
        if (event.key === "Enter" || event.key === " ") {
            click()
        }
    }

    function handleAnimationEnd(id) {
        ripples = ripples.filter((r) => r.id !== id)
    }

    // TOOLTIP TITLE

    let tooltipTime = 800
    let showTooltip = false
    let flipTitlePos = false
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
    bind:this={button}
    class="{variant} {$$props.class}"
    tabindex={disabled ? -1 : 0}
    aria-disabled={disabled}
    {disabled}
    style="
    background-color: {variant === 'contained' ? 'var(--secondary)' : 'transparent'};
    color: {white ? 'var(--text)' : variant === 'contained' ? 'var(--secondary-text)' : 'var(--secondary)'};
    border-color: {white ? 'rgb(255 255 255 / 0.08)' : variant === 'outlined' ? 'var(--secondary)' : 'transparent'};
  "
    on:mousedown={triggerRipple}
    on:keydown={handleKey}
    on:click={click}
    on:mousemove={mousemove}
    on:mousedown={hideTooltip}
    on:mouseleave={hideTooltip}
>
    {#if showTooltip}
        <div class="tooltip" transition:fade={{ duration: 200 }} style="left: {mouse.x}px;top: {mouse.y}px;{tooltipStyle};zoom: {1 / zoom};">
            {titleContent[0]}
            {#if titleContent[1]}<span style="display: block;font-weight: bold;text-transform: uppercase;">{titleContent[1].replace("Ctrl", ctrl).replaceAll("+", " + ")}</span>{/if}
        </div>
    {/if}

    {#if icon}
        <Icon id={icon} {white} />
    {/if}

    <slot />
    {#each ripples as { x, y, size, id } (id)}
        <span class="ripple" style="top: {y}px; left: {x}px; width: {size}px; height: {size}px;" on:animationend={() => handleAnimationEnd(id)} />
    {/each}
</button>

<style>
    button {
        position: relative;
        overflow: hidden;
        outline: none;
        border: none;
        padding: 0.75rem 1.25rem;
        font-size: 1.05rem;
        font-weight: 500;
        font-family: inherit;
        border-radius: 4px;
        cursor: pointer;
        transition:
            box-shadow 0.2s ease,
            background-color 0.2s ease,
            border 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        appearance: none;

        gap: 8px;
        white-space: nowrap;
    }

    button:not(.contained):hover {
        background-color: rgba(255, 255, 255, 0.01) !important;
    }

    button:not(.contained):active {
        background-color: rgba(255, 255, 255, 0.04) !important;
    }

    button.contained {
        color: var(--text);
    }

    button.outlined {
        background: transparent;
        border: 1px solid currentColor;
    }

    button.text {
        background: transparent;
        color: inherit;
    }

    button:disabled {
        opacity: 0.5;
        pointer-events: none;
    }

    button:hover {
        box-shadow: 0px 3px 6px rgba(0, 0, 0, 0.2);
    }

    button:focus-visible {
        outline: 2px solid var(--secondary);
        outline-offset: 2px;
    }

    .ripple {
        position: absolute;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.25);
        transform: scale(0);
        animation: ripple 600ms ease-out forwards;
        pointer-events: none;
        will-change: transform, opacity;
    }

    @keyframes ripple {
        to {
            transform: scale(2.5);
            opacity: 0;
        }
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
