<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import T from "../helpers/T.svelte"

    export let value: number = 0
    export let label: string
    export let id = ""
    export let placeholder = ""
    export let center = false
    export let disabled = false
    export let autofocus = false
    export let step = 1
    export let min: number | null = 0
    export let max: number | null = null // 1000
    // export let defaultValue: number | null = null // reset to e.g. 0 when clicked "x" (if this value is set)

    // a string might be passed in
    $: numberValue = Number(value)

    const dispatch = createEventDispatcher()

    let inputElem: HTMLInputElement

    function updateValue(newVal: number) {
        if (min !== null) newVal = Math.max(min, newVal)
        if (max !== null) newVal = Math.min(max, newVal)
        numberValue = newVal

        dispatch("input", numberValue)
        dispatch("change", numberValue)
    }

    function handleInput(e: Event) {
        const newValue = parseFloat((e.target as HTMLInputElement).value)
        if (isNaN(newValue)) return

        updateValue(newValue)
    }

    function increment(customStep: number = step) {
        if (max === null || numberValue < max) updateValue(numberValue + customStep)
    }

    function decrement(customStep: number = step) {
        if (min === null || numberValue > min) updateValue(numberValue - customStep)
    }

    let nextScrollTimeout: NodeJS.Timeout | null = null
    function handleWheel(e: WheelEvent) {
        if (disabled || nextScrollTimeout) return
        if (!e.ctrlKey && !e.metaKey) return
        e.preventDefault()

        let stepAmount = step * (e.shiftKey ? 10 : 1)

        e.deltaY < 0 ? increment(stepAmount) : decrement(stepAmount)

        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "ArrowUp") {
            e.preventDefault()
            increment()
        } else if (e.key === "ArrowDown") {
            e.preventDefault()
            decrement()
        }
    }

    onMount(() => {
        if (inputElem) {
            inputElem.addEventListener("wheel", handleWheel, { passive: false })
        }
    })
</script>

<div class="textfield numberfield {center ? 'centered' : ''} {disabled ? 'disabled' : ''}">
    <div class="background" />

    <div class="input-wrapper">
        <input bind:this={inputElem} bind:value={numberValue} type="number" {id} {placeholder} {disabled} {autofocus} {step} {min} {max} class="input edit" class:noValue={!numberValue} on:keydown={handleKeyDown} on:input={handleInput} />

        <div class="buttons">
            <button type="button" class="inc" on:click={(e) => increment(e.shiftKey ? step * 10 : step)} tabindex="-1" disabled={max !== null && numberValue >= max}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 14l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </button>
            <button type="button" class="dec" on:click={(e) => decrement(e.shiftKey ? step * 10 : step)} tabindex="-1" disabled={min !== null && numberValue <= min}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </button>
        </div>
    </div>

    <label for={id} class:value-filled={numberValue !== null && numberValue !== undefined && numberValue !== 0}><T id={label} /></label>

    <span class="underline" />
</div>

<style>
    .textfield {
        position: relative;
        width: 100%;
        color: var(--text);
        border-bottom: 1.2px solid var(--primary-lighter);
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

    .input-wrapper {
        display: flex;
        align-items: center;
        position: relative;
    }

    /* Hide default browser arrows */
    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    input[type="number"].noValue:not(:focus) {
        color: transparent;
    }

    .input {
        position: relative;
        z-index: 1;
        width: 100%;
        border: none;
        outline: none;
        background: transparent;
        font-size: 1rem;
        padding: 1.25rem 2.2rem 0.5rem 0.75rem; /* space for buttons */
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

    /* buttons */

    .buttons {
        position: absolute;
        right: 0.1rem;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        z-index: 2;

        opacity: 0;
        transition: 0.15s opacity ease;
    }

    .textfield:not(.disabled):hover .buttons {
        opacity: 1;
    }

    .buttons button {
        background: var(--primary-darkest);
        color: var(--text);
        border: none;
        cursor: pointer;
        padding: 0.15rem;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition:
            background 0.15s ease,
            color 0.15s ease,
            opacity 0.15s ease;
    }

    .buttons button svg {
        display: block;
    }

    .buttons button:hover:not(:disabled) {
        background: var(--hover);
        color: var(--secondary);
    }

    .buttons button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .input:disabled {
        color: var(--text);
        opacity: 0.3;
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

    /* Float label if focused or has content */
    .textfield:has(input:focus) label,
    label.value-filled {
        top: 0.25rem;
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

    .textfield:has(input:focus) .underline {
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
