<script lang="ts">
    import { draw, drawSettings, drawTool } from "../../stores"
    import Paint from "./Paint.svelte"
    import Particles from "./Particles.svelte"

    $: tool = $drawTool
    $: settings = $drawSettings[tool]

    $: {
        if (settings?.rainbow && !timeout) generate()
    }
    $: rainbow = settings?.rainbow ? "rgb(0, 0, 0)" : null

    let r = 0,
        g = 0,
        b = 0

    let timeout: any = null
    function generate() {
        if (r <= 255 && g == 0 && b == 0) r++
        if (r == 255 && b == 0 && g <= 255) g++
        if (r == 255 && g == 255 && b <= 255) b++
        if (b == 255 && g == 255 && r > 0) r--
        if (r == 0 && b == 255 && g > 0) g--
        if (r == 0 && g == 0 && b > 0) b--

        rainbow = "rgb(" + r + "," + g + "," + b + ")"
        if (settings?.rainbow) timeout = setTimeout(generate, 10)
        else timeout = null
    }
</script>

{#if tool === "fill"}
    <div class="fill" style="background-color: {rainbow || settings?.color};opacity: {settings?.opacity};" />
{:else if tool === "paint"}
    <Paint {settings} />
{:else if $draw !== null}
    {#if tool === "focus"}
        <div
            class="focus"
            style="left: {$draw.x}px;top: {$draw.y}px;opacity: {settings?.opacity};border-radius: {settings?.radius}%;width: {settings?.size}px;height: {settings?.size}px;box-shadow: 0 0 0 50000px {settings?.color}{settings?.glow
                ? `, inset 0 0 ${settings?.size / 3}px ${settings?.color}`
                : ''};"
        />
    {:else if tool === "pointer"}
        <div
            class="point"
            class:hollow={settings?.hollow === true}
            style="left: {$draw.x}px;top: {$draw.y}px;--color: {settings?.color};border-radius: {settings?.radius}%;opacity: {settings?.opacity};width: {settings?.size}px;height: {settings?.size}px;{settings?.glow
                ? `box-shadow: 0 0 ${settings?.size / 5}px ${settings?.size / 20}px ${settings?.color}`
                : ''}"
        />
    {:else if tool === "particles"}
        <Particles {settings} />
    {/if}
{/if}

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

    .fill {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: black;
        opacity: 0.8;
    }
</style>
