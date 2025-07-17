<script lang="ts">
    import { fade } from "svelte/transition"
    import { draw, drawSettings, drawTool } from "../../stores"
    import Fill from "./Fill.svelte"
    import Paint from "./Paint.svelte"
    import Particles from "./Particles.svelte"

    $: tool = $drawTool
    $: settings = $drawSettings[tool] || {}

    // $: outputId = getActiveOutputs($outputs, true, true, true)[0]
    // $: resolution = getOutputResolution(outputId, $outputs, true)
    // // get corrected value
    // $: x = $draw === null ? 0 : resolution.width * ($draw.x / ($draw.resolution?.width || 1))
    // $: y = $draw === null ? 0 : resolution.height * ($draw.y / ($draw.resolution?.height || 1))
    $: x = $draw === null ? 0 : $draw.x
    $: y = $draw === null ? 0 : $draw.y
</script>

{#if tool === "fill"}
    <Fill {settings} />
{:else if tool === "paint"}
    <Paint {settings} />
{:else if $draw !== null}
    {#if tool === "focus"}
        <!-- can't fade out, because Svelte bug will make it stay forever if tabs changed from Draw while active -->
        <div
            class="focus"
            style="left: {x}px;top: {y}px;opacity: {settings?.opacity};border-radius: {settings?.radius}%;width: {settings?.size}px;height: {settings?.size}px;box-shadow: 0 0 0 50000px {settings?.color}{settings?.glow
                ? `, inset 0 0 ${settings?.size / 3}px ${settings?.color}`
                : ''};"
            in:fade={{ duration: 150 }}
        />
    {:else if tool === "pointer"}
        <div
            class="point"
            class:hollow={settings?.hollow === true}
            style="left: {x}px;top: {y}px;--color: {settings?.color};border-radius: {settings?.radius}%;opacity: {settings?.opacity};width: {settings?.size}px;height: {settings?.size}px;{settings?.glow
                ? `box-shadow: 0 0 ${settings?.size / 5}px ${settings?.size / 20}px ${settings?.color}`
                : ''}"
            in:fade={{ duration: 100 }}
        />
    {:else if tool === "particles"}
        <Particles {settings} />
    {/if}
{/if}

<!-- zoom is directly used in <Zoomed /> -->

<style>
    .point {
        --color: red;
        position: absolute;
        width: 50px;
        height: 50px;
        background-color: var(--color);
        border: 4px solid var(--color);
        border-radius: 50%;
        opacity: 0.8;
    }
    .point.hollow {
        background-color: transparent;
    }

    .focus {
        position: absolute;
        width: 300px;
        height: 300px;
        background-color: transparent;
        border-radius: 50%;
        opacity: 0.8;
        box-shadow: 0 0 0 50000px black;
    }
</style>
