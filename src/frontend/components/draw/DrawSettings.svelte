<script lang="ts">
    import { drawSettings, drawTool, paintCache } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { clone } from "../helpers/array"
    import Button from "../inputs/Button.svelte"
    import MaterialColorInput from "../inputs/MaterialColorInput.svelte"
    import MaterialNumberInput from "../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../inputs/MaterialToggleSwitch.svelte"
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
        drawSettings.update((a) => {
            a[tool][key] = value
            return a
        })
    }

    function reset() {
        drawSettings.update((a) => {
            a[tool] = clone(defaults[tool] || {})
            return a
        })
    }

    // $: if (!Object.keys($drawSettings[tool] || {}).length) reset()
    $: if (tool) adddMissingSettings()
    function adddMissingSettings() {
        drawSettings.update((a) => {
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

<Tabs tabs={{ tool: { name: "draw." + tool, icon: tool } }} active="tool" />

<div class="main">
    {#each Object.entries($drawSettings[tool] || {}) as [key, value]}
        {@const hidden = key === "hold" && tool === "paint"}

        {#if !hidden}
            {#if key === "color"}
                <MaterialColorInput label="draw.{key}" {value} on:change={(e) => update(e.detail, key)} />
            {:else if key === "opacity"}
                <MaterialNumberInput label="draw.{key}" value={value * 10} min={1} max={10} on:change={(e) => update(e.detail / 10, key)} />
            {:else if key === "radius"}
                <MaterialNumberInput label="draw.{key}" value={value * 2} max={100} on:change={(e) => update(e.detail / 2, key)} />
            {:else if key === "size"}
                <MaterialNumberInput label="draw.{key}" {value} min={1} max={2000} step={10} on:change={(e) => update(e.detail, key)} />
            {:else}
                <MaterialToggleSwitch label="draw.{key}" checked={value} on:change={(e) => update(e.detail, key)} />
            {/if}
        {/if}
    {/each}
</div>

<div class="bottom">
    {#if tool === "paint"}
        <Button style="flex: 1;padding: 10px;" on:click={clearDrawing} disabled={!$paintCache?.length} red={!!$paintCache?.length} dark center>
            <Icon id="clear" size={2} right white={!!$paintCache?.length} />
            <T id="clear.drawing" />
        </Button>
    {/if}

    <Button style="flex: 1;" on:click={reset} dark center>
        <Icon id="reset" right />
        <T id="actions.reset" />
    </Button>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        overflow: auto;
        height: 100%;

        padding: 10px;
    }

    .bottom {
        display: flex;
        flex-direction: column;
    }
</style>
