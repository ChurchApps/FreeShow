<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { translateText } from "../../utils/language"

    export let checked = false
    export let defaultValue: boolean | null = null
    export let label: string
    export let title = ""
    export let data: any = null
    export let id = ""
    export let disabled = false
    export let center = false
    export let small = false

    $: checkedValue = !!checked

    const dispatch = createEventDispatcher()

    function toggle() {
        if (disabled) return
        checkedValue = !checkedValue
        dispatch("change", checkedValue)
    }

    function onKeyDown(e: KeyboardEvent) {
        if (disabled) return
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault()
            toggle()
        }
    }
</script>

<div style={$$props.style || null} class="checkboxfield {center ? 'centered' : ''} {disabled ? 'disabled' : ''}" class:small data-title={translateText(title || label)} role="checkbox" aria-checked={checkedValue} tabindex={disabled ? undefined : 0} on:click={toggle} on:keydown={onKeyDown}>
    <div class="background" />
    <div class="hover" />

    <input type="checkbox" bind:checked={checkedValue} {id} {disabled} class="hidden-input" tabindex="-1" aria-hidden="true" />

    <label for={id} class="checkbox-label">
        <div class="custom-checkbox" aria-hidden="true"></div>
        {@html translateText(label)}

        {#if data}
            <span class="data">{data}</span>
        {/if}

        {#if defaultValue !== null}
            <span class="changed" class:hidden={defaultValue === checkedValue}></span>
        {/if}
    </label>

    <span class="underline" />
</div>

<style>
    .checkboxfield {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        color: var(--text);
        cursor: pointer;
        outline: none;
        border-bottom: 1.2px solid var(--primary-lighter);
        height: 50px;
    }
    .checkboxfield.centered {
        justify-content: center;
    }
    .checkboxfield.disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }
    .checkboxfield.small {
        padding: 4px;
    }

    .background {
        position: absolute;
        inset: 0;
        background-color: var(--primary-darkest);
        border-radius: 4px 4px 0 0;
        z-index: 0;
    }

    .hidden-input {
        display: none;
    }

    .checkbox-label {
        position: relative;
        font-size: 1rem;
        color: var(--text);
        opacity: 0.9;
        z-index: 1;
        user-select: none;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        pointer-events: none; /* prevents clicks on label text directly */

        white-space: nowrap;
        /* text-overflow: ellipsis;
        overflow: hidden;
        max-width: 100px; */
    }
    .small .checkbox-label {
        gap: 3px;
        font-size: 0.8em;
    }

    .custom-checkbox {
        width: 20px;
        height: 20px;
        border: 2px solid var(--primary-lighter);
        border-radius: 4px;
        background-color: transparent;
        transition:
            background-color 0.2s ease,
            border-color 0.2s ease;
        flex-shrink: 0;

        margin: 0 5px;
    }
    .small .custom-checkbox {
        width: 16px;
        height: 16px;
    }

    .checkboxfield:has(.hidden-input:checked) .custom-checkbox {
        background-color: var(--secondary);
        border-color: var(--secondary);
    }

    .checkboxfield:has(.hidden-input:checked) .custom-checkbox::after {
        content: "";
        position: absolute;
        width: 6px;
        height: 12px;
        /* var(--secondary-text) */
        border-right: 2px solid var(--primary-darkest);
        border-bottom: 2px solid var(--primary-darkest);
        transform: rotate(45deg);
        left: 6px;
        top: 3px;

        margin: 0 5px;
    }
    .checkboxfield.small:has(.hidden-input:checked) .custom-checkbox::after {
        width: 5px;
        height: 10px;
        left: 5px;
        top: 1px;
    }

    .underline {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 1.2px;
        width: 100%;
        background-color: var(--secondary);
        transform: scaleX(0);
        transition: transform 0.2s ease;
        transform-origin: left;
        z-index: 2;
    }
    .checkboxfield:not(.disabled):focus-visible .underline {
        transform: scaleX(1);
    }

    .hover {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }
    .checkboxfield:not(.disabled):hover .hover {
        background-color: var(--hover);
    }

    .data {
        font-size: 0.7em;
        opacity: 0.5;

        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .changed {
        width: 5px;
        height: 5px;
        background-color: var(--text);
        border-radius: 50%;
        transition: 0.2s opacity ease;
        opacity: 0.12;
    }
    .changed.hidden {
        opacity: 0;
    }
</style>
