<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import { uid } from "uid"
    import { activePopup, popupData, special } from "../../stores"
    import { translateText } from "../../utils/language"
    import { addOpacityToGradient, getGradientOpacity } from "../edit/scripts/edit"
    import { defaultColors, defaultGradients, getContrast, hexToRgb, rgbToHex, splitRgb } from "../helpers/color"
    import Icon from "../helpers/Icon.svelte"
    import Tabs from "../main/Tabs.svelte"
    import MaterialButton from "./MaterialButton.svelte"
    import MaterialNumberInput from "./MaterialNumberInput.svelte"

    export let value = "#000000"
    export let defaultValue = ""
    export let label: string
    export let noLabel = false
    export let allowGradients = false
    export let allowOpacity = false
    export let allowEmpty = false
    export let alwaysVisible = false
    export let editMode = false
    export let disabled = false
    export let height = 0
    export let width = 0

    $: hexValue = getHexValue(value)
    function getHexValue(value: string) {
        if (value.includes("gradient")) {
            if (!pickerOpen) opacity = getGradientOpacity(value) * 100
            return value
        }

        if (value.startsWith("#")) return value
        if (value.includes("rgb")) {
            opacity = splitRgb(value).a * 100
            return rgbToHex(value)
        }

        return value
    }

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

        // if (pickerOpen) dispatch("change", hexValue)

        pickerOpen = false
    }

    function colorUpdate(color: string) {
        if (editMode) return color

        hexValue = color
        let actualValue = hexValue

        if (opacity === 0) opacity = 100
        if (allowOpacity && opacity < 100) {
            if (hexValue.includes("gradient")) actualValue = addOpacityToGradient(hexValue, opacity / 100)
            else {
                const rgb = hexToRgb(hexValue)
                actualValue = `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${opacity / 100})`
            }
        }

        return actualValue
    }

    function selectColor(c: string, close = true) {
        let actualValue = colorUpdate(c)

        dispatch("change", actualValue)
        dispatch("input", actualValue)

        if (close) pickerOpen = false
    }

    function change(e: any) {
        dispatch("change", colorUpdate(e.target?.value))
    }

    function input(e: any) {
        dispatch("input", colorUpdate(e.target?.value))
    }

    function reset() {
        resetFromValue = hexValue
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

    let mounted = false
    let colorElem: HTMLDivElement | undefined
    let isOverflowing = false
    onMount(() => {
        mounted = true

        if (!colorElem) return
        isOverflowing = colorElem.getBoundingClientRect().left + colorElem.clientWidth / 2 + 200 > window.innerWidth
    })

    // GRADIENTS

    const tabs = { normal: { name: "color.normal", icon: "color" }, gradient: { name: "color.gradient", icon: "gradient" } }
    $: selectedMode = allowGradients ? getCurrentMode(hexValue) : "normal"
    function getCurrentMode(value: string) {
        if (typeof value === "string" && value.includes("gradient")) return "gradient"
        return "normal"
    }

    $: disabledColors = $special.disabledColors || []
    $: disabledGradientColors = $special.disabledColorsGradient || []

    $: customColors = ($special.customColors || []).map((value) => ({ name: "", value }))
    $: colorsList = editMode ? [...defaultColors, "BREAK", ...customColors] : [...defaultColors, ...customColors]
    $: if (!editMode) colorsList = colorsList.filter((a) => !disabledColors.includes(a.value))

    $: customGradients = ($special.customColorsGradient || []).map((value) => ({ name: "", value }))
    $: gradientColorsList = editMode ? [...defaultGradients, "BREAK", ...customGradients] : [...defaultGradients, ...customGradients]
    $: if (!editMode) gradientColorsList = gradientColorsList.filter((a) => !disabledGradientColors.includes(a.value))

    // OPACITY

    // A layer with 100% opacity is completely solid and visible, while a layer with 0% opacity is completely transparent and invisible.
    let opacity = 100
    let updated: NodeJS.Timeout | null = null
    let gotUpdate = false
    $: if (opacity) opacityChanged()
    function opacityChanged() {
        if (!allowOpacity || !mounted) return

        if (updated) {
            gotUpdate = true
            return
        }

        updated = setTimeout(() => {
            selectColor(hexValue, false)
            updated = null
            if (gotUpdate) {
                gotUpdate = false
                opacityChanged()
            }
        }, 50)
    }
</script>

<svelte:window on:mousedown={mousedown} />

<div id={pickerId} bind:this={colorElem} class="textfield {disabled ? 'disabled' : ''}" aria-disabled={disabled} tabindex={disabled ? -1 : 0} style="--outline-color: {getContrast(hexValue)};{$$props.style || ''}" on:keydown={handleKey}>
    {#if !alwaysVisible}
        <div class="background" on:click={togglePicker} />

        <div class="color-display" data-title={noLabel ? translateText(label) : ""} style="background:{value || 'transparent'};{noLabel ? 'margin-left: var(--margin);' : ''}" on:click={togglePicker}></div>

        {#if !noLabel || value === ""}
            <label>{@html translateText(label)}</label>
        {/if}
        <span class="underline" />
    {/if}

    {#if pickerOpen || alwaysVisible}
        <div class="picker" class:isOverflowing class:alwaysVisible style={noLabel && !isOverflowing ? "left: 0;transform: initial;" : ""}>
            {#if allowGradients || editMode}
                <Tabs {tabs} bind:active={selectedMode} style="flex: 1;border-top-left-radius: 8px;border-top-right-radius: 8px;" />
            {/if}

            <div class="pickerContent">
                {#if selectedMode === "gradient"}
                    {#each gradientColorsList as color}
                        {@const isCustom = editMode && customGradients.find((a) => a.value === color.value)}

                        {#if color === "BREAK"}
                            <div style="display: block;margin: 10px;width: 100%;"></div>
                        {:else}
                            <div
                                class="pickColor"
                                class:active={!editMode && hexValue === color.value}
                                class:disabled={disabledGradientColors.includes(color.value)}
                                data-title={color.name}
                                style="background: {color.value};"
                                tabindex="0"
                                aria-label="Select gradient {color.name || color.value}"
                                on:click={() => selectColor(color.value)}
                            >
                                {#if editMode}
                                    <div class="hover" class:visible={disabledGradientColors.includes(color.value)}>
                                        <Icon id={isCustom ? "delete" : "disable"} white style="fill: {getContrast(color.value)};" />
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    {/each}

                    {#if allowOpacity}
                        <div class="opacity">
                            <MaterialNumberInput label="edit.opacity" value={Math.round(opacity)} min={1} max={100} on:change={(e) => (opacity = Math.round(e.detail))} showSlider />
                        </div>
                    {/if}

                    <MaterialButton
                        style="width: 100%;margin-top: 5px;background: {hexValue} !important;"
                        on:click={() => {
                            popupData.set({
                                value: hexValue,
                                trigger: (newValue) => {
                                    selectColor(newValue)
                                    if (editMode) setTimeout(() => activePopup.set("manage_colors"))
                                }
                            })
                            activePopup.set("color_gradient")
                        }}
                        center
                    >
                        <p style="color: var(--outline-color);">{translateText("actions." + (editMode ? "add_color" : "choose_custom"))}</p>
                    </MaterialButton>
                {:else}
                    {#if allowEmpty}
                        <div
                            data-value={""}
                            class="pickColor noColor"
                            class:active={value === ""}
                            data-title={translateText("settings.remove")}
                            tabindex="0"
                            on:click={() => {
                                opacity = 100
                                selectColor("")
                            }}
                        >
                            <Icon id="close" white />
                        </div>
                    {/if}
                    {#each colorsList as color}
                        {@const isCustom = editMode && customColors.find((a) => a.value === color.value)}

                        {#if color === "BREAK"}
                            <div style="display: block;margin: 10px;width: 100%;"></div>
                        {:else}
                            <div
                                data-value={color.value}
                                class="pickColor"
                                class:active={!editMode && hexValue.toLowerCase() === color.value.toLowerCase()}
                                class:disabled={disabledColors.includes(color.value)}
                                data-title={color.name}
                                tabindex="0"
                                style="background:{color.value};--outline-color: {getContrast(color.value)};"
                                on:click={() => selectColor(color.value)}
                            >
                                {#if editMode}
                                    <div class="hover" class:visible={disabledColors.includes(color.value)}>
                                        <Icon id={isCustom ? "delete" : "disable"} white style="fill: {getContrast(color.value)};" />
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    {/each}

                    {#if allowOpacity}
                        <div class="opacity">
                            <MaterialNumberInput label="edit.opacity" value={Math.round(opacity)} min={1} max={100} on:change={(e) => (opacity = Math.round(e.detail))} showSlider />
                        </div>
                    {/if}

                    <div class="color" style="background: {hexValue};">
                        <p style="color: var(--outline-color);">{translateText("actions." + (editMode ? "add_color" : "choose_custom"))}</p>
                        <input class="colorpicker" style={(height ? "height: " + height + "px;" : "") + (width ? "width: " + width + "px;" : "")} type="color" bind:value={hexValue} on:input={input} on:change={change} />
                    </div>
                {/if}
            </div>
        </div>
    {/if}

    {#if defaultValue}
        <div class="remove">
            {#if hexValue !== defaultValue}
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

        --margin: 6px;
        min-height: 50px;
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

        top: var(--margin);
        height: calc(100% - (var(--margin) * 2));
        margin-right: var(--margin);
        /* margin-left: 200px; */
        margin-left: 50%;

        top: 50%;
        transform: translateY(-50%);
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
        /* display: flex;
        flex-wrap: wrap; */
        z-index: 10;

        cursor: default;

        --width: 200px;
        --padding: 10px;
        --gap: 5px;
        width: var(--width);
        /* padding: var(--padding); */
        /* gap: var(--gap); */

        display: flex;
        flex-wrap: wrap;

        box-shadow: 0 0 5px 5px rgb(0 0 0 / 0.2);
    }
    .picker.isOverflowing {
        left: unset;
        right: 0;
    }

    .pickerContent {
        padding: var(--padding);
        display: flex;
        flex-wrap: wrap;
        gap: var(--gap);
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

    .pickerContent :global(button) {
        padding: 15px;
        font-weight: normal;
        font-size: 1em;
        border: 2px solid transparent;
    }
    .pickerContent :global(button:hover) {
        border-color: var(--outline-color) !important;
    }

    /* opacity */

    .opacity {
        display: block;
        width: 100%;
        padding-top: 5px;
    }

    /* ALWAYS VISIBLE */

    .textfield:has(.picker.alwaysVisible) {
        height: unset;
    }
    .picker.alwaysVisible {
        position: relative;
        top: unset;
        left: unset;

        box-shadow: none;

        width: 100%;
    }
    .picker.alwaysVisible .pickerContent {
        width: 100%;
    }

    /* MANAGE */

    .pickColor.disabled {
        opacity: 0.5;
        /* filter: blur(3px); */
    }
    .pickColor .hover {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
    }
    .pickColor .hover:not(.visible) {
        display: none;
    }
    .pickColor:hover .hover {
        display: flex;
    }
</style>
