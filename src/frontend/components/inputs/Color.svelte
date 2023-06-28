<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { uid } from "uid"
    import { getContrast } from "../helpers/color"
    import T from "../helpers/T.svelte"

    export let value: any = "#FFF"
    export let visible: boolean = false
    export let height: number = 0
    export let width: number = 0

    // https://clrs.cc/
    const colors = [
        { name: "White", value: "#FFFFFF" },
        { name: "Silver", value: "#DDDDDD" },
        { name: "Gray", value: "#AAAAAA" },
        { name: "Red", value: "#FF4136" },
        { name: "Orange", value: "#FF851B" },
        { name: "Yellow", value: "#FFDC00" },
        { name: "Green", value: "#2ECC40" },
        { name: "Lime", value: "#01FF70" },
        { name: "Olive", value: "#3D9970" },
        { name: "Teal", value: "#39CCCC" },
        { name: "Aqua", value: "#7FDBFF" },
        { name: "Blue", value: "#0074D9" },
        { name: "Navy", value: "#001f3f" },
        { name: "Purple", value: "#B10DC9" },
        { name: "Fuchsia", value: "#F012BE" },
        { name: "Maroon", value: "#85144b" },
        { name: "Black", value: "#000000" },
    ]

    let dispatch = createEventDispatcher()
    function change(e) {
        let value = e.target?.value || e
        if (!value) return

        dispatch("input", value)
    }

    let pickerId: string = "picker_" + uid()
    let pickerOpen: boolean = false
    function togglePicker(e: any) {
        if (e.target.closest(".picker") || e.target.closest(".colorpicker")) return

        pickerOpen = !pickerOpen
    }
    function mousedown(e: any) {
        if (e.target.closest("#" + pickerId) || (e.target.closest(".colorpicker") && !e.target.closest(".pickColor"))) return

        pickerOpen = false
    }

    let colorElem
    let clipRight: boolean = false
    $: if (colorElem) {
        let pickerRect = colorElem.getBoundingClientRect()
        let pickerRight = pickerRect.left + 200
        let pageWidth = document.body.getBoundingClientRect()?.width
        if (pickerRight > pageWidth) clipRight = true
    }
</script>

<svelte:window on:mousedown={mousedown} />

{#if visible}
    <div class="picker" class:visible class:clipRight>
        <div class="colors">
            {#each colors as color}
                <div class="pickColor" class:active={value === color.value} title={color.name} style="background-color: {color.value};" on:click={() => change(color.value)} />
            {/each}
        </div>

        <div class="color" style="margin-top: 10px;background-color: {value};">
            <p style="color: {getContrast(value)};"><T id="actions.choose_custom" /></p>
            <input class="colorpicker" style={(height ? "height: " + height + "px;" : "") + (width ? "width: " + width + "px;" : "")} type="color" bind:value on:input={change} />
        </div>
    </div>
{:else}
    <div bind:this={colorElem} id={pickerId} class="color" style={(height ? "height: " + height + "px;" : "") + (width ? "width: " + width + "px;" : "") + "background-color: " + value + ";" + ($$props.style || "")} on:click={togglePicker}>
        {#if pickerOpen}
            <div class="picker" class:clipRight bind:this={colorElem}>
                <div class="colors">
                    {#each colors as color}
                        <div
                            class="pickColor"
                            class:active={value === color.value}
                            title={color.name}
                            style="background-color: {color.value};"
                            on:click={() => {
                                change(color.value)
                                setTimeout(() => {
                                    pickerOpen = false
                                }, 10)
                            }}
                        />
                    {/each}
                </div>

                <div class="color" style="margin-top: 10px;padding: 5px;background-color: {value};">
                    <p style="color: {getContrast(value)};"><T id="actions.choose_custom" /></p>
                    <input class="colorpicker" style={(height ? "height: " + height + "px;" : "") + (width ? "width: " + width + "px;" : "")} type="color" bind:value on:input={change} />
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    .color {
        border: 2px solid var(--primary-darker);
        transition: background-color 0.2s;
        position: relative;
    }
    /* filter: brightness(0.98); */
    /* .color:not(.picker):hover {
        opacity: 0.98;
    } */

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
        gap: 5px;
        border: none;
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
</style>
