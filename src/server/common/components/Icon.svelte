<script lang="ts">
    import { customIcons } from "../util/customIcons"
    import icons from "../util/icons"

    export let id: string
    export let size: number = 1
    export let fill: boolean = false
    export let white: boolean = false
    export let custom: boolean = false

    $: icon = custom ? customIcons[id] : icons[id]

    $: width = size + "rem"
    $: height = size + "rem"
    let box: number = 24
</script>

<svg class={$$props.class} class:white class:fill style="{$$props.style || ''};min-width: {width}" {width} {height} viewBox="0 0 {box} {box}">
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
        margin-right: 0.5em;
    }

    svg.fill {
        width: 100%;
        height: 100%;
    }
</style>
