<script lang="ts">
    import type { Transition } from "../../../../types/Show"
    import OutputTransition from "./OutputTransition.svelte"

    export let slide
    export let currentStyle
    export let transition: Transition

    let loaded = false
    $: if (slide) loaded = false

    function onload() {
        // give PDF a bit of time to load after "page" has loaded
        // WIP maybe not very accurate
        let timeout = Math.floor(Math.ceil(slide.viewport.width * slide.viewport.height) * 0.0012)
        timeout = Math.min(timeout, 3000)
        setTimeout(() => (loaded = true), timeout)
    }

    // import * as pdfjsLib from "pdfjs-dist"

    // let page
    // let canvas: any
    // $: if (slide.id) loadPdf()
    // async function loadPdf() {
    //     const pdf = await pdfjsLib.getDocument(slide.id).promise
    //     // pdf.numPages
    //     page = await pdf.getPage(slide.page)
    // }
    // $: if (page && canvas) renderPage()

    // function renderPage() {
    //     var scale = 1.5
    //     var viewport = page.getViewport({ scale: scale })
    //     // Support HiDPI-screens.
    //     var outputScale = window.devicePixelRatio || 1

    //     var context = canvas.getContext("2d")

    //     canvas.width = Math.floor(viewport.width * outputScale)
    //     canvas.height = Math.floor(viewport.height * outputScale)
    //     canvas.style.width = Math.floor(viewport.width) + "px"
    //     canvas.style.height = Math.floor(viewport.height) + "px"

    //     var transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null

    //     var renderContext = {
    //         canvasContext: context,
    //         transform: transform,
    //         viewport: viewport,
    //     }
    //     page.render(renderContext)
    // }
</script>

<!-- {#if page}
    <OutputTransition {transition}>
        <canvas bind:this={canvas}></canvas>
    </OutputTransition>
{/if} -->

<!-- Native Chromium PDF Viewer -->
{#key slide.page}
    <OutputTransition {transition}>
        {#if slide.viewport}
            <div class="center" class:wide={16 / 9 < slide.viewport.width / slide.viewport.height} style="aspect-ratio: {slide.viewport.width / slide.viewport.height};--background: {currentStyle.background || 'black'};"></div>
        {/if}

        <iframe src="{slide.id}#toolbar=0&view=fit&page={slide.page}" class:hideScrollbar={slide.pages > 1} frameborder="0" scrolling="no" on:load={onload}></iframe>

        {#if !loaded}
            <div class="fill" style="--background: {currentStyle.background || 'black'};"></div>
        {/if}
    </OutputTransition>
{/key}

<style>
    iframe {
        width: 100%;
        height: 100%;

        pointer-events: none;
    }

    iframe.hideScrollbar {
        /* do this to hide scrollbar until the url parameter to hide is supported */
        width: calc(100% + 18px);
    }

    /* cover grey areas with black */
    .center {
        height: calc(100% - 5px - 4px);

        position: absolute;
        left: 50%;
        top: 2px;
        transform: translateX(-50%);

        outline-offset: 0;
        outline: 800px solid var(--background);
    }
    .center.wide {
        height: initial;
        width: calc(100% - 5px - 4px);
    }

    .fill {
        width: 100%;
        height: 100%;

        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);

        background-color: var(--background);
    }
</style>
