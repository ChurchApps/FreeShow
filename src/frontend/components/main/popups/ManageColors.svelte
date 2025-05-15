<script lang="ts">
    import { activePopup, popupData, special } from "../../../stores"
    import { getContrast } from "../../helpers/color"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import Button from "../../inputs/Button.svelte"
    import Color from "../../inputs/Color.svelte"

    function toggleColor(e, key = "customColors") {
        let color = e.detail || e.target?.value

        special.update((a) => {
            let colors = a[key] || []

            let existing = colors.indexOf(color)
            if (existing >= 0) colors.splice(existing, 1)
            else {
                previewColor = ""
                colors.push(color)
            }

            a[key] = colors

            return a
        })
    }

    let previewColor = ""
    function setPreviewColor(e: any) {
        previewColor = e.target?.value || ""
    }
</script>

<div class="info">
    <p><T id="actions.click_disable" /></p>
</div>

<Color value="" on:input={(e) => toggleColor(e, "disabledColors")} visible showDisabled />

<Color value="" on:input={toggleColor} visible custom />

<div class="color" style="margin-top: 10px;padding: 5px;background-color: {previewColor};color: {getContrast(previewColor)};">
    <p><T id="actions.add_color" /></p>
    <input class="colorpicker" type="color" on:change={toggleColor} on:input={setPreviewColor} />
</div>

<HRule title="color.gradient" />

<Color value="" on:input={(e) => toggleColor(e, "disabledColorsGradient")} allowGradients visible showDisabled />

<Color value="" on:input={(e) => toggleColor(e, "customColorsGradient")} allowGradients visible custom />

<Button
    style="width: 100%;margin-top: 10px;border: 2px solid var(--primary-darker);"
    on:click={() => {
        popupData.set({
            value: "",
            trigger: (newValue) => {
                toggleColor({ detail: newValue }, "customColorsGradient")
                setTimeout(() => activePopup.set("manage_colors"))
            }
        })
        activePopup.set("color_gradient")
    }}
    center
>
    <p style="width: 100%;justify-content: center;font-weight: normal;"><T id="actions.add_color" /></p>
</Button>

<style>
    .info {
        display: flex;
        justify-content: center;

        margin-bottom: 10px;
        font-style: italic;
        opacity: 0.8;
    }

    .color {
        border: 2px solid var(--primary-darker);
        transition: background-color 0.2s;
        position: relative;
    }
    .color:hover {
        outline: 2px solid #ddd !important;
        outline-offset: -2px;
    }

    input[type="color"] {
        opacity: 0;
        width: 100%;
        border: none;
    }

    .color p {
        position: absolute;
        pointer-events: none;
        border: none;
        width: 100%;
        justify-content: center;

        text-align: center;
    }
</style>
