<script lang="ts">
    import { onMount } from "svelte"
    import { special } from "../../../stores"
    import { defaultColors, defaultGradients } from "../../helpers/color"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
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

    let clipboardColors: string[] = []
    onMount(() => {
        navigator.clipboard.readText().then((text) => {
            text = text.trim().replaceAll('"', "").replaceAll("'", "").replace("[", "").replace("]", "")

            const parts = text.includes("rgb") ? [text] : text.split(/[\s,]+/)
            parts.forEach((c) => {
                c = c.trim()

                // let isHex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
                if (isValidColor(c) && !$special.customColors?.includes(c)) clipboardColors.push(c)
            })

            clipboardColors = [...new Set(clipboardColors)]
        })

        function isValidColor(color) {
            const s = new Option().style
            s.color = color
            return s.color !== ""
        }
    })

    function addClipboardColors() {
        clipboardColors.forEach((color) => changeColor({ detail: color }))
        clipboardColors = []
    }
</script>

<div class="info">
    <p><T id="actions.click_disable" /></p>
</div>

<MaterialColorInput label="" value="" on:change={changeColor} alwaysVisible editMode />

<span style="font-size: 0;position: absolute;">{console.log(clipboardColors)}</span>
{#if clipboardColors.length}
    <MaterialButton variant="outlined" icon="paste" style="margin-top: 10px;" on:click={addClipboardColors}>
        <T id="actions.paste" />
    </MaterialButton>
{/if}

<style>
    .info {
        display: flex;
        justify-content: center;

        margin-bottom: 10px;
        font-style: italic;
        opacity: 0.7;
        font-size: 0.9em;
    }
</style>
