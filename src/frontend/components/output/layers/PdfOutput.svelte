<script lang="ts">
    import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask, type PDFDocumentProxy } from "pdfjs-dist"
    import type { Transition } from "../../../../types/Show"
    import OutputTransition from "../transitions/OutputTransition.svelte"
    import { onDestroy } from "svelte"
    import { shows } from "../../../stores"

    export let slide
    export let currentStyle
    export let transition: Transition

    $: path = slide.id
    $: console.log(currentStyle)

    GlobalWorkerOptions.workerSrc = "./assets/pdf.worker.min.mjs"

    let canvasElem: HTMLCanvasElement | undefined

    $: pageNum = slide.page + 1
    $: canvasElemExists = !!canvasElem
    $: if (path && canvasElemExists) loadPage(pageNum)

    onDestroy(() => loadingTask?.destroy())

    let loadingTask: PDFDocumentLoadingTask | null = null
    let loadedDoc: PDFDocumentProxy | null = null
    let loadedPath = ""
    async function loadPage(pageNumber: number) {
        if (!canvasElem) return

        // Check if this is a converted PDF show
        const show = $shows[path]
        if (show?.category === "converted") {
            // For converted shows, display the PNG image instead of PDF
            const imagePath = show.media?.[pageNumber - 1]
            if (imagePath) {
                const img = new Image()
                img.onload = () => {
                    const ctx = canvasElem?.getContext("2d")
                    if (ctx) {
                        canvasElem.width = img.width
                        canvasElem.height = img.height
                        ctx.drawImage(img, 0, 0)
                    }
                }
                img.onerror = () => {
                    console.error("Failed to load converted PDF image:", imagePath)
                }
                img.src = imagePath.startsWith("data:") ? imagePath : `file://${imagePath}`
            } else {
                console.warn("No image found for converted PDF page:", pageNumber, "in show:", path)
            }
            return
        }

        if (loadedPath !== path) {
            if (loadingTask) loadingTask.destroy()
            loadingTask = getDocument(path)
            loadedDoc = await loadingTask.promise
        }
        if (!loadedDoc) return

        const page = await loadedDoc.getPage(pageNumber)

        const context = canvasElem?.getContext("2d")
        if (!context) return

        const viewport = page.getViewport({ scale: 4 })
        canvasElem.height = viewport.height
        canvasElem.width = viewport.width

        page.render({ canvas: canvasElem, canvasContext: context, viewport })
    }

    let update = 0
    $: if (pageNum || path) update++
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
