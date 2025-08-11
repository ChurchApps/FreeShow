<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { uid } from "uid"
    import { defaultColors, getContrast } from "../helpers/color"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
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
</script>

<svelte:window on:mousedown={mousedown} />

<div id={pickerId} class="textfield {disabled ? 'disabled' : ''}" style="--outline-color: {getContrast(value)};">
    <div class="background" />

    <div class="color-display" style="background:{value || 'transparent'};" on:click={togglePicker}></div>

    <label><T id={label} /></label>
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

    {#if pickerOpen}
        <div class="picker">
            {#if enableNoColor}
                <div class="pickColor noColor" on:click={() => selectColor("")}>
                    <Icon id="close" white />
                </div>
            {/if}
            {#each defaultColors as c}
                <div class="pickColor {value === c.value ? 'active' : ''}" style="background:{c.value};" on:click={() => selectColor(c.value)}></div>
            {/each}

            <div class="color" style="background: {value};">
                <p style="color: var(--outline-color);"><T id="actions.choose_custom" /></p>
                <input class="colorpicker" style={(height ? "height: " + height + "px;" : "") + (width ? "width: " + width + "px;" : "")} type="color" bind:value on:input={input} on:change={change} />
            </div>
        </div>
    {/if}
</div>

<style>
    .textfield {
        position: relative;
        width: 100%;
        border-bottom: 1.2px solid var(--primary-lighter);
    }
    .background {
        position: absolute;
        inset: 0;
        background-color: var(--primary-darkest);
        border-radius: 4px 4px 0 0;
    }
    .color-display {
        position: relative;

        height: 3rem;
        border-radius: 4px;
        border: 2px solid transparent;
        cursor: pointer;

        transition: 0.2s background-color;

        /* margin-left: 200px; */
    }
    .color-display:hover {
        outline: 2px solid var(--outline-color);
        outline-offset: -2px;
    }
    label {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        left: 0.75rem;
        font-size: 1.1rem;
        color: var(--outline-color);
        opacity: 0.8;
        transition: all 0.2s ease;

        padding: 10px;
        /* background-color: var(--primary-darkest); */
        background-color: rgb(0 0 0 / 0.8);
        color: var(--text);
        border-radius: 4px;

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
    .textfield:not(.disabled):hover .underline {
        transform: scaleX(1);
    }
    .picker {
        position: absolute;
        top: 100%;
        left: 0;
        background: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        display: flex;
        flex-wrap: wrap;
        z-index: 10;

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
    }
    .pickColor:hover {
        border: 2px solid #ddd !important;
    }
    .pickColor.active {
        border: 2px solid var(--secondary);
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
    }
    .color:hover {
        outline: 2px solid var(--outline-color) !important;
        outline-offset: -2px;
    }

    input[type="color"] {
        position: absolute;

        opacity: 0;
        width: 100%;
        border: none;
    }
</style>
