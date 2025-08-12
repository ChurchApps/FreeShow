<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { dictionary } from "../../stores"
    import { translateText } from "../../utils/language"

    export let checked: boolean = false
    export let defaultValue: boolean | null = null
    export let label: string
    export let title: string = ""
    export let data: any = null
    export let id = ""
    export let disabled = false
    export let center = false

    // might not be a boolean - maybe undefined
    $: checkedValue = !!checked

    const dispatch = createEventDispatcher()

    function toggle() {
        if (disabled) return
        checkedValue = !checkedValue
        dispatch("change", checkedValue)
    }

    function onKeyDown(e: KeyboardEvent) {
        if (disabled) return
        // WIP space also changes slides...
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault()
            toggle()
        }
    }
</script>

<div class="togglefield {center ? 'centered' : ''} {disabled ? 'disabled' : ''}" data-title={translateText(title)} role="switch" aria-checked={checkedValue} tabindex={disabled ? undefined : 0} on:click={toggle} on:keydown={onKeyDown}>
    <div class="background" />
    <div class="hover" />

    <input type="checkbox" bind:checked={checkedValue} {id} {disabled} class="hidden-input" tabindex="-1" aria-hidden="true" />

    <label for={id} class="toggle-label">
        {translateText(label, $dictionary)}

        {#if data}<span class="data">{data}</span>{/if}

        <!-- data-title={translateText("info.changed")} -->
        {#if defaultValue !== null}<span class="changed" class:hidden={defaultValue === checkedValue}></span>{/if}
    </label>

    <div class="switch">
        <div class="thumb" />
    </div>

    <span class="underline" />
</div>

<style>
    .togglefield {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.75rem;
        color: var(--text);
        cursor: pointer;
        outline: none; /* remove default focus outline */

        border-bottom: 1.2px solid var(--primary-lighter);

        height: 50px;
    }
    .togglefield.centered {
        justify-content: center;
    }
    .togglefield.disabled {
        opacity: 0.35;
        cursor: not-allowed;
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

    .toggle-label {
        position: relative;
        font-size: 1.1rem;
        color: var(--text);
        opacity: 0.9;
        z-index: 1;
        user-select: none;
        pointer-events: none;
    }

    .switch {
        position: relative;
        width: 40px;
        height: 22px;
        background-color: var(--primary-lighter);
        border-radius: 22px;
        transition:
            background-color 0.2s ease,
            opacity 0.2s ease;
        flex-shrink: 0;
        z-index: 1;
    }
    .thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 18px;
        height: 18px;
        background-color: var(--text);
        border-radius: 50%;
        transition:
            filter 0.1s ease,
            transform 0.2s ease,
            background-color 0.2s ease;
    }
    .togglefield:not(.disabled) .switch:hover .thumb {
        filter: invert(0.08);
    }

    .hidden-input:checked + .toggle-label + .switch {
        background-color: var(--secondary);
        opacity: 1;
    }
    .hidden-input:checked + .toggle-label + .switch .thumb {
        transform: translateX(18px);
        background-color: var(--primary-darker);
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
    /* .togglefield:not(.disabled):active .underline, */
    .togglefield:not(.disabled):focus-visible .underline {
        transform: scaleX(1);
    }

    .togglefield .hover {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }
    .togglefield:not(.disabled):hover .hover {
        background-color: var(--hover);
    }

    .data {
        font-size: 0.7em;
        opacity: 0.5;
    }

    label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;

        width: 100%;
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
