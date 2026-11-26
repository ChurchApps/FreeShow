<script lang="ts">
    import { drawSettings, drawTool, paintCache } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { clone } from "../helpers/array"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialCheckbox from "../inputs/MaterialCheckbox.svelte"
    import MaterialColorInput from "../inputs/MaterialColorInput.svelte"
    import MaterialNumberInput from "../inputs/MaterialNumberInput.svelte"
    import Tabs from "../main/Tabs.svelte"
    import { clearDrawing } from "../output/clear"
    import { DEFAULT_DRAW_SETTINGS, ensureDrawSettings } from "./drawSettings"

    $: tool = $drawTool

    const update = (value: any, key: string) => {
        drawSettings.update((a) => {
            a[tool][key] = value
            return a
        })
    }

    function reset() {
        drawSettings.update((a) => {
            a[tool] = clone(DEFAULT_DRAW_SETTINGS[tool] || {})
            return a
        })
    }

    // $: if (!Object.keys($drawSettings[tool] || {}).length) reset()
    $: if (tool) ensureDrawSettings(tool)
</script>

<!-- {#if tool === "paint"}
    <MaterialButton style="background-color: var(--primary-darker);" disabled={!$paintCache?.length} on:click={clearDrawing} red={!!$paintCache?.length}>
        <Icon id="clear" size={1.2} white />
        <T id="clear.drawing" />
    </MaterialButton>
{/if} -->

<Tabs tabs={{ tool: { name: "draw." + tool, icon: tool } }} active="tool" />

<div class="main">
    {#each Object.entries($drawSettings[tool] || {}) as [key, value]}
        {@const hidden = key === "hold" && tool === "paint"}

        {#if !hidden}
            {#if key === "color"}
                <MaterialColorInput label="edit.color" {value} on:change={(e) => update(e.detail, key)} />
            {:else if key === "opacity"}
                <MaterialNumberInput label="edit.opacity" value={value * 10} min={1} max={10} on:change={(e) => update(e.detail / 10, key)} />
            {:else if key === "radius"}
                <MaterialNumberInput label="draw.radius" value={value * 2} max={100} on:change={(e) => update(e.detail / 2, key)} />
            {:else if key === "size"}
                <MaterialNumberInput label="edit.size" {value} min={1} max={2000} step={10} defaultValue={tool === "zoom" ? 100 : null} on:change={(e) => update(e.detail, key)} />
            {:else if key !== "clear"}
                <MaterialCheckbox label="draw.{key}" checked={value} on:change={(e) => update(e.detail, key)} />
            {/if}
        {/if}
    {/each}
</div>

<FloatingInputs>
    {#if tool === "paint"}
        <MaterialButton disabled={!$paintCache?.length} on:click={clearDrawing} red={!!$paintCache?.length}>
            <Icon id="clear" size={1.2} white />
            <T id="clear.drawing" />
        </MaterialButton>

        <div class="divider" />
    {/if}

    <MaterialButton icon="reset" title="actions.reset" on:click={reset} />
</FloatingInputs>

<style>
    .main {
        display: flex;
        flex-direction: column;
        overflow: auto;
        height: 100%;

        padding: 10px;
    }
</style>
