<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"

    export let variant: "contained" | "outlined" | "text" = "text"
    export let title: string = ""
    export let info: string = ""
    export let icon: string = ""
    export let iconSize: number = 1
    export let white: boolean = false
    export let isActive = false
    export let showOutline = false
    export let disabled = false
    export let gradient = false
    export let small = false
    export let tab = false
    let button

    // automatically do white icon if no content
    if (!$$slots.default) white = true

    let ripples: { x: number; y: number; size: number; id: number }[] = []

    let dispatch = createEventDispatcher()
    function click(e, double: boolean = false) {
        if (e.target?.closest(".edit")) return
        if (e.target?.closest("button") !== button) return

        const ctrl = e.ctrlKey || e.metaKey
        const shift = e.shiftKey
        const alt = e.altKey
        const doubleClick = e.detail === 2
        const target = e.target
        dispatch(double ? "dblclick" : "click", { ctrl, shift, alt, doubleClick, target })
    }

    function dblclick(e: any) {
        click(e, true)
    }

    function triggerRipple(e) {
        if (disabled) return
        if (e.target?.closest(".edit")) return
        if (e.target?.closest("button") !== button) return

        const rect = button.getBoundingClientRect()
        const size = Math.max(rect.width, rect.height)
        const x = (e.clientX ?? rect.width / 2) - rect.left - size / 2
        const y = (e.clientY ?? rect.height / 2) - rect.top - size / 2

        const ripple = {
            x,
            y,
            size,
            id: Date.now() + Math.random()
        }

        ripples = [...ripples, ripple]
    }

    function handleKey(e) {
        if (disabled) return
        if (e.key === "Enter" || e.key === " ") {
            click(e)
        }
    }

    function handleAnimationEnd(id) {
        ripples = ripples.filter((r) => r.id !== id)
    }
</script>

<button
    id={$$props.id}
    data-testid={$$props["data-testid"]}
    bind:this={button}
    class="{variant} {$$props.class || ''}"
    tabindex={disabled ? -1 : 0}
    aria-disabled={disabled}
    data-title={translateText(title)}
    class:isActive
    class:showOutline
    class:white
    class:small
    class:tab
    {disabled}
    style="
    background: {variant === 'contained' ? (gradient ? 'linear-gradient(160deg, #8000f0 0%, #9000f0 10%, #b300f0 30%, #d100db 50%, #f0008c 100%)' : 'var(--secondary)') : variant === 'outlined' ? 'var(--primary-darkest)' : 'transparent'};
    color: {variant === 'contained' ? 'var(--secondary-text)' : white ? 'var(--text)' : 'var(--text)'};
    border-color: {white ? 'rgb(255 255 255 / 0.08)' : variant === 'outlined' ? 'var(--primary-lighter)' : 'transparent'};
    {$$props.style || ''}
  "
    on:mousedown={triggerRipple}
    on:keydown={handleKey}
    on:click={click}
    on:dblclick={dblclick}
>
    {#if icon}
        <Icon id={icon} size={iconSize} white={white || isActive || variant === "contained"} />
    {/if}

    <slot />

    {#if info}
        <span class="info">{info}</span>
    {/if}

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
        /* font-size: 1.05rem; */
        font-size: 0.9em;
        font-weight: 500;
        font-family: inherit;
        border-radius: 4px;
        cursor: pointer;
        transition:
            opacity 0.4s ease,
            box-shadow 0.2s ease,
            background 0.2s ease,
            border 0.1s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        appearance: none;

        gap: 8px;
        white-space: nowrap;

        min-height: 25px;
    }
    button.small {
        padding: 0.25rem 1.25rem;
        font-size: 0.9em;
    }

    button.isActive {
        background-color: var(--primary-darkest) !important;
        /* background-color: var(--primary-lighter) !important; */
        border-bottom: 2px solid var(--secondary) !important;
        cursor: default;
    }

    button.tab.isActive {
        border: none !important;
        border-left: 4px solid var(--secondary) !important;
    }
    button.tab:not(.outlined) {
        border-left: 4px solid var(--primary-darker);
        border-radius: 0;

        justify-content: space-between;
    }

    button.showOutline {
        --outline-color: var(--secondary);
        outline: 2px solid var(--outline-color);
        outline-offset: -2px;
    }

    button:not(.contained):not(.isActive):not(:disabled):hover {
        background: rgba(255, 255, 255, 0.01) !important;
    }
    button:not(.contained):not(.isActive):not(:disabled):active {
        background: rgba(255, 255, 255, 0.04) !important;
    }
    button:not(.contained):not(.isActive):not(:disabled):active:hover {
        background: rgba(255, 255, 255, 0.06) !important;
    }
    button.contained:not(:disabled):hover {
        filter: brightness(1.05);
    }
    button.contained:not(:disabled):active {
        filter: brightness(1.09);
    }
    button.contained:not(:disabled):active:hover {
        filter: brightness(1.13);
    }

    button.contained {
        color: var(--secondary-text);
        filter: saturate(0.8);
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

    button.contained:disabled {
        background: var(--primary-lighter) !important;
    }
    button:not(.white).outlined:disabled {
        /* border-color: var(--primary-darkest) !important; */
        /* border-color: var(--text) !important; */
        color: var(--text) !important;
    }
    button:not(.white).outlined:disabled :global(svg) {
        fill: var(--text) !important;
    }

    button:hover:not(:disabled) {
        box-shadow: 0px 3px 6px rgba(0, 0, 0, 0.2);
    }

    button:focus-visible:not(:disabled) {
        outline: 2px solid var(--secondary);
        outline-offset: 2px;
    }

    button.white :global(svg) {
        fill: currentColor;
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

    .info {
        opacity: 0.7;
        font-size: 0.9em;
        margin-inline-start: 2px;
        font-weight: normal;
    }
</style>
