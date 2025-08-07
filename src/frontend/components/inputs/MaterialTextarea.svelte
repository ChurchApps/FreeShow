<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import T from "../helpers/T.svelte"

    export let value: string = ""
    export let label: string

    export let id = ""
    export let placeholder = ""

    export let rows = 8

    export let center = false
    export let disabled = false
    export let autofocus = false
    export let autoselect = false

    const dispatch = createEventDispatcher()

    function select(elem: HTMLTextAreaElement) {
        if (autoselect) elem.select()
    }

    function input(e: Event) {
        value = (e.target as HTMLTextAreaElement).value
        dispatch("input", value)
    }

    function change(e: Event) {
        const value = (e.target as HTMLTextAreaElement).value
        dispatch("change", value)
    }
</script>

<div class="textfield {center ? 'centered' : ''} {disabled ? 'disabled' : ''}">
    <div class="background" />
    <textarea bind:value {id} {placeholder} {disabled} {autofocus} use:select class="input edit" on:input={input} on:change={change} {rows} />
    <label for={id}><T id={label} /></label>
    <span class="underline" />
</div>

<style>
    .textfield {
        position: relative;
        width: 100%;
        color: var(--text);

        display: flex;

        /* transition: 0.22s height ease; */
        /* height: 50px; */
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
        font-size: inherit; /* 1rem; */
        padding: 1.25rem 0.75rem 0.5rem;
        color: var(--text);
        font-family: inherit;
        /* line-height: 1.4; */

        /* resize: vertical; */
        resize: none;

        /* height: 100%;
        overflow: hidden; */
    }

    /* .textfield:has(.input:focus),
    .textfield:has(.input:not(:placeholder-shown)) {
        height: auto;
        / * height: 200px; * /
    }
    .input:focus,
    .input:not(:placeholder-shown) {
        min-height: 4rem;
        overflow-y: auto;
    } */

    .input::placeholder {
        color: var(--text);
        opacity: 0.3;

        transition: 0.1s opacity ease;
    }
    .input:not(:focus)::placeholder {
        opacity: 0;
        line-height: 0;
    }

    .input:disabled {
        color: var(--text);
        opacity: 0.6;
        cursor: not-allowed;
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

    .input:focus + label,
    .input:not(:placeholder-shown) + label {
        left: 0;
        top: 0;
        /* because of scrolling */
        background-color: var(--primary-darkest);
        padding: 0.25rem 10px;
        border-radius: 4px;
        /* width: calc(100% - 20px); */

        font-size: 0.75rem;
        color: var(--secondary);
        font-weight: 500;
        opacity: 1;
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

    .textfield:not(:has(.input:focus)) .input:not(:disabled):hover {
        background-color: var(--hover);
    }
</style>
