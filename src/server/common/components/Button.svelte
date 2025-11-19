<script lang="ts">
    export let active: boolean = false
    export let center: boolean = false
    export let border: boolean = false
    export let dark: boolean = false
    export let bold: boolean = true
    export let red: boolean = false
    export let variant: "contained" | "outlined" | "text" = "text"
    export let disabled: boolean = false
    export let compact: boolean = false
</script>

<button id={$$props.id} style={$$props.style} class:active class:center class:border class:bold class:dark class:red class:contained={variant === "contained"} class:outlined={variant === "outlined"} class:text={variant === "text"} class:compact class={$$props.class} on:click on:dblclick disabled={disabled || $$props.disabled} tabindex={active ? -1 : 0} title={$$props.title}>
    <slot />
</button>

<style>
    button {
        background-color: inherit;
        color: inherit;
        font-size: 0.9em;
        border: none;
        display: flex;
        align-items: center;
        padding: 0.75rem 1.25rem;
        border-radius: 8px;
        position: relative;
        overflow: hidden;
        cursor: pointer;
        transition: background-color 0.15s ease;
        user-select: none;
        gap: 8px;
        white-space: nowrap;
        min-height: 25px;
        justify-content: center;
    }
    button.compact {
        padding: 0.5rem 0.75rem;
        font-size: 0.8em;
    }
    button.dark {
        background-color: var(--primary-darker);
    }
    button.center {
        justify-content: center;
    }
    button.bold:not(.compact) {
        font-weight: bold;
        letter-spacing: 0.5px;
        padding: 0.3em 0.8em;
        /* text-transform: uppercase; */
    }
    button.bold.compact {
        font-weight: bold;
        letter-spacing: 0.5px;
    }

    /* Variants */
    button.contained {
        background-color: var(--secondary);
        color: var(--secondary-text);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    button.contained:hover:not(:disabled) {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        transform: translateY(-1px);
    }
    button.contained:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    button.outlined {
        border: 1px solid var(--primary-lighter);
        background-color: transparent;
    }
    button.outlined:hover:not(:disabled) {
        background-color: var(--hover);
        border-color: var(--secondary);
    }

    button.text {
        background-color: transparent;
        padding: 0.5rem 1rem;
    }
    button.text:hover:not(:disabled) {
        background-color: var(--hover);
    }

    /* red */
    button.red:not(:disabled) {
        background-color: var(--red);
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

    button:not(:disabled) {
        cursor: pointer;
    }
    button:hover:not(:disabled):not(.contained) {
        background-color: var(--hover);
    }
    button:active:not(:disabled):not(.contained) {
        background-color: var(--focus);
    }
    button.active {
        /* background-color: var(--secondary-opacity); */
        /* background-color: var(--primary-darkest); */
        background-color: var(--primary-darker);
        color: var(--text);
        outline: none;
    }
    button.active.border {
        outline-offset: -2px;
        /* outline: 2px solid var(--secondary); */
        outline: 2px solid var(--primary-lighter);
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
    }
    button.active :global(svg) {
        fill: var(--text);
    }

    button:disabled {
        opacity: 0.5;
        /* this is to prevent interfearing with mouse event listeners */
        pointer-events: none;
    }
</style>
