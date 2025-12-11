<script lang="ts">
    import { special } from "../../../stores"
    import { defaultColors, defaultGradients } from "../../helpers/color"
    import T from "../../helpers/T.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"

    function changeColor(e, key = "") {
        let color = e.detail || e.target?.value || ""

        if (color.includes("gradient")) key = defaultGradients.find((a) => a.value === color) ? "disabledColorsGradient" : "customColorsGradient"
        else key = defaultColors.find((a) => a.value === color) ? "disabledColors" : "customColors"

        special.update((a) => {
            let colors = a[key] || []

            let existing = colors.indexOf(color)
            if (existing >= 0) colors.splice(existing, 1)
            else {
                colors.push(color)
            }

            a[key] = colors

            return a
        })
    }
</script>

<div class="info">
    <p><T id="actions.click_disable" /></p>
</div>

<MaterialColorInput label="" value="" on:change={changeColor} alwaysVisible editMode />

<style>
    .info {
        display: flex;
        justify-content: center;

        margin-bottom: 10px;
        font-style: italic;
        opacity: 0.8;
        opacity: 0.7;
        font-size: 0.9em;
    }
</style>
