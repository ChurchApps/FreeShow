<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import Loader from "../../../common/components/Loader.svelte"
    import Clear from "../show/Clear.svelte"
    import { send } from "../../util/socket"
    import { isCleared, outData, outShow, outSlide, pdfPages, mediaCache } from "../../util/stores"

    export let active: any
    export let tablet: boolean = false

    let path = ""
    let pagesPaths: string[] | null = null
    let pages: string[] = []

    $: {
        pagesPaths = null
        path = ""

        if (active?.media) {
            const mediaItems: any[] = Array.isArray(active.media) ? active.media : Object.values(active.media)
            const paths = mediaItems.map((m) => m.path).filter((p) => typeof p === "string")
            if (paths.length) {
                pagesPaths = paths
            }
        }

        if (pagesPaths) {
            const pdfEntry = pagesPaths.find((p) => typeof p === "string" && p.toLowerCase().endsWith(".pdf"))
            if (pdfEntry) {
                path = pdfEntry
            }
        }

        if (!path && active?.id && typeof active.id === "string") {
            if (active.id.includes("/") || active.id.includes("\\") || active.id.startsWith("data:")) {
                path = active.id
            }
        }
    }

    $: if (pagesPaths) {
        pages = pagesPaths.map((p) => {
            if (typeof p !== "string") return ""
            if (p.startsWith("data:")) return p
            return $mediaCache[p] || ""
        })

        pagesPaths.forEach((p, idx) => {
            if (!pages[idx] && !p.startsWith("data:")) {
                send("API:get_thumbnail", { path: p })
            }
        })
    } else {
        pages = []
    }

    $: if (pagesPaths && $mediaCache) {
        pages = pagesPaths.map((p) => {
            if (typeof p !== "string") return ""
            if (p.startsWith("data:")) return p
            return $mediaCache[p] || ""
        })
    }

    $: if ((pages.length === 0 || pages.every((x) => !x)) && path) {
        if ($pdfPages[path]) {
            pages = $pdfPages[path]
        }
    }

    let requestedPath = ""
    $: if (path && pages.length === 0 && requestedPath !== path) {
        if (path.includes("/") || path.includes("\\") || path.startsWith("data:")) {
            send("API:get_pdf_thumbnails", { path })
            requestedPath = path
        }
    }


    let loading = true
    $: {
        if (pages.length > 0 && pages.some((p) => p && p.length > 0)) {
            loading = false
        } else if ((pagesPaths && pagesPaths.length > 0) || path) {
            loading = true
        } else {
            loading = false
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

    const columns = tablet ? 2 : 2

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

</script>

<div class="page">
    <div class="grid">
        {#if loading}
            <div class="load">
                <Loader />
            </div>
        {:else if pages.length > 0}
            {#each pages as page, i}
                <div class="main" class:active={activePage === i} style="width: {100 / Math.max(1, columns)}%;">
                    <button type="button" class="slide" on:click={() => onSlideClick(i)}>
                        {#if page}
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
        justify-content: center;
        align-items: stretch;
        cursor: pointer;
        aspect-ratio: 16 / 9;
    }

    .slide :global(.placeholder) {
        min-height: 120px;
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
