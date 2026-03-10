<script lang="ts">
    import { onMount } from "svelte"
    import Button from "../../../common/components/Button.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import Loader from "../../../common/components/Loader.svelte"
    import Clear from "../show/Clear.svelte"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { dictionary, isCleared, outData, outShow, outSlide, pdfPages, mediaCache } from "../../util/stores"

    export let active: any
    export let tablet: boolean = false

    // Determine source of pages: either we already have images in show.media,
    // or we must request thumbnails via API using a real file path.
    let path = "" // PDF path for API
    let pagesPaths: string[] | null = null
    let pages: string[] = []

    // compute list of candidate paths from active.media
    $: {
        pagesPaths = null
        if (active?.media) {
            const mediaItems: any[] = Array.isArray(active.media) ? active.media : Object.values(active.media)
            const paths = mediaItems.map((m) => m.path).filter((p) => typeof p === "string")
            if (paths.length) {
                pagesPaths = paths
            }
        }

        // find explicit pdf file path if present
        if (pagesPaths) {
            const pdfEntry = pagesPaths.find((p) => typeof p === "string" && p.toLowerCase().endsWith(".pdf"))
            if (pdfEntry) {
                path = pdfEntry
            }
        }

        // if we still don't have a pdf path, try active.id when it looks like a path
        if (!path && active?.id && typeof active.id === "string") {
            if (active.id.includes("/") || active.id.includes("\\") || active.id.startsWith("data:")) {
                path = active.id
            }
        }
    }

    // build the actual pages array from pagesPaths + cache
    $: pages = []
    $: if (pagesPaths) {
        pages = pagesPaths.map((p) => {
            if (typeof p !== "string") return ""
            if (p.startsWith("data:")) return p
            return $mediaCache[p] || ""
        })
        // if we have some empty slots (not cached yet) and no pdf was used, request them
        pagesPaths.forEach((p, idx) => {
            if (!pages[idx] && !p.startsWith("data:")) {
                send("API:get_thumbnail", { path: p })
            }
        })
    }
    
    // re-sync pages when mediaCache updates (server sends back thumbnails)
    $: if (pagesPaths && $mediaCache) {
        pages = pagesPaths.map((p) => {
            if (typeof p !== "string") return ""
            if (p.startsWith("data:")) return p
            return $mediaCache[p] || ""
        })
    }

    // if we lack pages (all empty) and have a PDF path, fallback to API paths stored per-PDF
    $: if ((pages.length === 0 || pages.every((x) => !x)) && path) {
        if ($pdfPages[path]) {
            pages = $pdfPages[path]
        }
    }

    // pages now either contains direct images or will be populated later when mediaCache/pdfPages update

    // if path updates after mount (e.g. serverShow arrives), request pages again
    let sentPath = false
    $: if (path) {
        // reset flag whenever path changes
        sentPath = false
    }
    $: if (path && pages.length === 0 && !sentPath) {
        // ensure path seems valid (contains slash, backslash or data:)
        if (path.includes("/") || path.includes("\\") || path.startsWith("data:")) {
            send("API:get_pdf_thumbnails", { path })
            sentPath = true
        }
    }


    let loading = true
    $: {
        // loading is done when we have pages AND all pages have content (non-empty strings)
        if (pages.length > 0 && pages.some((p) => p && p.length > 0)) {
            loading = false
        } else if (pagesPaths && pagesPaths.length > 0) {
            loading = true
        }
    }


    let activePage = -1
    $: out = $outData?.slide
    $: {
        const isCurrentOutputShow = !!active?.id && $outShow?.id === active.id && typeof $outSlide === "number"
        const matchesConvertedPdf = out?.type === "pdf" && active?.id && out?.id === active.id
        const matchesFilePdf = out?.type === "pdf" && path && out?.id === path

        if (isCurrentOutputShow) activePage = $outSlide ?? -1
        else if (matchesConvertedPdf || matchesFilePdf) activePage = out?.page || 0
        else activePage = -1
    }

    $: isOutputCurrentShow = !!active?.id && $outShow?.id === active.id
    $: showClearControls = isOutputCurrentShow || !$isCleared.all

    type ThumbSize = "large" | "medium" | "small"
    let thumbSize: ThumbSize = tablet ? "small" : "medium"
    const sizeToColumns: Record<ThumbSize, number> = {
        large: 1,
        medium: 2,
        small: tablet ? 3 : 3
    }
    $: columns = sizeToColumns[thumbSize]

    onMount(() => {
        const storedSize = localStorage.getItem("remote_pdf_size") as ThumbSize | null
        if (storedSize === "large" || storedSize === "medium" || storedSize === "small") {
            thumbSize = storedSize
        }
    })

    function setSize(size: ThumbSize) {
        thumbSize = size
        localStorage.setItem("remote_pdf_size", size)
    }

    function onSlideClick(page: number) {
        // Use index_select_slide API to navigate to the slide by index
        send("API:index_select_slide", { showId: active?.id, layoutId: "", index: page })
    }

    function previousSlide() {
        send("API:previous_slide")
    }

    function nextSlide() {
        send("API:next_slide")
    }

    function isImageLoaded(): boolean {
        // In remote view, show all thumbnails (no lazy loading needed)
        // In main output, lazy loading protects against PDF rendering issues
        return true
    }
</script>

<div class="page">
    <div class="grid" class:large-mode={thumbSize === "large"}>
        {#if pages.length > 0}
            <div class="toolbar">
                <button class="size" class:active-size={thumbSize === "large"} on:click={() => setSize("large")}>{translate("size.large", $dictionary) || "Large"}</button>
                <button class="size" class:active-size={thumbSize === "medium"} on:click={() => setSize("medium")}>{translate("size.medium", $dictionary) || "Medium"}</button>
                <button class="size" class:active-size={thumbSize === "small"} on:click={() => setSize("small")}>{translate("size.small", $dictionary) || "Small"}</button>
            </div>
        {/if}

        {#if loading}
            <div class="load">
                <Loader />
            </div>
        {:else if pages.length > 0}
            {#each pages as page, i}
                <div class="main" class:active={activePage === i} style="width: {100 / Math.max(1, columns)}%;">
                    <button type="button" class="slide" on:click={() => onSlideClick(i)}>
                        {#if isImageLoaded() && page}
                            <img src={page} alt="" />
                        {:else}
                            <div class="placeholder">
                                <Loader />
                            </div>
                        {/if}
                        <div class="number">{i + 1}</div>
                    </button>
                </div>
            {/each}
        {/if}
    </div>

    {#if showClearControls}
        <div class="clear-wrap">
            <Clear outSlide={activePage} />

            {#if isOutputCurrentShow}
                <div class="nav-wrap">
                    <Button on:click={previousSlide} disabled={activePage <= 0} variant="outlined" center compact>
                        <Icon id="previous" size={1.2} />
                    </Button>
                    <span class="nav-counter">{Math.max(activePage + 1, 1)}/{pages.length || 0}</span>
                    <Button on:click={nextSlide} disabled={activePage >= pages.length - 1 || pages.length === 0} variant="outlined" center compact>
                        <Icon id="next" size={1.2} />
                    </Button>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .page {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    img {
        width: 100%;
        height: auto;
        display: block;
        object-fit: contain;
        pointer-events: none;

        border: none;
    }

    .placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: var(--primary-darker);
        /* removed border to avoid green box */
        border: none;
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
        /* FreeShow UI scrollbar */
        scrollbar-width: thin; /* Firefox */
        scrollbar-color: rgb(255 255 255 / 0.3) rgb(255 255 255 / 0.05);
    }

    .clear-wrap {
        border-top: 1px solid rgb(255 255 255 / 0.08);
        background: var(--primary-darkest);
        padding-top: 4px;
    }

    .nav-wrap {
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: relative;
        gap: 12px;
        padding: 2px 6px 10px;
        background: var(--primary-darkest);
        min-height: 36px;
    }

    .nav-wrap :global(button) {
        min-width: 32px;
        min-height: 32px !important;
        padding: 2px 6px !important;
        flex-shrink: 0;
    }

    .nav-wrap :global(button) :global(svg) {
        fill: var(--secondary);
    }

    .nav-counter {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
        font-size: 0.95rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: white;
        pointer-events: none;
    }

    .toolbar {
        position: sticky;
        top: 0;
        z-index: 5;
        width: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px;
        background: rgb(8 10 20 / 0.95);
        border-bottom: 1px solid rgb(255 255 255 / 0.08);
        margin-bottom: 4px;
    }

    .size {
        min-width: 52px;
        height: 30px;
        border: 1px solid rgb(255 255 255 / 0.2);
        color: var(--text, white);
        background: rgb(255 255 255 / 0.06);
        border-radius: 6px;
        font-size: 0.78em;
        font-weight: 700;
        padding: 0 8px;
    }

    .active-size {
        background: rgb(255 0 149 / 0.2);
        border-color: rgb(255 0 149 / 0.85);
    }

    .grid::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    .grid::-webkit-scrollbar-track,
    .grid::-webkit-scrollbar-corner {
        background: rgb(255 255 255 / 0.05);
    }
    .grid::-webkit-scrollbar-thumb {
        background: rgb(255 255 255 / 0.3);
        border-radius: 8px;
    }
    .grid::-webkit-scrollbar-thumb:hover {
        background: rgb(255 255 255 / 0.5);
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
        border: none;
        background-color: var(--primary-darkest);
        z-index: 0;
        outline-offset: 0;
        width: 100%;

        position: relative;

        overflow: hidden;

        display: flex;
        justify-content: flex-start;
        align-items: stretch;
        cursor: pointer;
    }

    .slide :global(.placeholder) {
        min-height: 120px;
    }

    .grid.large-mode .main {
        padding-left: 0;
        padding-right: 0;
    }

    .grid.large-mode .slide {
        aspect-ratio: 3 / 2;
        min-height: 230px;
    }

    .grid.large-mode img {
        object-fit: cover;
    }

    .number {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgb(5 6 18 / 0.9);
        font-size: 1.05em;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: white;
    }

    .main.active {
        outline: 3px solid var(--secondary);
        outline-offset: -1px;
    }
</style>
