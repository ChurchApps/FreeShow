<script lang="ts">
    import type { Cropping, Resolution } from "../../../types/Settings"
    import { draw, outputs, styles } from "../../stores"
    import { DEFAULT_BOUNDS, getActiveOutputs, getOutputResolution, getResolution } from "../helpers/output"

    export let id = ""
    $: outputId = id || getActiveOutputs($outputs, true, true, true)[0]

    export let background: string = $styles[$outputs[outputId]?.style || ""]?.background || "#000000"
    export let backgroundDuration = 800
    export let center = false
    export let zoom = true
    export let mirror = false
    export let showMirror = false
    export let disableStyle = false
    export let isStage = false
    export let checkered = false
    export let border = false
    export let align = ""
    export let drawZoom = 1

    export let outline = ""
    export let disabled = false

    export let relative = false
    export let aspectRatio = true
    export let hideOverflow = true
    export let customZoom = 1
    export let cropping: Cropping | undefined = { top: 0, right: 0, bottom: 0, left: 0 }
    export let resolution: Resolution = getResolution(null, { $outputs, $styles }, false, outputId)
    $: if (!isStage) resolution = getResolution(resolution, { $outputs, $styles }, false, outputId)
    $: outputRes = isStage ? resolution : getOutputResolution(outputId, $outputs)

    $: stylesRatio = getResolution(null, $styles, false, outputId)
    $: styleAspectRatio = stylesRatio.width / stylesRatio.height
    const defaultRatio = DEFAULT_BOUNDS.width / DEFAULT_BOUNDS.height

    let elemWidth = 0
    let elemHeight = 0

    let slideWidth = 0
    let slideHeight = 0
    export let ratio = 1
    $: shouldUseHeightRatio = outputRes.width < outputRes.height && stylesRatio.width > stylesRatio.height && styleAspectRatio === defaultRatio
    $: ratio = Math.max(0.01, shouldUseHeightRatio ? slideHeight / outputRes.height : slideWidth / outputRes.width) / customZoom

    $: croppedStyle = getCropping(cropping)
    function getCropping(cropping) {
        let style = ""
        if (!cropping || mirror) return ""

        let minusHeight = cropping.top + cropping.bottom
        let minusWidth = cropping.right + cropping.left

        let newHeight = outputRes.height - minusHeight
        let newWidth = outputRes.width - minusWidth
        let heightRatio = newHeight / outputRes.height
        let widthRatio = newWidth / outputRes.width
        let paddingSides = (outputRes.width - minusWidth - outputRes.width * heightRatio) / 2
        let paddingTops = (outputRes.height - minusHeight - outputRes.height * widthRatio) / 2

        // if (minusHeight) style += `height: calc(100% - ${minusHeight}px);`
        style += `margin-top: ${cropping.top + paddingTops}px;`
        style += `margin-bottom: ${cropping.bottom + paddingTops}px;`

        if (minusWidth) style += `width: calc(100% - ${minusWidth}px);`
        style += `margin-inline-end: ${cropping.right + paddingSides}px;`
        style += `margin-inline-start: ${cropping.left + paddingSides}px;`

        return style
    }

    // $: zoomTransform = 50 * (drawZoom - 1) * -1

    $: alignStyle = align ? ($$props.style?.includes("width") ? `align-items: ${align};` : `justify-content: ${align};`) : ""
</script>

<div id={outputId} class:center class:disabled class="zoomed" style="width: 100%;height: 100%;{outline ? `border: 2px solid ${outline};` : ''}{alignStyle}" bind:offsetWidth={elemWidth} bind:offsetHeight={elemHeight}>
    <div
        bind:offsetWidth={slideWidth}
        bind:offsetHeight={slideHeight}
        class="slide"
        class:landscape={resolution.width / resolution.height > elemWidth / elemHeight}
        class:hideOverflow
        class:disableStyle
        class:showMirror
        class:relative
        class:checkered
        class:border
        style="{$$props.style || ''}background-color: {background};transition: {backgroundDuration}ms background-color;{aspectRatio ? `aspect-ratio: ${resolution.width}/${resolution.height};${croppedStyle}` : ''};"
    >
        {#if zoom}
            <span
                class="zoom"
                style="zoom: {ratio};{drawZoom === 1
                    ? ''
                    : `transform: scale(${drawZoom});position: absolute;width: 100%;height: 100%;` +
                      ($draw ? `inset-inline-start: ${($draw.x / outputRes.width - 0.5) * (drawZoom - 1) * -1 * 100}%;top: ${($draw.y / outputRes.height - 0.5) * (drawZoom - 1) * -1 * 100}%;` : '')}"
            >
                <!-- ($draw ? `left: calc(${zoomTransform}% + ${($draw.x / 1920 - 0.5) * -2 * 100}%);top: calc(${zoomTransform}% + ${($draw.y / 1080 - 0.5) * -2 * 100}%);` : `left: ${zoomTransform}%;top: ${zoomTransform}%;`)}" -->
                <slot {ratio} />
            </span>
        {:else}
            <slot ratio={1} />
        {/if}
    </div>
</div>

<style>
    .disabled {
        opacity: 0.5;
    }

    .slide {
        position: relative;
        transition: 800ms background-color;
    }
    .slide.border {
        outline: 2px solid var(--primary-lighter);
        outline-offset: 0;
    }

    .slide:not(.relative) :global(.item) {
        position: absolute;
        /* display: inline-flex; */
    }
    .slide:not(.relative) :global(.item .align) {
        overflow: hidden;
    }

    .slide:not(.disableStyle) :global(.item) {
        font-family: "CMGSans";
        text-shadow: 2px 2px 10px #000000;
    }
    .slide :global(.item) {
        color: white;
        font-size: 100px;
        line-height: 1.1;
        -webkit-text-stroke-color: #000000;

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

    /* .zoom {
        transition:
            0.2s inset-inline-start,
            0.2s top;
    } */
</style>
