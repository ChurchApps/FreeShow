<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { translateText } from "../../utils/language"
    import { removeDuplicates } from "../helpers/array"
    import InputRow from "../input/InputRow.svelte"
    import MaterialButton from "./MaterialButton.svelte"

    export let label: string
    export let value: string[]
    export let options: { label: string; value: string; icon?: string }[]

    const dispatch = createEventDispatcher()
    function toggleOption(id: string) {
        if (value.includes(id)) value.splice(value.indexOf(id), 1)
        else value = removeDuplicates([...value, id])

        dispatch("change", value)
    }
</script>

<div class="toggles">
    <label class:selected={value}>{translateText(label)}</label>

    <InputRow>
        {#each options as option}
            <MaterialButton icon={option.icon} on:click={() => toggleOption(option.value)}>
                {translateText(option.label)}

                <div class="highlight" class:active={value.includes(option.value)}></div>
            </MaterialButton>
        {/each}
    </InputRow>
</div>

<style>
    .toggles {
        position: relative;
        width: 100%;

        display: flex;
        justify-content: right;

        border-bottom: 1.2px solid var(--primary-lighter);

        height: 50px;
    }

    label {
        position: absolute;
        left: 0.75rem;
        top: 0.75rem;
        font-size: 1.1rem;
        color: var(--text);
        opacity: 0.8;
        transition: all 0.2s ease;
        pointer-events: none;
        z-index: 1;
    }

    .toggles :global(.row) {
        min-width: 50%;

        overflow: auto;
        margin-left: 150px;
    }

    .toggles :global(button) {
        font-weight: normal;
        padding-bottom: 0.9rem;

        border-bottom: none !important;
        border-radius: 0;

        min-width: 160px;
        flex: 1;

        outline-offset: -2px;
    }

    .toggles :global(button:first-child) {
        border-top-left-radius: 6px;
        border-bottom-left-radius: 6px;
    }
    .toggles :global(button:last-child) {
        border-top-right-radius: 6px;
        border-bottom-right-radius: 6px;
    }

    .highlight {
        position: absolute;
        bottom: 5px;
        left: 50%;
        transform: translateX(-50%);

        height: 2px;
        width: 50%;

        background-color: var(--primary-lighter);
        transition: 0.2s background-color ease;
    }
    .highlight.active {
        background-color: var(--secondary);

        box-shadow: 0 0 3px rgb(255 255 255 / 0.2);
    }
</style>
