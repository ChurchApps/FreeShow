<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import type { Resolution } from "../../../../types/Settings"
    import Center from "../../../common/components/Center.svelte"
    import { translate } from "../../util/helpers"
    import { GetLayout } from "../../util/output"
    import { send } from "../../util/socket"
    import { activeShow, mediaCache, outShow, styleRes } from "../../util/stores"
    import Slide from "./ShowSlide.svelte"

    export let outSlide: number | null
    export let dictionary: any
    export let columns: number = 2
    let resolution: Resolution = $styleRes || { width: 1920, height: 1080 }

    // $: id = $activeShow!.id
    // $: currentShow = $shows[$activeShow!.id]
    // $: layoutSlides = [$shows[$activeShow!.id].layouts[$shows[$activeShow!.id].settings.activeLayout].slides, GetLayout($activeShow!.id)][1]
    $: layoutSlides = GetLayout($activeShow, $activeShow?.settings?.activeLayout || "")

    // auto scroll
    export let scrollElem: HTMLElement | undefined
    let lastScrollId = "-1"
    let pendingScrollIndex: number | null = null
    let pendingScrollTries = 0
    let pendingScrollTimer: ReturnType<typeof setTimeout> | null = null

    function runAutoScroll() {
        if (!scrollElem || pendingScrollIndex === null) return

        const slideElem = scrollElem.querySelector(`.grid [data-index="${pendingScrollIndex}"]`) as HTMLElement | null
        if (!slideElem) {
            if (pendingScrollTries < 80) {
                pendingScrollTries++
                if (pendingScrollTimer) clearTimeout(pendingScrollTimer)
                pendingScrollTimer = setTimeout(runAutoScroll, 80)
            }
            return
        }

        const slideRect = slideElem.getBoundingClientRect()
        const containerRect = scrollElem.getBoundingClientRect()
        const offset = slideRect.top - containerRect.top + scrollElem.scrollTop - 54
        scrollElem.scrollTo(0, offset)
        pendingScrollIndex = null
        pendingScrollTries = 0
        if (pendingScrollTimer) {
            clearTimeout(pendingScrollTimer)
            pendingScrollTimer = null
        }
    }

    $: {
        if (outSlide !== null && $outShow?.id === $activeShow?.id) {
            const index = Math.max(0, outSlide)
            if (index + 1 > renderedCount) {
                renderedCount = Math.min(allSlides.length, index + 1)
            }
            if (($outShow?.id || "") + index !== lastScrollId) {
                lastScrollId = ($outShow?.id || "") + index
                pendingScrollIndex = index
                pendingScrollTries = 0
                runAutoScroll()
            }
        }
    }

    let dispatch = createEventDispatcher()
    function click(i: number) {
        dispatch("click", i)
    }

    // pinch zoom
    let scaling: boolean = false
    let initialDistance: number = 0
    let initialColumns: number = columns
    const touchstart = (e: any) => {
        if (e.touches.length === 2) {
            initialDistance = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY)
            initialColumns = columns
            scaling = true
        }
    }

    const margin = 150
    let scaled = 0
    const touchmove = (e: any) => {
        if (scaling) {
            e.preventDefault()
            let dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY)

            let newColumns = 1
            scaled = initialDistance / margin - dist / margin
            if (scaled < 0) newColumns = initialColumns + scaled
            else newColumns = initialColumns + scaled

            columns = Math.min(4, Math.max(1, Math.floor(newColumns)))
        }
    }
    const touchend = () => (scaling = false)

    // open tab instantly before loading content
    let loadingStarted: boolean = false
    onMount(() => {
        loadingStarted = true
    })

    // Keep thumbnail requests slow, but enqueue all slides immediately on show open.
    const THUMB_REQUEST_DELAY = 180
    const RENDER_BATCH_SIZE = 2
    const RENDER_BATCH_DELAY = 40
    let lastShowId = ""
    const queuedThumbs = new Set<string>()
    const thumbQueue: string[] = []
    let drainingThumbs = false
    let renderedCount = 0
    let lastRenderShowId = ""
    let renderBatchTimer: ReturnType<typeof setTimeout> | null = null

    function isDirectPath(path: string) {
        return path.startsWith("data:") || path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:")
    }

    function queueThumbnail(path: string) {
        if (!path || queuedThumbs.has(path)) return
        queuedThumbs.add(path)
        thumbQueue.push(path)
        if (!drainingThumbs) void drainThumbnailQueue()
    }

    function clearRenderBatchTimer() {
        if (!renderBatchTimer) return
        clearTimeout(renderBatchTimer)
        renderBatchTimer = null
    }

    function queueRenderBatch() {
        if (renderBatchTimer || renderedCount >= allSlides.length) return

        renderBatchTimer = setTimeout(() => {
            renderBatchTimer = null
            renderedCount = Math.min(allSlides.length, renderedCount + RENDER_BATCH_SIZE)
            if (renderedCount < allSlides.length) queueRenderBatch()
        }, RENDER_BATCH_DELAY)
    }

    async function drainThumbnailQueue() {
        if (drainingThumbs) return
        drainingThumbs = true

        while (thumbQueue.length) {
            const path = thumbQueue.shift()
            if (!path) continue
            send("API:get_thumbnail", { path })
            await new Promise((resolve) => setTimeout(resolve, THUMB_REQUEST_DELAY))
        }

        drainingThumbs = false
    }

    $: currentShowId = $activeShow?.id || ""
    $: if (currentShowId !== lastShowId) {
        lastShowId = currentShowId
        thumbQueue.length = 0
        queuedThumbs.clear()
    }

    $: if (currentShowId !== lastRenderShowId) {
        lastRenderShowId = currentShowId
        renderedCount = 0
        clearRenderBatchTimer()
    }

    $: allSlides = layoutSlides.map((slide, index) => {
        const backgroundPath = $activeShow?.media?.[slide.background || ""]?.path || ""
        return { slide, index, backgroundPath }
    })

    $: if (renderedCount > allSlides.length) renderedCount = allSlides.length

    $: if (loadingStarted && renderedCount < allSlides.length) {
        queueRenderBatch()
    }

    $: visibleSlides = allSlides.slice(0, renderedCount)

    $: allSlides.forEach(({ backgroundPath }) => {
        if (!backgroundPath || isDirectPath(backgroundPath) || $mediaCache[backgroundPath]) return
        queueThumbnail(backgroundPath)
    })

    onDestroy(() => {
        thumbQueue.length = 0
        queuedThumbs.clear()
        clearRenderBatchTimer()
        if (pendingScrollTimer) clearTimeout(pendingScrollTimer)
    })
</script>

<div class="grid" on:touchstart={touchstart} on:touchmove={touchmove} on:touchend={touchend}>
    {#if layoutSlides.length}
        {#if layoutSlides.length < 10 || loadingStarted}
            {#each visibleSlides as entry (`${$activeShow?.id || "show"}-${entry.slide.id || "slide"}-${entry.index}`)}
                {@const isActive = outSlide === entry.index && $outShow?.id === $activeShow?.id}
                {@const useLightMode = layoutSlides.length > 12 && !isActive}
                <Slide
                    {resolution}
                    media={$activeShow?.media}
                    layoutSlide={entry.slide}
                    slide={$activeShow?.slides[entry.slide.id]}
                    index={entry.index}
                    color={entry.slide.color}
                    active={isActive}
                    renderItems={!useLightMode}
                    {columns}
                    on:click={() => {
                        // if (!$outLocked && !e.ctrlKey) {
                        //   outSlide.set({ id, index: i })
                        // }
                        click(entry.index)
                    }}
                />
            {/each}
            {#if visibleSlides.length < allSlides.length}
                <Center faded>{translate("remote.loading", $dictionary)}</Center>
            {/if}
        {:else}
            <Center faded>{translate("remote.loading", $dictionary)}</Center>
        {/if}
    {:else}
        <Center faded>{translate("empty.slides", $dictionary)}</Center>
    {/if}
</div>

<style>
    /* .scroll {
    padding-bottom: 10px;
  } */

    .grid {
        display: flex;
        flex-wrap: wrap;
        /* gap: 10px; */
        padding: 5px;
        height: 100%;
        align-content: flex-start;
    }
</style>
