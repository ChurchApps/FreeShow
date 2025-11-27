<script lang="ts">
    import { uid } from "uid"
    import type { Selected } from "../../../types/Main"
    import { activePopup, localeDirection, selected, theme, themes } from "../../stores"
    import { triggerClickOnEnterSpace } from "../../utils/clickable"
    import { customIcons } from "../../values/customIcons"
    import icons from "../../values/icons"
    import { hexToHSL, hslToHex } from "./color"

    export let id: string
    export let size = 1
    export let white = false
    export let right = false
    export let fill = false
    export let custom = false
    export let select = false
    export let selectData: Selected | null = null
    export let box = 24
    export let gradient = false

    const gradientId = `icon-gradient-${uid(5)}`
    export let gradientColor: string | null = null
    let baseColor = gradientColor || (gradient ? "#e800f0" : "#f0008c")
    $: if ($themes[$theme]) updateBaseColor()
    function updateBaseColor() {
        if (gradientColor || gradient) return
        baseColor = $themes[$theme]?.colors.secondary || "#f0008c"
    }

    // smaller change
    $: hsl = hexToHSL(baseColor)
    $: colorStart = gradient ? hslToHex(340, hsl.s, Math.min(hsl.l + 15, 100)) : hslToHex(hsl.h, hsl.s, Math.min(hsl.l + 6, 100)) // lighter
    $: colorMid = baseColor
    $: colorEnd = gradient ? hslToHex(270, hsl.s, Math.max(hsl.l - 30, 0)) : hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 6, 0)) // darker

    $: width = size + "rem"
    $: height = size + "rem"

    $: icon = custom || !icons[id] ? customIcons[id] : icons[id]

    const iconsToBeFlipped = ["back"] // Add more icons that need to be flipped horizontally if needed
    const flip = $localeDirection === "rtl" && iconsToBeFlipped.includes(id)

    const click = () => {
        if (!select) return

        if (selectData && !$selected.data.includes(selectData.data[0])) selected.set(selectData)
        activePopup.set("icon")
    }
</script>

{#if select}
    <svg class={$$props.class} class:flip class:white class:right class:fill class:select on:click={click} on:keydown={triggerClickOnEnterSpace} tabindex={0} role="button" style="{$$props.style || ''};min-width: {width}" {width} {height} viewBox="0 0 {box} {box}">
        {#if !white && colorMid && colorEnd && colorStart}
            <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <!-- <stop offset="0%" stop-color="#f0008c" />
                    <stop offset="50%" stop-color="#e800f0" />
                    <stop offset="100%" stop-color="#8000f0" /> -->
                    <stop offset="0%" stop-color={colorStart} />
                    <stop offset="50%" stop-color={colorMid} />
                    <stop offset="100%" stop-color={colorEnd} />
                </linearGradient>
            </defs>
            <g fill={`url(#${gradientId})`}>
                {@html icon ? icon : icons.noIcon}
            </g>
        {:else}
            {@html icon ? icon : icons.noIcon}
        {/if}
    </svg>
{:else}
    <svg class={$$props.class} class:flip class:white class:right class:fill style="{$$props.style || ''};min-width: {width}" {width} {height} viewBox="0 0 {box} {box}">
        {#if !white && colorMid && colorEnd && colorStart}
            <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color={colorStart} />
                    <stop offset="50%" stop-color={colorMid} />
                    <stop offset="100%" stop-color={colorEnd} />
                </linearGradient>
            </defs>
            <g fill={`url(#${gradientId})`}>
                {@html icon ? icon : icons.noIcon}
            </g>
        {:else}
            {@html icon ? icon : icons.noIcon}
        {/if}
    </svg>
{/if}

<style>
    svg {
        fill: var(--secondary);
    }

    svg.select {
        cursor: pointer;
    }

    svg.select:hover {
        background-color: var(--hover);
    }

    svg.white {
        /* fill: var(--secondary-text); */
        fill: currentColor;
    }

    svg.right {
        margin-inline-end: 0.5em;
    }

    svg.fill {
        width: 100%;
        height: 100%;
    }

    svg.flip {
        transform: scaleX(-1);
    }
</style>
