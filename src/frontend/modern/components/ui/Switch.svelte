<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { dictionary } from "../../../stores"
    import { translateText } from "../../../utils/language"

    export let checked = false
    export let disabled = false
    export let label = ""
    export let title = ""

    const dispatch = createEventDispatcher()

    function toggle() {
        if (disabled) return
        checked = !checked
        dispatch("change", checked)
    }
</script>

<button type="button" class="ui-switch" class:checked {disabled} role="switch" aria-checked={checked} data-title={translateText(title || label, $dictionary)} on:click={toggle}>
    <span class="track"><span class="thumb" /></span>
    {#if label}<span class="label">{translateText(label, $dictionary)}</span>{/if}
</button>

<style>
    .ui-switch {
        display: inline-flex;
        align-items: center;
        gap: 10px;

        padding: 0;
        font-family: inherit;
        font-size: 13px;
        color: var(--ui-text);

        background: none;
        border: none;
        cursor: pointer;
    }

    .ui-switch:disabled {
        opacity: 0.45;
        pointer-events: none;
    }

    .track {
        position: relative;
        display: block;
        width: 34px;
        height: 20px;
        background: color-mix(in srgb, var(--ui-text) 16%, transparent);
        border-radius: 999px;
        transition: background-color 0.18s ease;
    }

    .thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        background: var(--ui-text);
        border-radius: 50%;
        transition: transform 0.18s ease;
    }

    .checked .track {
        background: var(--ui-accent);
    }
    .checked .thumb {
        transform: translateX(14px);
        background: #fff;
    }

    .ui-switch:focus-visible {
        outline: none;
    }
    .ui-switch:focus-visible .track {
        box-shadow:
            0 0 0 2px var(--ui-panel),
            0 0 0 4px var(--ui-accent-border);
    }
</style>
