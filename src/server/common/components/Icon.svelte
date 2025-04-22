<script lang="ts">
    import { customIcons } from "../util/customIcons"
    import icons from "../util/icons"

    export let id: string
    export let size: number = 1.2
    export let white: boolean = false
    export let right: boolean = false
    export let fill: boolean = false
    export let custom: boolean = false
    export let box: number = 24

    $: icon = custom ? customIcons[id] : icons[id]

    $: width = size + "rem"
    $: height = size + "rem"
</script>

<svg class={$$props.class} class:white class:right class:fill style="{$$props.style || ''};min-width: {width}" {width} {height} viewBox="0 0 {box} {box}">
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
</style>
