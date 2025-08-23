<script lang="ts">
    import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask } from "pdfjs-dist"
    import { onDestroy, onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import { dataPath, labelsDisabled, outLocked, outputs, slidesOptions, styles } from "../../../stores"
    import { triggerClickOnEnterSpace } from "../../../utils/clickable"
    import { newToast, wait } from "../../../utils/common"
    import Icon from "../../helpers/Icon.svelte"
    import { getFileName, removeExtension } from "../../helpers/media"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialZoom from "../../inputs/MaterialZoom.svelte"
    import Loader from "../../main/Loader.svelte"
    import { clearBackground } from "../../output/clear"

    export let show
    $: path = show.id

    $: activeOutput = getActiveOutputs($outputs, false, true, true)[0]

    $: currentOutput = $outputs[activeOutput]
    $: transparentOutput = !!currentOutput?.transparent
    $: currentStyle = $styles[currentOutput?.style || ""] || {}

    // set active if output
    let active = -1
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

    /////

    // GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    GlobalWorkerOptions.workerSrc = "./assets/pdf.worker.min.mjs"

    let pageCount = 0
    let canvases: (HTMLCanvasElement | undefined)[] = []

    let loading = true
    let loadingTask: PDFDocumentLoadingTask | null = null
    onMount(loadPages)
    onDestroy(() => loadingTask?.destroy())
    async function loadPages() {
        loading = true
        if (!path) {
            loading = false
            return
        }

        loadingTask = getDocument(path)
        const pdfDoc = await loadingTask.promise
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

    function convertToImages() {
        newToast("$actions.converting")
        sendMain(Main.PDF_TO_IMAGE, { dataPath: $dataPath, filePath: path })
    }
</script>

<div class="grid">
    {#each { length: pageCount } as _page, i}
        <div class="main" class:active={active === i} style="{output?.color ? 'outline: 2px solid ' + output.color + ';' : ''}width: {100 / (pageCount > 1 ? $slidesOptions.columns : 1)}%;">
            <div class="slide" style={transparentOutput ? "" : `background-color: ${currentStyle.background};`} tabindex={0} role="button" on:click={(e) => outputPdf(e, i)} on:keydown={triggerClickOnEnterSpace}>
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

<!-- <FloatingInputs side="left">
    <span style="min-width: 60px;display: flex;align-items: center;justify-content: center;opacity: 0.8;">PDF</span>
</FloatingInputs> -->

<FloatingInputs>
    <MaterialButton icon="image" on:click={convertToImages} style="white-space: nowrap;">
        {#if !$labelsDisabled}<T id="actions.convert_to_images" />{/if}
    </MaterialButton>

    <div class="divider"></div>

    <MaterialZoom columns={$slidesOptions.columns} on:change={(e) => slidesOptions.set({ ...$slidesOptions, columns: e.detail })} />
</FloatingInputs>

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
        inset-inline-start: 0;
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
        left: 50%; /* stylelint-disable-line */
        /* If we use logical prop here we'll need to translate with + */
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
</style>
