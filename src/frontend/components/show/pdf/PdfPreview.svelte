<script lang="ts">
    import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask } from "pdfjs-dist"
    import { onDestroy, onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import { activePopup, activeProject, focusMode, labelsDisabled, outLocked, outputs, popupData, projects, slidesOptions, styles } from "../../../stores"
    import { triggerClickOnEnterSpace } from "../../../utils/clickable"
    import { newToast, wait } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import { getFileName, removeExtension } from "../../helpers/media"
    import { getActiveOutputs, setOutput, startFolderTimer } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialZoom from "../../inputs/MaterialZoom.svelte"
    import Loader from "../../main/Loader.svelte"
    import { clearBackground } from "../../output/clear"

    export let show
    export let index: number

    let data: { timer?: number } | undefined
    $: data = $projects[$activeProject || ""]?.shows?.[index]?.data

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

        if (timer) startFolderTimer(path, { type: "pdf", path: "" })
    }

    // AUTO SCROLL TO ACTIVE PAGE
    let isScrolling: any = null
    $: if (active !== -1) scrollToActive()
    function scrollToActive() {
        if (isScrolling) clearTimeout(isScrolling)
        isScrolling = setTimeout(() => {
            const slide = document.getElementById("id_" + getId(path) + "_" + active)
            if (!slide) return

            const scrollElem = slide.closest(".grid")
            const slideTop = slide.offsetTop
            const slideHeight = slide.clientHeight

            scrollElem?.scrollTo({ top: slideTop - slideHeight * 0.8, behavior: "smooth" })

            isScrolling = null
        }, 50)
    }

    function getId(text: string) {
        if (typeof text !== "string") return ""
        return text.replace(/[^a-zA-Z0-9]+/g, "")
    }

    /////

    // GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    GlobalWorkerOptions.workerSrc = "./assets/pdf.worker.min.mjs"

    let pageCount = 0
    let canvases: (HTMLCanvasElement | undefined)[] = []

    let loading = true
    let loadingTask: PDFDocumentLoadingTask | null = null
    let renderTasks: any[] = []
    let currentPath = ""

    const workerErrors = ["RenderingCancelledException", "Transport destroyed", "Worker was destroyed", "Worker was terminated", "sendWithPromise"]
    const isWorkerError = (error: any) => error?.name === "RenderingCancelledException" || workerErrors.some((msg) => error?.message?.includes(msg))

    onMount(loadPages)
    onDestroy(() => {
        renderTasks.forEach((task) => task?.cancel())
        try {
            loadingTask?.destroy()
        } catch {}
    })

    async function loadPages() {
        loading = true
        renderTasks.forEach((task) => task?.cancel())
        renderTasks = []

        if (loadingTask) {
            try {
                loadingTask.destroy()
            } catch {}
            loadingTask = null
            await wait(50)
        }

        if (!path) {
            loading = false
            return
        }

        const loadPath = path
        currentPath = path

        try {
            loadingTask = getDocument(path)
            const pdfDoc = await loadingTask.promise
            if (currentPath !== loadPath) return

            pageCount = pdfDoc.numPages
            await wait(10)

            for (let i = 0; i < pageCount; i++) {
                if (currentPath !== loadPath) return

                try {
                    const page = await pdfDoc.getPage(i + 1)
                    if (currentPath !== loadPath) return

                    const viewport = page.getViewport({ scale: 1.5 })
                    const canvas = canvases[i]
                    const context = canvas?.getContext("2d")
                    if (!context) break

                    canvas!.height = viewport.height
                    canvas!.width = viewport.width

                    const renderTask = page.render({ canvas: canvas!, canvasContext: context, viewport })
                    renderTasks[i] = renderTask

                    try {
                        await renderTask.promise
                    } catch (error: any) {
                        if (error?.name === "RenderingCancelledException") continue
                        throw error
                    }

                    // display when the first page has loaded
                    loading = false
                } catch (error: any) {
                    if (isWorkerError(error)) return
                    throw error
                }
            }
        } catch (error: any) {
            if (!isWorkerError(error)) console.error("PDF loading error:", error)
            loading = false
        }
    }

    function convertToImages() {
        newToast("actions.converting")
        sendMain(Main.PDF_TO_IMAGE, { filePath: path })
    }

    $: timer = data?.timer || 0
    $: totalTime = pageCount * timer
</script>

<div class="grid">
    {#each { length: pageCount } as _page, i}
        <div id={"id_" + getId(path) + "_" + i} class="main" class:active={active === i} style="{output?.color ? 'outline: 2px solid ' + output.color + ';' : ''}width: {100 / (pageCount > 1 ? $slidesOptions.columns : 1)}%;">
            <!-- icons -->
            <div class="icons">
                {#if timer}
                    <div>
                        <div class="button">
                            <div style="padding: 3px;" data-title={translateText("preview.nextTimer")}>
                                <Icon id="clock" size={0.9} white />
                            </div>
                        </div>
                        <span><p>{timer}</p></span>
                    </div>
                {/if}
            </div>

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

{#if !$focusMode}
    <!-- <FloatingInputs side="left">
    <span style="min-width: 60px;display: flex;align-items: center;justify-content: center;opacity: 0.8;">PDF</span>
</FloatingInputs> -->

    <FloatingInputs>
        <MaterialButton icon="image" on:click={convertToImages} style="white-space: nowrap;">
            {#if !$labelsDisabled}<T id="actions.convert_to_images" />{/if}
        </MaterialButton>

        <div class="divider"></div>

        <MaterialButton
            disabled={pageCount < 2}
            on:click={() => {
                popupData.set({ type: "pdf", value: timer, totalTime, count: pageCount })
                activePopup.set("next_timer")
            }}
            title="popup.next_timer{totalTime !== 0 ? `: ${totalTime}s` : ''}"
        >
            <Icon size={1.1} id="clock" white={totalTime === 0} />
            <!-- {joinTime(secondsToTime(totalTime))} -->
        </MaterialButton>

        <div class="divider"></div>

        <MaterialZoom columns={$slidesOptions.columns} on:change={(e) => slidesOptions.set({ ...$slidesOptions, columns: e.detail })} />
    </FloatingInputs>
{/if}

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

    /* icons */

    .icons {
        pointer-events: none;
        display: flex;
        flex-direction: column;
        position: absolute;
        z-index: 1;
        font-size: 0.9em;

        height: 80%;
        flex-wrap: wrap;
        place-items: start;
        left: 0;
    }

    .icons div {
        opacity: 0.9;
        display: flex;
    }
    .icons .button {
        background-color: rgb(0 0 0 / 0.6);
        pointer-events: all;
    }
    .icons span {
        pointer-events: all;
        background-color: rgb(0 0 0 / 0.6);
        padding: 3px;
        font-size: 0.75em;
        font-weight: bold;
        display: flex;
        align-items: center;
    }
</style>
