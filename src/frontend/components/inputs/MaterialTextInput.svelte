<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "./MaterialButton.svelte"
    import { dictionary } from "../../stores"

    export let value: string
    export let defaultValue: string = ""
    export let label: string

    export let id = ""
    export let title = ""
    export let placeholder = ""

    export let center = false
    export let disabled = false
    export let autofocus = false
    export let autoselect = false

    const dispatch = createEventDispatcher()

    function select(elem: HTMLInputElement) {
        if (autoselect) elem.select()
    }

    function input(e: Event) {
        value = (e.target as HTMLInputElement).value
        dispatch("input", value)
    }

    function change(e: Event) {
        const value = (e.target as HTMLInputElement).value
        dispatch("change", value)
    }

    // RESET

    let resetFromValue = ""
    function reset() {
        resetFromValue = value
        dispatch("change", defaultValue)
        setTimeout(() => {
            resetFromValue = ""
        }, 3000)
    }

    function undoReset() {
        dispatch("change", resetFromValue)
        resetFromValue = ""
    }
</script>

<div class="textfield {center ? 'centered' : ''} {disabled ? 'disabled' : ''}" data-title={translateText(title)}>
    <div class="background" />

    <input bind:value type="text" {id} {placeholder} {disabled} {autofocus} use:select class="input edit" on:input={input} on:change={change} />

    <label for={id}>{translateText(label, $dictionary)}</label>

    <span class="underline" />

    {#if defaultValue}
        <div class="remove">
            {#if value !== defaultValue}
                <MaterialButton on:click={reset} title="actions.reset" white>
                    <Icon id="reset" white />
                </MaterialButton>
            {:else if resetFromValue}
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

    .textfield.centered {
        text-align: center;
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

    /* Float label if focused or has content */
    .input:focus + label,
    .input:not(:placeholder-shown) + label {
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
        right: 4px;
        transform: translateY(-50%);

        z-index: 2;
    }
    .remove :global(button) {
        padding: 0.75rem;
    }
</style>
