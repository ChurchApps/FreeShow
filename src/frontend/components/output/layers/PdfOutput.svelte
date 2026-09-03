<script lang="ts">
    import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist"
    import type { Transition } from "../../../../types/Show"
    import OutputTransition from "../transitions/OutputTransition.svelte"
    import { onDestroy } from "svelte"
    import { encodeFilePath } from "../../helpers/media"

    export let slide
    export let currentStyle
    export let transition: Transition

    $: path = slide.id
    $: console.log(currentStyle)

    GlobalWorkerOptions.workerSrc = "./assets/pdf.worker.min.mjs"

    let canvasElem: HTMLCanvasElement | undefined

    $: pageNum = (slide.page || 0) + 1
    $: loadPage(pageNum, path, canvasElem)

    let loadingTask: PDFDocumentLoadingTask | null = null
    let loadedDoc: PDFDocumentProxy | null = null
    let loadedPath = ""
    let renderTask: RenderTask | null = null

    onDestroy(() => {
        renderTask?.cancel()
        loadingTask?.destroy()
    })

    async function loadPage(pageNumber: number, currentPath: string, canvas: HTMLCanvasElement | undefined) {
        if (!canvas || !currentPath) return

        renderTask?.cancel()

        if (loadedPath !== currentPath || !loadedDoc) {
            loadingTask?.destroy()
            loadingTask = getDocument(encodeFilePath(currentPath))
            loadedDoc = await loadingTask.promise
            loadedPath = currentPath
        }
        if (!loadedDoc || canvas !== canvasElem) return

        const page = await loadedDoc.getPage(pageNumber)
        const context = canvas?.getContext("2d")
        if (!context || canvas !== canvasElem) return

        const viewportAtScale1 = page.getViewport({ scale: 1 })
        const scaleW = (window.innerWidth * window.devicePixelRatio) / viewportAtScale1.width
        const scaleH = (window.innerHeight * window.devicePixelRatio) / viewportAtScale1.height
        const scale = Math.min(scaleW, scaleH)

        const viewport = page.getViewport({ scale })
        canvas.height = viewport.height
        canvas.width = viewport.width

        renderTask = page.render({ canvas, canvasContext: context, viewport })
        try {
            await renderTask.promise
        } catch {}
    }

    let update = 0
    let prevSlide = ""
    $: {
        const slideKey = `${slide?.id}_${slide?.page}`
        if (prevSlide !== slideKey) {
            prevSlide = slideKey
            update++
        }
    }
</script>

{#key update}
    <OutputTransition {transition} inTransition={transition.in} outTransition={transition.out}>
        <canvas bind:this={canvasElem} />
    </OutputTransition>
{/key}

<style>
    canvas {
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
    }
</style>
