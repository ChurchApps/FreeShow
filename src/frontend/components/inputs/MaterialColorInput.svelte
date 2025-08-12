<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { uid } from "uid"
    import { translateText } from "../../utils/language"
    import { defaultColors, getContrast } from "../helpers/color"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "./MaterialButton.svelte"

    export let value: string = "#000000"
    export let defaultValue: string = ""
    export let label: string
    export let enableNoColor = false
    export let disabled = false
    export let height = 0
    export let width = 0

    const dispatch = createEventDispatcher()

    let pickerOpen = false
    let resetFromValue = ""

    function togglePicker() {
        if (disabled) return
        pickerOpen = !pickerOpen
    }
    let pickerId: string = "picker_" + uid()
    function mousedown(e: any) {
        if (e.target.closest("#" + pickerId) || (e.target.closest(".colorpicker") && !e.target.closest(".pickColor"))) return
        if (e.target.closest(".color")) return

        // if (pickerOpen) dispatch("change", value)

        pickerOpen = false
    }

    function selectColor(c: string) {
        value = c
        dispatch("change", value)
        dispatch("input", value)

        pickerOpen = false
    }

    function change(e: any) {
        value = e.target?.value
        dispatch("change", value)
    }

    function input(e: any) {
        value = e.target?.value
        dispatch("input", value)
    }

    function reset() {
        resetFromValue = value
        selectColor(defaultValue)
        setTimeout(() => (resetFromValue = ""), 3000)
    }

    function undoReset() {
        selectColor(resetFromValue)
        resetFromValue = ""
    }

    function handleKey(event) {
        if (disabled) return

        if (event.key === "Escape") {
            if (!pickerOpen) return
            event.preventDefault()
            pickerOpen = false
            setTimeout(() => document.getElementById(pickerId)?.focus())
            return
        }

        if (event.key === "Enter" || event.key === " ") {
            const picker = event.target?.closest(".colorpicker")
            if (picker) return

            const pickColor = event.target?.closest(".pickColor")
            if (pickColor) {
                selectColor(pickColor.getAttribute("data-value"))
                document.getElementById(pickerId)?.focus()
                return
            }

            togglePicker()
        }
    }
</script>

<svelte:window on:mousedown={mousedown} />

<div id={pickerId} class="textfield {disabled ? 'disabled' : ''}" aria-disabled={disabled} tabindex={disabled ? -1 : 0} style="--outline-color: {getContrast(value)};" on:keydown={handleKey}>
    <div class="background" on:click={togglePicker} />

    <div class="color-display" style="background:{value || 'transparent'};" on:click={togglePicker}></div>

    <label>{@html translateText(label)}</label>
    <span class="underline" />

    {#if pickerOpen}
        <div class="picker">
            {#if enableNoColor}
                <div data-value={""} class="pickColor noColor" data-title={translateText("settings.remove")} tabindex="0" on:click={() => selectColor("")}>
                    <Icon id="close" white />
                </div>
            {/if}
            {#each defaultColors as c}
                <div data-value={c.value} class="pickColor {value === c.value ? 'active' : ''}" data-title={c.name} tabindex="0" style="background:{c.value};--outline-color: {getContrast(c.value)};" on:click={() => selectColor(c.value)}></div>
            {/each}

            <div class="color" style="background: {value};">
                <p style="color: var(--outline-color);">{translateText("actions.choose_custom")}</p>
                <input class="colorpicker" style={(height ? "height: " + height + "px;" : "") + (width ? "width: " + width + "px;" : "")} type="color" bind:value on:input={input} on:change={change} />
            </div>
        </div>
    {/if}

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
        border-bottom: 1.2px solid var(--primary-lighter);

        cursor: pointer;

        height: 50px;
    }
    .textfield.disabled {
        opacity: 0.5;
        pointer-events: none;
    }
    /* .textfield:not(.disabled):hover .input {
        background-color: var(--hover);
    } */

    .background {
        position: absolute;
        inset: 0;
        background-color: var(--primary-darkest);
        border-radius: 4px 4px 0 0;
    }
    .color-display {
        position: relative;

        border-radius: 3px;
        border: 2px solid transparent;

        transition:
            0.2s background-color,
            0.1s border-color;

        --margin: 6px;
        top: var(--margin);
        height: calc(100% - (var(--margin) * 2));
        margin: var(--margin);
        /* margin-left: 200px; */
        margin-left: 50%;
    }
    .color-display:hover {
        border-color: var(--outline-color);
    }
    label {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        left: 0.75rem;

        font-size: 1.1rem;
        opacity: 0.8;

        transition: all 0.2s ease;

        pointer-events: none;
    }
    .underline {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 1.2px;
        width: 100%;
        background-color: var(--secondary);
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 0.2s ease;
    }
    /* .textfield:not(.disabled):active .underline */
    .textfield:focus .underline {
        transform: scaleX(1);
    }
    .picker {
        position: absolute;
        top: calc(100% - var(--margin));
        left: 50%;
        background: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        display: flex;
        flex-wrap: wrap;
        z-index: 10;

        cursor: default;

        --width: 200px;
        --padding: 10px;
        --gap: 5px;
        width: var(--width);
        padding: var(--padding);
        gap: var(--gap);

        display: flex;
        flex-wrap: wrap;

        box-shadow: 0 0 5px 5px rgb(0 0 0 / 0.2);
    }
    .pickColor {
        --count: 5;
        --size: calc(((var(--width) - var(--padding) * 2) / var(--count)) - (var(--gap) / var(--count) * (var(--count) - 1)) - 0.4px);
        height: var(--size);
        width: var(--size);
        cursor: pointer;
        border-radius: 3px;

        /* min-width: 30px; */
        /* width: 40px !important; */
        aspect-ratio: 1;
        /* flex: 1; */

        border: 2px solid transparent;
        transition: 0.1s border-color;

        outline-offset: 2px;
    }
    .pickColor:hover {
        /* border-color: var(--outline-color); */
        border-color: var(--primary-darker);
    }
    .pickColor.active {
        border-color: var(--secondary);
    }

    .noColor {
        display: flex;
        justify-content: center;
        align-items: center;
        background: var(--primary);
    }
    .remove {
        position: absolute;
        top: 50%;
        right: 4px;
        transform: translateY(-50%);
    }
    .remove :global(svg) {
        color: var(--outline-color);
    }

    /* default picker */

    .color {
        transition: background-color 0.2s;
        position: relative;
        border-radius: 4px;

        margin-top: 5px;
        padding: 15px;

        width: 100%;

        display: flex;
        align-items: center;
        justify-content: center;

        border: 2px solid transparent;
        transition: 0.1s border-color;
    }
    .color:hover,
    .color:has(input:focus) {
        border-color: var(--outline-color);
    }

    input[type="color"] {
        position: absolute;

        opacity: 0;
        width: 100%;
        height: 100%;

        cursor: pointer;
    }
</style>
