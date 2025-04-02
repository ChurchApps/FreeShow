<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { uid } from "uid"
    import { dictionary, special } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { defaultColors, getContrast } from "../helpers/color"

    export let value: string = "#FFF"
    export let visible: boolean = false
    export let enableNoColor: boolean = false
    export let showDisabled: boolean = false
    export let custom: boolean = false
    export let rightAlign: boolean = false
    export let height: number = 0
    export let width: number = 0

    let dispatch = createEventDispatcher()
    function change(e, update = false) {
        let value = e?.target?.value || e
        if (value === undefined) return

        // if (!update && mousePressed) update = true
        if (update) dispatch("input", value)
    }

    let pickerId: string = "picker_" + uid()
    let pickerOpen: boolean = false
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
</script>

<!-- on:mouseup={() => (mousePressed = false)} -->
<svelte:window on:mousedown={mousedown} />

{#if visible}
    {#if colors.length || (!showDisabled && !custom)}
        <div class="picker" class:visible class:clipRight>
            <div class="colors">
                {#each colors as color}
                    <div class="pickColor" class:disabled={$special.disabledColors?.includes(color.value)} class:active={value === color.value} title={color.name} style="background-color: {color.value};" on:click={() => change(color.value, true)}>
                        <div class="hover" class:visible={!custom && $special.disabledColors?.includes(color.value)}>
                            <Icon id={custom ? "delete" : "disable"} white style="fill: {getContrast(color.value)};" />
                        </div>
                    </div>
                {/each}
            </div>

            {#if !showDisabled && !custom}
                <div class="color" style="margin-top: 10px;background-color: {value};">
                    <p style="color: {getContrast(value)};"><T id="actions.choose_custom" /></p>
                    <input class="colorpicker" style={(height ? "height: " + height + "px;" : "") + (width ? "width: " + width + "px;" : "")} type="color" bind:value on:input={change} on:change={(e) => change(e, true)} />
                </div>
            {/if}
        </div>
    {/if}
{:else}
    <div
        bind:this={colorElem}
        id={pickerId}
        class="color"
        style="--outline-color: {getContrast(value)};{(height ? 'height: ' + height + 'px;' : '') + (width ? 'width: ' + width + 'px;' : '') + 'background-color: ' + value + ';' + ($$props.style || '')}"
        on:click={togglePicker}
    >
        {#if pickerOpen}
            <div class="picker" class:clipRight bind:this={colorElem}>
                {#if enableNoColor || colors.length}
                    <div class="colors">
                        {#if enableNoColor}
                            <div
                                class="pickColor noColor"
                                class:active={!value}
                                title={$dictionary.settings?.remove}
                                on:click={() => {
                                    change("", true)
                                    setTimeout(() => {
                                        pickerOpen = false
                                    }, 10)
                                }}
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
                                on:click={() => {
                                    change(color.value, true)
                                    setTimeout(() => {
                                        pickerOpen = false
                                    }, 10)
                                }}
                            />
                        {/each}
                    </div>
                {/if}

                <div class="color" style="margin-top: 10px;padding: 5px;background-color: {value};">
                    <p style="color: {getContrast(value)};"><T id="actions.choose_custom" /></p>
                    <input class="colorpicker" style={(height ? "height: " + height + "px;" : "") + (width ? "width: " + width + "px;" : "")} type="color" bind:value on:input={change} on:change={(e) => change(e, true)} />
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
        left: -1px;
        transform: translateY(100%);

        background-color: var(--primary-darker);
        border: 2px solid var(--primary-lighter);
        z-index: 5;
        padding: 10px;
        width: 200px;
    }
    .picker.clipRight {
        left: unset;
        right: 0;
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
        border-right: none !important;
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
