<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "./MaterialButton.svelte"

    export let value: number = 0
    export let defaultValue: number | null = null
    export let label: string
    export let id = ""
    export let placeholder = ""
    export let center = false
    export let disabled = false
    export let autofocus = false
    export let hideWhenZero: boolean = false
    export let showSlider: boolean = false
    export let sliderValues: { min?: number; max?: number; step?: number } = {}
    export let currentProgress: number | null = null
    export let step = 1
    export let min: number | null = 0
    export let max: number | null = null // 1000
    export let maxDecimals: number = 2
    export let padLength: number = 0

    // a string might be passed in
    $: rawInput = padLength ? String(numberValue).padStart(padLength, "0") : String(Number(numberValue.toFixed(maxDecimals)))
    $: numberValue = Number(value || 0)

    // Slider values and percent for filled track
    $: sliderMin = sliderValues.min ?? min ?? 0
    $: sliderMax = sliderValues.max ?? max ?? 100
    $: sliderStep = sliderValues.step ?? step
    $: sliderPercent = sliderMax > sliderMin ? ((Number(numberValue) - Number(sliderMin)) / (Number(sliderMax) - Number(sliderMin))) * 100 : 0

    const dispatch = createEventDispatcher()

    let inputElem: HTMLInputElement

    function updateValue(newVal: number | string) {
        if (disabled) return

        // convert , to .
        let normalizedVal = typeof newVal === "string" ? newVal.replace(/,/g, ".") : newVal

        let calcVal: number
        if (!padLength) {
            try {
                calcVal = typeof normalizedVal === "string" ? new Function(`return ${normalizedVal}`)() : normalizedVal
            } catch {
                // invalid expression
                return
            }
        } else {
            calcVal = Number(normalizedVal)
        }
        // invalid value
        if (isNaN(calcVal)) return

        if (min !== null) calcVal = Math.max(min, calcVal)
        if (max !== null) calcVal = Math.min(max, calcVal)
        calcVal = Number(calcVal.toFixed(maxDecimals))
        numberValue = calcVal

        // set padded value
        rawInput = padLength ? String(calcVal).padStart(padLength, "0") : String(calcVal)

        dispatch("input", numberValue)
        dispatch("change", numberValue)
    }

    function handleInput(e: Event) {
        const inputVal = (e.target as HTMLInputElement).value
        rawInput = inputVal
    }

    function handleChange(e: Event) {
        const inputVal = (e.target as HTMLInputElement).value
        updateValue(inputVal)
    }

    function increment(customStep: number = step) {
        if (max === null || numberValue < max) updateValue(Number((numberValue + customStep).toFixed(3)))
    }

    function decrement(customStep: number = step) {
        if (min === null || numberValue > min) updateValue(Number((numberValue - customStep).toFixed(3)))
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
        } else if (e.key === "Enter") {
            e.preventDefault()
            updateValue(rawInput)
        }
    }

    onMount(() => {
        if (inputElem) {
            inputElem.addEventListener("wheel", handleWheel, { passive: false })
        }
    })

    // RESET

    let resetFromValue: number | null = null
    function reset() {
        resetFromValue = value
        dispatch("change", defaultValue)
        setTimeout(() => {
            resetFromValue = null
        }, 3000)
    }

    function undoReset() {
        dispatch("change", resetFromValue)
        resetFromValue = null
    }
</script>

<div class="textfield numberfield {center ? 'centered' : ''} {disabled ? 'disabled' : ''}" style={$$props.style || null}>
    <div class="background" />

    <div class="input-wrapper">
        <input
            bind:this={inputElem}
            value={rawInput}
            type="text"
            {id}
            {placeholder}
            {disabled}
            {autofocus}
            {step}
            {min}
            {max}
            class="input edit"
            class:noValue={hideWhenZero && !padLength && !numberValue}
            on:keydown={handleKeyDown}
            on:input={handleInput}
            on:change={handleChange}
            inputmode="decimal"
            autocomplete="off"
        />

        <div class="buttons">
            <button type="button" class="inc" on:click={(e) => increment(e.shiftKey ? step * 10 : step)} tabindex="-1" disabled={disabled || (max !== null && numberValue >= max)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 14l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </button>
            <button type="button" class="dec" on:click={(e) => decrement(e.shiftKey ? step * 10 : step)} tabindex="-1" disabled={disabled || (min !== null && numberValue <= min)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </button>
        </div>
    </div>

    <label for={id} class:value-filled={!hideWhenZero || padLength || (numberValue !== null && numberValue !== undefined && numberValue !== 0)}>{@html translateText(label)}</label>

    <span class="underline" style={currentProgress ? `width: ${currentProgress}%;transform: initial;` : ""} />

    {#if showSlider}
        <div class="slider-wrapper" style="padding-right: {defaultValue === null ? 40 : 70}px;">
            <input tabindex="-1" class="slider" type="range" {disabled} min={sliderMin} max={sliderMax} step={sliderStep} bind:value={numberValue} on:input={() => updateValue(numberValue)} style="--slider-fill: {sliderPercent}%;" />
        </div>
    {/if}

    {#if defaultValue !== null}
        <div class="remove">
            {#if value !== defaultValue}
                <MaterialButton {disabled} on:click={reset} title="actions.reset" white>
                    <Icon id="reset" white />
                </MaterialButton>
            {:else if resetFromValue !== null}
                <MaterialButton {disabled} on:click={undoReset} title="actions.undo" white>
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

    .input-wrapper {
        display: flex;
        align-items: center;
        position: relative;
    }

    /* Hide default browser arrows */
    /* input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    } */
    input[type="text"].noValue:not(:focus) {
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
        width: 0%;
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

    .textfield:not(:has(.input:focus)):not(:has(.remove:hover)) .input:not(:disabled):hover {
        background-color: var(--hover);
    }

    .remove {
        position: absolute;
        top: 50%;
        right: 28px;
        transform: translateY(-50%);

        z-index: 2;
    }
    .remove :global(button) {
        padding: 0.75rem;
    }

    /* Slider */

    .textfield:hover .slider-wrapper {
        opacity: 1;
    }
    .slider-wrapper {
        opacity: 0;
        transition: 0.2s opacity ease;

        /* padding-right: 30px; */
        padding-right: 40px;
        padding-left: 5px;
        /* padding: 0 80px; */
        padding-left: 70px;

        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 100%;

        display: flex;
        align-items: center;
        justify-content: center;

        z-index: 2;
        pointer-events: none;
    }
    .slider {
        position: relative;
        display: block;
        width: 100%;

        /* margin: 0;
        height: 3px; */

        background: transparent;
        cursor: pointer;

        pointer-events: auto;
        appearance: none;
        -webkit-appearance: none;
    }
    .slider::-webkit-slider-runnable-track {
        height: 3px;
        border-radius: 2px;
        background: linear-gradient(90deg, var(--secondary) 0%, var(--secondary) var(--slider-fill, 0%), var(--primary-lighter) var(--slider-fill, 0%), var(--primary-lighter) 100%);
    }
    .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;

        position: relative;
        top: 50%;
        transform: translateY(-50%);

        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--secondary);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
        border: 2px solid var(--secondary);

        transition:
            box-shadow 0.2s,
            background 0.2s;

        z-index: 1;
    }
    .slider:focus::-webkit-slider-thumb,
    .slider:hover::-webkit-slider-thumb {
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);
    }
    .slider:focus {
        outline: none;
    }
    .slider::-webkit-slider-tick-container {
        display: none;
    }
    .slider:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
</style>
