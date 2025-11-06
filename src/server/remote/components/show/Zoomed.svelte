<script lang="ts">
    import type { Resolution } from "../../../../types/Settings"

    export let background: string = "black"
    export let center: boolean = false
    export let hideOverflow: boolean = true
    export let resolution: Resolution
    export let checkered: boolean = false

    export let ratio: number = 1
    let baseWidth: number = 1920
    let baseHeight: number = 1080
    $: baseWidth = resolution?.width ?? 1920
    $: baseHeight = resolution?.height ?? 1080
    let slideHeight: number = 0
    // Fit to both width and height to avoid overflow on Safari
    $: ratio = Math.min(slideWidth / baseWidth, slideHeight / baseHeight)

    let slideWidth: number = 0
</script>

<div class:center>
    <div bind:offsetWidth={slideWidth} bind:offsetHeight={slideHeight} class="slide" class:hideOverflow class:checkered style="{$$props.style || ''}background-color: {background};aspect-ratio: {resolution.width}/{resolution.height};">
        <!-- Use transform scale for cross-browser support (Safari/Firefox do not support CSS zoom) -->
        <span style="display: inline-block; width: {baseWidth}px; height: {baseHeight}px; transform: scale({isFinite(ratio) && ratio > 0 ? ratio : 1}); transform-origin: top left; will-change: transform;">
            <slot />
        </span>
    </div>
</div>

<style>
    .slide {
        position: relative;
    }

    .slide :global(.item) {
        position: absolute;
        /* display: inline-flex; */
        overflow: hidden;

        color: white;
        font-size: 100px;
        font-family: sans-serif; /* "CMGSans"; */
        line-height: 1.1;
        -webkit-text-stroke-color: #000000;
        text-shadow: 2px 2px 10px #000000;

        border-style: solid;
        border-width: 0px;
        border-color: #ffffff;

        height: 150px;
        width: 400px;
    }

    .hideOverflow {
        overflow: hidden;
    }

    .center {
        width: 100%;
        height: 100%;

        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>
