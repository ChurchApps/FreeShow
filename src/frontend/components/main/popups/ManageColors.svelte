<script lang="ts">
    import { special } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import Color from "../../inputs/Color.svelte"

    function toggleColor(e, key = "customColors") {
        let color = e.detail || e.target?.value

        special.update((a) => {
            let colors = a[key] || []

            let existing = colors.indexOf(color)
            if (existing >= 0) colors.splice(existing, 1)
            else colors.push(color)

            a[key] = colors

            return a
        })
    }
</script>

<div class="info">
    <p><T id="actions.click_disable" /></p>
</div>

<Color value="" on:input={(e) => toggleColor(e, "disabledColors")} visible showDisabled />

<Color value="" on:input={toggleColor} visible custom />

<div class="color" style="margin-top: 10px;padding: 5px;">
    <p><T id="actions.add_color" /></p>
    <input class="colorpicker" type="color" on:change={toggleColor} />
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
