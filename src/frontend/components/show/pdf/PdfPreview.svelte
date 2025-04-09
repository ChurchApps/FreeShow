<script lang="ts">
    import * as pdfjsLib from "pdfjs-dist"
    import { slide } from "svelte/transition"
    import { dictionary, outLocked, outputs, slidesOptions, styles } from "../../../stores"
    import { wait } from "../../../utils/common"
    import Icon from "../../helpers/Icon.svelte"
    import { getFileName, removeExtension } from "../../helpers/media"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import { clearBackground } from "../../output/clear"
    import { onMount } from "svelte"
    import Loader from "../../main/Loader.svelte"

    export let show
    $: path = show.id

    $: activeOutput = getActiveOutputs($outputs, false, true, true)[0]

    $: currentOutput = $outputs[activeOutput]
    $: transparentOutput = !!currentOutput?.transparent
    $: currentStyle = $styles[currentOutput?.style || ""] || {}

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
        setOutput("slide", { type: "pdf", id: path, page, pages: pageCount, name })

        clearBackground()
    }

    // WIP duplicate of Slides.svelte
    let nextScrollTimeout: NodeJS.Timeout | null = null
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

    /////

    // pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    pdfjsLib.GlobalWorkerOptions.workerSrc = "./assets/pdf.worker.min.mjs"

    let pageCount: number = 0
    let canvases: (HTMLCanvasElement | undefined)[] = []

    let zoomOpened: boolean = false
    function mousedown(e: any) {
        if (e.target.closest(".zoom_container") || e.target.closest("button")) return

        zoomOpened = false
    }

    let loading = true
    onMount(loadPages)
    async function loadPages() {
        loading = true
        if (!path) {
            loading = false
            return
        }

        const pdfDoc = await pdfjsLib.getDocument(path).promise
        pageCount = pdfDoc.numPages

        // Wait for canvases to bind
        await wait(10)

        for (let i = 0; i < pageCount; i++) {
            const page = await pdfDoc.getPage(i + 1)
            const viewport = page.getViewport({ scale: 1.5 })
            const canvas = canvases[i]
            const context = canvas?.getContext("2d")
            if (!context) break

            canvas!.height = viewport.height
            canvas!.width = viewport.width

            await page.render({ canvasContext: context, viewport }).promise

            // display when the first page has loaded
            loading = false
        }
    }
</script>

<svelte:window on:mousedown={mousedown} />

<div class="grid" on:wheel={wheel}>
    {#each { length: pageCount } as _page, i}
        <div class="main" class:active={active === i} style="{output?.color ? 'outline: 2px solid ' + output.color + ';' : ''}width: {100 / (pageCount > 1 ? $slidesOptions.columns : 1)}%;">
            <div class="slide" style={transparentOutput ? "" : `background-color: ${currentStyle.background};`} tabindex={0} on:click={(e) => outputPdf(e, i)}>
                <canvas bind:this={canvases[i]} />
            </div>
        </div>
    {/each}

    {#if loading}
        <div class="load">
            <Loader />
        </div>
    {/if}
</div>

<div class="actionbar">
    <div>
        <p>PDF</p>

        <div class="buttons">
            <Button on:click={() => (zoomOpened = !zoomOpened)} title={$dictionary.actions?.zoom}>
                <Icon size={1.3} id="zoomIn" white />
            </Button>
            {#if zoomOpened}
                <div class="zoom_container" transition:slide={{ duration: 150 }}>
                    <Button style="padding: 0 !important;" on:click={() => slidesOptions.set({ ...$slidesOptions, columns: 4 })} bold={false} center>
                        <p class="text" title={$dictionary.actions?.resetZoom}>{(100 / $slidesOptions.columns).toFixed()}%</p>
                    </Button>
                    <Button disabled={$slidesOptions.columns <= 2} on:click={() => slidesOptions.set({ ...$slidesOptions, columns: Math.max(2, $slidesOptions.columns - 1) })} title={$dictionary.actions?.zoomIn} center>
                        <Icon size={1.3} id="add" white />
                    </Button>
                    <Button disabled={$slidesOptions.columns >= 10} on:click={() => slidesOptions.set({ ...$slidesOptions, columns: Math.min(10, $slidesOptions.columns + 1) })} title={$dictionary.actions?.zoomOut} center>
                        <Icon size={1.3} id="remove" white />
                    </Button>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    canvas {
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;

        border: none;
    }

    .load {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;

        display: flex;
        justify-content: center;
        align-items: center;

        background-color: var(--primary-darker);
    }

    .grid {
        position: relative;

        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        padding: 5px;
        width: 100%;
        height: 100%;

        flex: 1;
        overflow: auto;
    }

    /* one page */
    .grid :global(.overlay) {
        width: 100px;
        height: 100px;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
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

        overflow: hidden;

        aspect-ratio: 16 / 9;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .main.active {
        outline: 2px solid var(--secondary);
        outline-offset: -1px;
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
    }

    .actionbar p {
        padding: 0 10px;
        opacity: 0.8;
    }

    .actionbar div.buttons {
        position: relative;
        width: initial;

        display: flex;
        align-items: center;
    }

    /* zoom */
    .zoom_container {
        position: absolute;
        right: 0;
        top: 0;
        transform: translateY(-100%);
        overflow: hidden;

        flex-direction: column;
        width: auto;
        /* border-left: 3px solid var(--primary-lighter); */

        z-index: 2;

        background-color: var(--primary-darkest);
    }
</style>
