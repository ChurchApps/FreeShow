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
    export let disabled = false
    export let gradient = false
    let button

    // automatically do white icon if no content
    if (!$$slots.default) white = true

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
</script>

<button
    data-testid={$$props["data-testid"]}
    bind:this={button}
    class="{variant} {$$props.class}"
    tabindex={disabled ? -1 : 0}
    aria-disabled={disabled}
    data-title={translateText(title)}
    class:white
    {disabled}
    style="
    background: {variant === 'contained' ? (gradient ? 'linear-gradient(160deg, #8000f0 0%, #9000f0 10%, #b300f0 30%, #d100db 50%, #f0008c 100%)' : 'var(--secondary)') : 'transparent'};
    color: {variant === 'contained' ? 'var(--secondary-text)' : white ? 'var(--text)' : variant === 'text' ? 'var(--text)' : 'var(--secondary)'};
    border-color: {white ? 'rgb(255 255 255 / 0.08)' : variant === 'outlined' ? 'var(--secondary)' : 'transparent'};
    {$$props.style || ''}
  "
    on:mousedown={triggerRipple}
    on:keydown={handleKey}
    on:click={click}
>
    {#if icon}
        <Icon id={icon} size={iconSize} white={white || variant === "contained"} />
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
        font-size: 1.05rem;
        font-weight: 500;
        font-family: inherit;
        border-radius: 4px;
        cursor: pointer;
        transition:
            opacity 0.4s ease,
            box-shadow 0.2s ease,
            background 0.2s ease,
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
        background: rgba(255, 255, 255, 0.01) !important;
    }
    button:not(.contained):active {
        background: rgba(255, 255, 255, 0.04) !important;
    }
    button:not(.contained):active:hover {
        background: rgba(255, 255, 255, 0.06) !important;
    }
    button.contained:hover {
        filter: brightness(1.05);
    }
    button.contained:active {
        filter: brightness(1.09);
    }
    button.contained:active:hover {
        filter: brightness(1.13);
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

    button.contained:disabled {
        background: var(--primary-lighter) !important;
    }
    button:not(.white).outlined:disabled {
        /* border-color: var(--primary-darkest) !important; */
        border-color: var(--text) !important;
        color: var(--text) !important;
    }
    button:not(.white).outlined:disabled :global(svg) {
        fill: var(--text) !important;
    }

    button:hover {
        box-shadow: 0px 3px 6px rgba(0, 0, 0, 0.2);
    }

    button:focus-visible {
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
        opacity: 0.8;
        margin-inline-start: 2px;
        font-weight: normal;
    }
</style>
