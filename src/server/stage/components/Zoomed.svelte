<script lang="ts">
    export let show: any
    export let disableStyle: boolean = false
    export let dynamicResolution: boolean = true
    export let relative: boolean = false

    let resolution: any = show && show.settings.resolution ? show.settings.resolution : { width: 1920, height: 1080 } // $screen.resolution
    let slideWidth: number = 0
    let slideHeight: number = 0
    let ratio: number = 1
    $: ratio = Math.min(slideWidth / (resolution?.width || 1920), slideHeight / (resolution?.height || 1080))

    // dynamic resolution
    if (dynamicResolution) resolution = { width: window.innerWidth, height: window.innerHeight }
</script>

<div class="center">
    <div bind:offsetWidth={slideWidth} bind:offsetHeight={slideHeight} class:disableStyle class:relative class="slide" style="{$$props.style || ''}aspect-ratio: {resolution?.width}/{resolution?.height};">
        <!-- Use transform scale for cross-browser support (Safari/Firefox do not support CSS zoom) -->
        <span style="display: inline-block; width: {resolution?.width || 1920}px; height: {resolution?.height || 1080}px; transform: scale({isFinite(ratio) && ratio > 0 ? ratio : 1}); transform-origin: top left; will-change: transform;">
            <slot />
        </span>
    </div>
</div>

<style>
    .slide {
        position: relative;
    }

    .slide:not(.relative) :global(.item) {
        position: absolute;
        /* display: inline-flex; */
        overflow: hidden;
    }

    .slide:not(.disableStyle) :global(.item) {
        color: white;
        font-size: 100px;
        /* font-family: "CMGSans"; */
        font-family: system-ui;
        line-height: 1.1;
        -webkit-text-stroke-color: #000000;
        paint-order: stroke fill;
        text-shadow: 2px 2px 10px #000000;

        border-style: solid;
        border-width: 0px;
        border-color: #ffffff;

        height: 150px;
        width: 400px;

        width: 100%;
        height: 100%;
        color: unset;
    }

    .center {
        width: 100%;
        height: 100%;

        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>
