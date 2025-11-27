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

    const defaults = {
        focus: {
            color: "#000000",
            opacity: 0.8,
            size: 300,
            radius: 50,
            glow: true,
            hold: false
        },
        pointer: {
            color: "#FF0000",
            opacity: 0.8,
            size: 100,
            radius: 50,
            glow: false,
            hollow: true,
            hold: false
        },
        zoom: {
            size: 200,
            hold: false
        },
        particles: {
            color: "#1e1eb4",
            opacity: 0.8,
            size: 20,
            radius: 25,
            glow: false,
            hollow: false,
            hold: false
        },
        fill: {
            color: "#000000",
            opacity: 0.8,
            rainbow: false
        },
        paint: {
            color: "#ffffff",
            size: 10,
            straight: false,
            // not saved:
            threed: false,
            dots: false,
            link_to_slide: false,
            hold: true // always true
        }
    }

    $: tool = $drawTool

    const update = (value: any, key: string) => {
        drawSettings.update(a => {
            a[tool][key] = value
            return a
        })
    }

    function reset() {
        drawSettings.update(a => {
            a[tool] = clone(defaults[tool] || {})
            return a
        })
    }

    // $: if (!Object.keys($drawSettings[tool] || {}).length) reset()
    $: if (tool) adddMissingSettings()
    function adddMissingSettings() {
        drawSettings.update(a => {
            if (!a[tool]) a[tool] = clone(defaults[tool])
            else {
                Object.entries(defaults[tool]).forEach(([key, value]) => {
                    if (a[tool][key] === undefined) a[tool][key] = value
                })
            }
            return a
        })
    }
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
                <MaterialColorInput label="edit.color" {value} on:change={e => update(e.detail, key)} />
            {:else if key === "opacity"}
                <MaterialNumberInput label="edit.opacity" value={value * 10} min={1} max={10} on:change={e => update(e.detail / 10, key)} />
            {:else if key === "radius"}
                <MaterialNumberInput label="draw.radius" value={value * 2} max={100} on:change={e => update(e.detail / 2, key)} />
            {:else if key === "size"}
                <MaterialNumberInput label="edit.size" {value} min={1} max={2000} step={10} defaultValue={tool === "zoom" ? 100 : null} on:change={e => update(e.detail, key)} />
            {:else if key !== "clear"}
                <MaterialCheckbox label="draw.{key}" checked={value} on:change={e => update(e.detail, key)} />
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
