<script lang="ts">
    import { special } from "../../../stores"
    import { getContrast } from "../../helpers/color"
    import T from "../../helpers/T.svelte"
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
