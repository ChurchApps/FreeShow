<script lang="ts">
    import { MAIN } from "../../../../types/Channels"
    import { activeShow, dataPath, labelsDisabled, outLocked, outputs, slidesOptions, styles } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import { getFileName, removeExtension } from "../../helpers/media"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import { clearBackground } from "../../output/clear"
    import { getViewportSizes } from "./pdfData"

    export let show
    $: path = show.id

    let viewports: { width: number; height: number }[] = []
    let pages = 0
    $: if (path) getPdfPages()

    async function getPdfPages() {
        viewports = []
        pages = 0

        viewports = await getViewportSizes(path)
        if ($activeShow) activeShow.set({ ...$activeShow, data: { viewports } })

        // pages = await getPages(path)
        pages = viewports.length
    }

    $: activeOutput = getActiveOutputs($outputs, false, true, true)[0]

    // set active if output
    let active: number = -1
    $: outSlide = $outputs[activeOutput].out?.slide
    $: if (outSlide?.type === "pdf" && outSlide?.id === path) active = outSlide?.page || 0
    else active = -1

    // WIP multiple outputs
    $: output = { color: $outputs[activeOutput].color }

    function outputPdf(e: any, page: number) {
        if ($outLocked || e.ctrlKey || e.metaKey || e.shiftKey) return

        let name = show.name || removeExtension(getFileName(path))
        setOutput("slide", { type: "pdf", id: path, page, pages, viewport: viewports[page], name })

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

    function convertToImages() {
        newToast("$actions.converting")
        send(MAIN, ["PDF_TO_IMAGE"], { dataPath: $dataPath, path: path })
    }

    // slow loader
    let currentIndex: number = 1
    $: if (path && pages) startLoading(true)
    let loadingTimeout: any = null
    function startLoading(reset: boolean = false) {
        if (reset) currentIndex = 1
        if (loadingTimeout) clearTimeout(loadingTimeout)
        loadingTimeout = setTimeout(() => {
            currentIndex++
            if (currentIndex < pages) startLoading()
        }, 500)
    }
</script>

<!-- SHOW FULL PREVIEW: -->
<!-- https://stackoverflow.com/a/64490933/10803046 -->
<!-- <iframe src="{path}#toolbar=1" frameborder="0"></iframe> -->

<div class="grid" on:wheel={wheel}>
    {#each [...Array(pages)] as _, page}
        {#if page < currentIndex}
            <div class="main" class:active={active === page} style="{output?.color ? 'outline: 2px solid ' + output.color + ';' : ''}width: {100 / (pages > 1 ? $slidesOptions.columns : 1)}%;">
                <div class="slide" tabindex={0} on:click={(e) => outputPdf(e, page)}>
                    {#if viewports[page]}
                        <!-- 16 / 9 < -->
                        <div
                            class="center"
                            class:wide={(viewports[page].width + EXTRA_RATIO) / viewports[page].height < viewports[page].width / viewports[page].height}
                            style="aspect-ratio: {viewports[page].width / viewports[page].height};--background: {currentStyle.background || 'black'};"
                        ></div>
                    {/if}

                    {#key $slidesOptions.columns}
                        <iframe src="{path}#toolbar=0&view=fit&page={page + 1}" class:hideScrollbar={pages > 1} frameborder="0" scrolling="no" style="aspect-ratio: {viewports[page]?.width + EXTRA_RATIO} / {viewports[page]?.height};"></iframe>
                    {/key}
                </div>
            </div>
        {/if}
    {/each}
</div>

<div class="actionbar">
    <div>
        <p>PDF</p>

        <Button on:click={convertToImages} style="white-space: nowrap;">
            <Icon id="image" right={!$labelsDisabled} />
            {#if !$labelsDisabled}<T id="actions.convert_to_images" />{/if}
        </Button>

        <!-- WIP: zoom menu etc. (Layouts.svelte) -->
    </div>
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

        flex: 1;
        overflow: auto;
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
    /* WIP better border fill (pdf2img-electron render.ts:windowLoaded()) */
    .center {
        height: calc(100% - 12px);

        position: absolute;
        left: 50%;
        top: 3px;
        transform: translateX(-50%);

        outline-offset: 0;
        outline: 800px solid var(--background);
    }
    .center.wide {
        height: initial;
        width: calc(100% - 12px);
    }

    /* action bar */

    .actionbar {
        display: flex;
        justify-content: space-between;
        width: 100%;
        background-color: var(--primary-darkest);
    }

    /* fixed height for consistent heights */
    .actionbar :global(button) {
        min-height: 28px;
        padding: 0 0.8em !important;
    }
    .actionbar :global(button.active) {
        /* color: var(--secondary) !important; */
        /* color: rgb(255 255 255 /0.5) !important; */
        background-color: var(--primary) !important;
    }

    .actionbar div {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        overflow: hidden;
    }

    .actionbar p {
        padding: 0 10px;
        opacity: 0.8;
    }
</style>
