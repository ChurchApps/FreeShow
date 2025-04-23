<script lang="ts">
    import type { Selected } from "../../../types/Main"
    import { activePopup, localeDirection, selected } from "../../stores"
    import { customIcons } from "../../values/customIcons"
    import icons from "../../values/icons"

    export let id: string
    export let size: number = 1
    export let white: boolean = false
    export let right: boolean = false
    export let fill: boolean = false
    export let custom: boolean = false
    export let select: boolean = false
    export let selectData: Selected | null = null
    export let box: number = 24

    $: width = size + "rem"
    $: height = size + "rem"

    $: icon = custom ? customIcons[id] : icons[id]

    const iconsToBeFlipped = ["back"] // Add more icons that need to be flipped horizontally if needed
    const flip = $localeDirection === "rtl" && iconsToBeFlipped.includes(id)

    const click = () => {
        if (!select) return

        if (selectData && !$selected.data.includes(selectData.data[0])) selected.set(selectData)
        activePopup.set("icon")
    }
</script>

<svg class={$$props.class} class:flip class:white class:right class:fill class:select on:click={click} style="{$$props.style || ''};min-width: {width}" {width} {height} viewBox="0 0 {box} {box}">
    {@html icon ? icon : icons.noIcon}
</svg>

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
        /* fill: var(--text); */
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
