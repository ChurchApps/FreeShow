<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "./MaterialButton.svelte"
    import { dictionary } from "../../stores"

    export let label: string
    export let value: string // expected format: "12:00"
    export let defaultValue: string | null = null

    export let id = ""
    export let title = ""

    export let disabled = false
    export let autofocus = false
    export let isDate = false

    const dispatch = createEventDispatcher()

    function blurOnEnter(elem: HTMLInputElement) {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Enter") elem.blur()
        }
        elem.addEventListener("keydown", handler)
        return {
            destroy() {
                elem.removeEventListener("keydown", handler)
            }
        }
    }

    function onInput(e: Event) {
        value = (e.target as HTMLInputElement).value
        dispatch("input", value)
    }

    function onChange(e: Event) {
        const v = (e.target as HTMLInputElement).value
        dispatch("change", v)
    }

    // RESET
    let resetFromValue: string | null = null
    function reset() {
        resetFromValue = value
        dispatch("change", defaultValue)
        dispatch("input", defaultValue)
        setTimeout(() => {
            resetFromValue = null
        }, 3000)
    }
    function undoReset() {
        dispatch("change", resetFromValue)
        dispatch("input", resetFromValue)
        resetFromValue = null
    }
</script>

<!-- class:filled={!!value} -->
<div class="textfield filled" class:disabled data-title={translateText(title)} style={$$props.style || null}>
    <div class="background" />

    {#if isDate}
        <input bind:value type="date" {id} {disabled} {autofocus} use:blurOnEnter class="input edit" on:input={onInput} on:change={onChange} on:keydown />
    {:else}
        <input bind:value type="time" {id} {disabled} {autofocus} use:blurOnEnter class="input edit" on:input={onInput} on:change={onChange} on:keydown />
    {/if}

    <label for={id}>{@html translateText(label, $dictionary)}</label>

    <span class="underline" />

    {#if defaultValue !== null}
        <div class="remove">
            {#if value !== defaultValue}
                <MaterialButton on:click={reset} title="actions.reset" white>
                    <Icon id="reset" white />
                </MaterialButton>
            {:else if resetFromValue !== null}
                <MaterialButton on:click={undoReset} title="actions.undo" white>
                    <Icon id="undo" white />
                </MaterialButton>
            {/if}
        </div>
    {/if}
</div>

<style>
    .textfield {
        position: relative;
        width: 100%;
        color: var(--text);
        border-bottom: 1.2px solid var(--primary-lighter);
        height: 50px;
    }

    .background {
        position: absolute;
        inset: 0;
        background-color: var(--primary-darkest);
        border-radius: 4px 4px 0 0;
        z-index: 0;
    }

    .input {
        position: relative;
        z-index: 1;
        width: 100%;
        border: none;
        outline: none;
        background: transparent;
        font-size: 1rem;
        padding: 1.25rem 0.75rem 0.5rem;
        color: var(--text);
        font-family: inherit;
    }
    /* .textfield:not(.filled) .input {
        opacity: 0;
    } */

    input::-webkit-calendar-picker-indicator {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        right: 10px;

        border-radius: 4px;
        padding: 8px;
        cursor: pointer;
        opacity: 0.8;
        filter: invert(1);

        transition: 0.1s background-color ease;
    }
    input::-webkit-calendar-picker-indicator:hover {
        background-color: rgb(0 0 0 / 0.1);
    }

    .input::placeholder {
        color: var(--text);
        opacity: 0.3;
        transition: 0.1s opacity ease;
    }
    .input:not(:focus)::placeholder {
        opacity: 0;
    }

    .input:disabled {
        color: var(--text);
        opacity: 0.3;
        cursor: not-allowed;
    }

    /* Label base */
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

    /* Float label if focused OR when wrapper has 'filled' */
    .input:focus + label,
    .textfield.filled label {
        top: 0.25rem;
        font-size: 0.75rem;
        color: var(--secondary);
        font-weight: 500;
        opacity: 1;
    }

    /* Underline animation on focus */
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
    .input:focus ~ .underline {
        transform: scaleX(1);
    }

    .textfield.disabled label {
        color: var(--text);
        opacity: 0.35;
    }
    .textfield.disabled .underline {
        color: var(--text);
        opacity: 0.3;
    }

    .textfield:not(:has(.input:focus)):not(:has(.remove:hover)) .input:not(:disabled):hover {
        background-color: var(--hover);
    }

    .remove {
        position: absolute;
        top: 50%;
        right: 48px;
        transform: translateY(-50%);
        z-index: 2;
    }
    .remove :global(button) {
        padding: 0.75rem;
    }

    /* Safari/iOS date input fixes (keeps text visible and avoids cramped UI) */
    .input::-webkit-date-and-time-value {
        text-align: left;
    }
</style>
