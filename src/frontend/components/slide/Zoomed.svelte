<script lang="ts">
    import type { Cropping, Resolution } from "../../../types/Settings"
    import { outputs, styles } from "../../stores"
    import { getActiveOutputs, getResolution } from "../helpers/output"

    export let background: string = $styles[$outputs[getActiveOutputs()[0]].style || ""]?.background || "#000000"
    export let backgroundDuration: number = 800
    export let center: boolean = false
    export let zoom: boolean = true
    export let mirror: boolean = false
    export let showMirror: boolean = false
    export let disableStyle: boolean = false
    export let relative: boolean = false
    export let aspectRatio: boolean = true
    export let hideOverflow: boolean = true
    export let customZoom: number = 1
    export let cropping: Cropping = { top: 0, right: 0, bottom: 0, left: 0 }
    export let resolution: Resolution = getResolution(null, { $outputs, $styles })
    $: resolution = getResolution(resolution, { $outputs, $styles })
    let slideWidth: number = 0
    export let ratio: number = 1
    $: ratio = Math.max(0.01, slideWidth / resolution.width) / customZoom

    $: croppedStyle = getCropping(cropping)
    function getCropping(cropping) {
        let style = ""
        if (!cropping || mirror) return ""

        let minusHeight = cropping.top + cropping.bottom
        let minusWidth = cropping.right + cropping.left

        let newHeight = resolution.height - minusHeight
        let newWidth = resolution.width - minusWidth
        let heightRatio = newHeight / resolution.height
        let widthRatio = newWidth / resolution.width
        let paddingSides = (resolution.width - minusWidth - resolution.width * heightRatio) / 2
        let paddingTops = (resolution.height - minusHeight - resolution.height * widthRatio) / 2

        // if (minusHeight) style += `height: calc(100% - ${minusHeight}px);`
        style += `margin-top: ${cropping.top + paddingTops}px;`
        style += `margin-bottom: ${cropping.bottom + paddingTops}px;`

        if (minusWidth) style += `width: calc(100% - ${minusWidth}px);`
        style += `margin-right: ${cropping.right + paddingSides}px;`
        style += `margin-left: ${cropping.left + paddingSides}px;`

        return style
    }
</script>

<div class:center class="zoomed" style="width: 100%;height: 100%;">
    <div
        bind:offsetWidth={slideWidth}
        class="slide"
        class:hideOverflow
        class:disableStyle
        class:showMirror
        class:relative
        style="{$$props.style || ''}background-color: {background};transition: {backgroundDuration}ms background-color;{aspectRatio ? `aspect-ratio: ${resolution.width}/${resolution.height};${croppedStyle}` : ''};"
    >
        {#if zoom}
            <span class="zoom" style="zoom: {ratio};">
                <slot {ratio} />
            </span>
        {:else}
            <slot ratio={1} />
        {/if}
    </div>
</div>

<style>
    .slide {
        position: relative;
        /* TODO: not edit */
        /* z-index: -1; */

        transition: 800ms background-color;
    }

    .slide:not(.relative) :global(.item) {
        position: absolute;
        /* display: inline-flex; */
    }
    .slide:not(.relative) :global(.item .align) {
        overflow: hidden;
    }

    .slide:not(.disableStyle) :global(.item) {
        color: white;
        font-size: 100px;
        font-family: "CMGSans";
        line-height: 1.1;
        -webkit-text-stroke-color: #000000;
        text-shadow: 2px 2px 10px #000000;

        border-style: solid;
        border-width: 0px;
        border-color: #ffffff;

        height: 150px;
        width: 400px;
    }
    /* enable styling for stage mirrors */
    .slide.showMirror :global(.item) {
        color: unset;
        font-size: unset;
        font-family: unset;
        line-height: unset;
        -webkit-text-stroke-color: unset;
        text-shadow: unset;

        border-style: unset;
        border-width: unset;
        border-color: unset;

        height: 100%;
        width: 100%;
    }

    .hideOverflow {
        overflow: hidden;
    }

    .center {
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>
