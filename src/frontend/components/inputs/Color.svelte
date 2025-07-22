<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { uid } from "uid"
    import { activePopup, dictionary, popupData, special } from "../../stores"
    import { triggerClickOnEnterSpace } from "../../utils/clickable"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { defaultColors, defaultGradients, getContrast } from "../helpers/color"
    import Button from "./Button.svelte"

    export let value = "#FFF"
    export let visible = false
    export let enableNoColor = false
    export let showDisabled = false
    export let custom = false
    export let rightAlign = false
    export let allowGradients = false
    export let height = 0
    export let width = 0

    let dispatch = createEventDispatcher()
    function change(e, update = false) {
        let value = e?.target?.value || e
        if (value === undefined) return

        // if (!update && mousePressed) update = true
        if (update) dispatch("input", value)
    }

    let pickerId: string = "picker_" + uid()
    let pickerOpen = false
    function togglePicker(e: any) {
        if (e.target.closest(".picker") || e.target.closest(".colorpicker")) return

        pickerOpen = !pickerOpen
    }
    // let mousePressed: boolean = false
    function mousedown(e: any) {
        // mousePressed = true
        if (e.target.closest("#" + pickerId) || (e.target.closest(".colorpicker") && !e.target.closest(".pickColor"))) return
        if (e.target.closest(".color")) return

        // WIP only updating every other time when clicking another place than inside the "Textbox" style area
        if (pickerOpen) change(value, true)

        pickerOpen = false
    }

    let colorElem
    let clipRight: boolean = rightAlign || false
    $: if (colorElem) {
        let pickerRect = colorElem.getBoundingClientRect()
        let pickerRight = pickerRect.left + 200
        let pageWidth = document.body.getBoundingClientRect()?.width
        if (pickerRight > pageWidth) clipRight = true
    }

    $: customColors = ($special.customColors || []).map((value) => ({ name: "", value }))
    $: colors = custom ? customColors : showDisabled ? defaultColors : [...defaultColors, ...customColors]
    $: if (!showDisabled) colors = colors.filter((a) => !$special.disabledColors?.includes(a.value))

    // GRADIENTS

    const modes = ["normal", "gradient"]
    $: selectedMode = allowGradients ? getCurrentMode(value) : "normal"
    function getCurrentMode(value: string) {
        if (value.includes("gradient")) return "gradient"
        return "normal"
    }

    $: customGradients = ($special.customColorsGradient || []).map((value) => ({ name: "", value }))
    $: gradientColors = custom ? customGradients : showDisabled ? defaultGradients : [...defaultGradients, ...customGradients]
    $: if (!showDisabled) gradientColors = gradientColors.filter((a) => !$special.disabledColorsGradient?.includes(a.value))

    $: disabledColors = (allowGradients ? $special.disabledColorsGradient : $special.disabledColors) || []
    $: colorsList = allowGradients ? gradientColors : colors
</script>

<!-- on:mouseup={() => (mousePressed = false)} -->
<svelte:window on:mousedown={mousedown} />

{#if visible}
    {#if colorsList.length || (!showDisabled && !custom)}
        <div class="picker" style="padding: 10px;" class:visible class:clipRight>
            <div class="colors">
                {#if enableNoColor}
                    <div class="pickColor noColor" class:active={!value} title={$dictionary.settings?.remove} tabindex="0" role="button" aria-label="Remove color" on:click={() => change("", true)} on:keydown={triggerClickOnEnterSpace}>
                        <Icon id="close" white />
                    </div>
                {/if}
                {#each colorsList as color}
                    <div
                        class="pickColor"
                        class:disabled={disabledColors.includes(color.value)}
                        class:active={value === color.value}
                        title={color.name}
                        style="background: {color.value};"
                        tabindex="0"
                        role="button"
                        aria-label="Select color {color.name || color.value}"
                        on:click={() => change(color.value, true)}
                        on:keydown={triggerClickOnEnterSpace}
                    >
                        {#if showDisabled || custom}
                            <div class="hover" class:visible={!custom && disabledColors.includes(color.value)}>
                                <Icon id={custom ? "delete" : "disable"} white style="fill: {getContrast(color.value)};" />
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>

            {#if !showDisabled && !custom}
                {#if allowGradients}
                    <Button
                        style="width: 100%;margin-top: 10px;background: {value};"
                        on:click={() => {
                            popupData.set({ value, trigger: (newValue) => change(newValue, true) })
                            activePopup.set("color_gradient")
                        }}
                        center
                    >
                        <p style="color: {getContrast(value)};width: 100%;justify-content: center;font-weight: normal;"><T id="actions.choose_custom" /></p>
                    </Button>
                {:else}
                    <div class="color" style="margin-top: 10px;background: {value};">
                        <p style="color: {getContrast(value)};"><T id="actions.choose_custom" /></p>
                        <input class="colorpicker" style={(height ? "height: " + height + "px;" : "") + (width ? "width: " + width + "px;" : "")} type="color" bind:value on:input={change} on:change={(e) => change(e, true)} />
                    </div>
                {/if}
            {/if}
        </div>
    {/if}
{:else}
    <div
        bind:this={colorElem}
        id={pickerId}
        class="color"
        style="--outline-color: {getContrast(value)};{(height ? 'height: ' + height + 'px;' : '') + (width ? 'width: ' + width + 'px;' : '') + 'background: ' + value + ';' + ($$props.style || '')}"
        tabindex="0"
        role="button"
        aria-label="Open color picker"
        on:click={togglePicker}
        on:keydown={triggerClickOnEnterSpace}
    >
        {#if pickerOpen}
            <div class="picker" class:clipRight bind:this={colorElem}>
                {#if allowGradients}
                    <div style="display: flex;min-height: auto;background-color: var(--primary-darkest);">
                        {#each modes as type}
                            <Button
                                on:click={() => (selectedMode = type)}
                                style="flex: 1;border-bottom: 2px solid {selectedMode === type ? 'var(--secondary)' : 'var(--primary-lighter)'} !important;white-space: nowrap;padding: 0.2em !important;"
                                bold={false}
                                center
                            >
                                <!-- <Icon id={type === "media" ? "image" : type} right /> -->
                                <T id="color.{type}" />
                            </Button>
                        {/each}
                    </div>
                {/if}

                <div style="padding: 10px;">
                    {#if selectedMode === "gradient"}
                        <div class="colors" style="min-height: initial;">
                            {#each gradientColors as color}
                                <div
                                    class="pickColor"
                                    class:active={value === color.value}
                                    title={color.name}
                                    style="background: {color.value};"
                                    tabindex="0"
                                    role="button"
                                    aria-label="Select gradient {color.name || color.value}"
                                    on:click={() => {
                                        change(color.value, true)
                                        setTimeout(() => {
                                            pickerOpen = false
                                        }, 10)
                                    }}
                                    on:keydown={triggerClickOnEnterSpace}
                                />
                            {/each}
                        </div>

                        <Button
                            style="width: 100%;margin-top: 10px;background: {value};"
                            on:click={() => {
                                popupData.set({ value, trigger: (newValue) => change(newValue, true) })
                                activePopup.set("color_gradient")
                            }}
                            center
                        >
                            <p style="color: {getContrast(value)};width: 100%;justify-content: center;font-weight: normal;"><T id="actions.choose_custom" /></p>
                        </Button>
                    {:else}
                        {#if enableNoColor || colors.length}
                            <div class="colors">
                                {#if enableNoColor}
                                    <div
                                        class="pickColor noColor"
                                        class:active={!value}
                                        title={$dictionary.settings?.remove}
                                        tabindex="0"
                                        role="button"
                                        aria-label="Remove color"
                                        on:click={() => {
                                            change("", true)
                                            setTimeout(() => {
                                                pickerOpen = false
                                            }, 10)
                                        }}
                                        on:keydown={triggerClickOnEnterSpace}
                                    >
                                        <Icon id="close" white />
                                    </div>
                                {/if}
                                {#each colors as color}
                                    <div
                                        class="pickColor"
                                        class:active={value === color.value}
                                        title={color.name}
                                        style="background-color: {color.value};"
                                        tabindex="0"
                                        role="button"
                                        aria-label="Select color {color.name || color.value}"
                                        on:click={() => {
                                            change(color.value, true)
                                            setTimeout(() => {
                                                pickerOpen = false
                                            }, 10)
                                        }}
                                        on:keydown={triggerClickOnEnterSpace}
                                    />
                                {/each}
                            </div>
                        {/if}

                        <div class="color" style="margin-top: 10px;padding: 5px;background: {value};">
                            <p style="color: {getContrast(value)};"><T id="actions.choose_custom" /></p>
                            <input class="colorpicker" style={(height ? "height: " + height + "px;" : "") + (width ? "width: " + width + "px;" : "")} type="color" bind:value on:input={change} on:change={(e) => change(e, true)} />
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    .color {
        /* border: 2px solid var(--primary-darker); */
        transition: background-color 0.2s;
        position: relative;
        border-radius: var(--border-radius);

        /* transition: outline-width 0.1s; */
    }
    /* filter: brightness(0.98); */
    /* .color:not(.picker):hover {
        opacity: 0.98;
    } */
    .color:hover {
        outline: 2px solid var(--outline-color) !important;
        outline-offset: -2px;
    }

    input[type="color"] {
        opacity: 0;
        width: 100%;
        border: none;
    }

    .picker {
        position: absolute;
        bottom: 0;
        inset-inline-start: -1px;
        transform: translateY(100%);

        /* border-radius: var(--border-radius); */
        border-radius: 4px;

        background-color: var(--primary-darker);
        border: 2px solid var(--primary-lighter);
        z-index: 5;
        width: 200px;
    }
    .picker.clipRight {
        inset-inline-start: unset;
        inset-inline-end: 0;
    }

    .picker.visible {
        position: initial;
        transform: initial;
        width: 100%;
        border: none;
    }

    .colors {
        display: flex;
        flex-wrap: wrap;
        /* justify-content: space-between; */
        /* justify-content: center; */
        gap: 5px;
        border: none;
        border-inline-end: none !important;
    }

    .picker .color p {
        position: absolute;
        pointer-events: none;
        border: none;
        width: 100%;
        justify-content: center;

        text-align: center;
    }

    .pickColor {
        min-height: unset !important;
        min-width: unset !important;
        flex: unset !important;
        border: none !important;

        cursor: pointer;

        height: 30px;
        width: 30px;
    }
    .pickColor:hover {
        border: 2px solid #ddd !important;
    }
    .pickColor.active {
        border: 2px solid var(--secondary) !important;
    }
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

    .noColor {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--primary);
    }
</style>
