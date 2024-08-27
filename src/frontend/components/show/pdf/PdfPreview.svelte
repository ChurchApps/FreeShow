<script lang="ts">
    import { outLocked, outputs, slidesOptions, styles } from "../../../stores"
    import { getFileName, removeExtension } from "../../helpers/media"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import { clearBackground } from "../../output/clear"
    import { getViewportSizes } from "./pdfData"

    export let show

    let viewports: { width: number; height: number }[] = []
    let pages = 0
    $: if (show.id) getPdfPages()

    async function getPdfPages() {
        viewports = await getViewportSizes(show.id)

        // pages = await getPages(show.id)
        pages = viewports.length
    }

    $: activeOutput = getActiveOutputs($outputs, false, true, true)[0]

    // set active if output
    let active: number = -1
    $: outSlide = $outputs[activeOutput].out?.slide
    $: if (outSlide?.type === "pdf" && outSlide?.id === show.id) active = (outSlide?.page || 0) - 1
    else active = -1

    // WIP multiple outputs
    $: output = { color: $outputs[activeOutput].color }

    function outputPdf(e: any, page: number) {
        if ($outLocked || e.ctrlKey || e.metaKey || e.shiftKey) return

        let name = show.name || removeExtension(getFileName(show.id))
        setOutput("slide", { type: "pdf", id: show.id, page, pages, viewport: viewports[page - 1], name })

        clearBackground()
    }

    // WIP duplicate of Slides.svelte
    let nextScrollTimeout: any = null
    function wheel(e: any) {
        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout) return

        slidesOptions.set({ ...$slidesOptions, columns: Math.max(2, Math.min(10, $slidesOptions.columns + (e.deltaY < 0 ? -1 : 1))) })

        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    // output style
    $: currentOutput = $outputs[activeOutput] || {}
    $: currentStyle = $styles[currentOutput.style || ""] || {}

    // add extra padding to aspect ratio to ensure page is properly sized (if portrait mode)
    const EXTRA_RATIO = 100 // 45
</script>

<!-- SHOW FULL PREVIEW: -->
<!-- https://stackoverflow.com/a/64490933/10803046 -->
<!-- <iframe src="{show.id}#toolbar=1" frameborder="0"></iframe> -->

<div class="grid" on:wheel={wheel}>
    {#each [...Array(pages)] as _, page}
        <div class="main" class:active={active === page} style="{output?.color ? 'outline: 2px solid ' + output.color + ';' : ''}width: {100 / (pages > 1 ? $slidesOptions.columns : 1)}%;">
            <div class="slide" tabindex={0} on:click={(e) => outputPdf(e, page + 1)}>
                {#if viewports[page]}
                    <!-- 16 / 9 < -->
                    <div
                        class="center"
                        class:wide={(viewports[page].width + EXTRA_RATIO) / viewports[page].height < viewports[page].width / viewports[page].height}
                        style="aspect-ratio: {viewports[page].width / viewports[page].height};--background: {currentStyle.background || 'black'};"
                    ></div>
                {/if}

                {#key $slidesOptions.columns}
                    <iframe src="{show.id}#toolbar=0&view=fit&page={page + 1}" class:hideScrollbar={pages > 1} frameborder="0" scrolling="no" style="aspect-ratio: {viewports[page].width + EXTRA_RATIO} / {viewports[page].height};"></iframe>
                {/key}
            </div>
        </div>
    {/each}
</div>

<style>
    iframe {
        width: 100%;
        /* height: 100%; */
        aspect-ratio: 16 / 9;

        pointer-events: none;
    }

    iframe.hideScrollbar {
        /* do this to hide scrollbar until the url parameter to hide is supported */
        width: calc(100% + 18px);
    }

    .grid {
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        padding: 5px;
        width: 100%;
        height: 100%;
    }

    .main {
        display: flex;
        position: relative;
        /* height: fit-content; */
        padding: 2px;
    }

    .slide {
        background-color: var(--primary-darkest);
        z-index: 0;
        outline-offset: 0;
        width: 100%;

        position: relative;

        /* display: flex; */
        overflow: hidden;
    }

    .main.active {
        outline: 2px solid var(--secondary);
        outline-offset: -1px;
    }

    /* cover grey areas with black */
    .center {
        height: calc(100% - 5px);

        position: absolute;
        left: 50%;
        top: 2px;
        transform: translateX(-50%);

        outline-offset: 0;
        outline: 800px solid var(--background);
    }
    .center.wide {
        height: initial;
        width: calc(100% - 5px);
    }
</style>
