<script lang="ts">
    import { activeEdit, activeShow, cachedShowsData, showsCache } from "../../stores"
    import T from "../helpers/T.svelte"
    import { findMatchingOut } from "../helpers/output"
    import { getShowCacheId } from "../helpers/show"
    import Slide from "../slide/Slide.svelte"
    import Autoscroll from "../system/Autoscroll.svelte"
    import Center from "../system/Center.svelte"
    import DropArea from "../system/DropArea.svelte"

    $: showId = $activeShow?.id || ""
    $: currentShow = $showsCache[showId]
    $: layoutSlides = $cachedShowsData[getShowCacheId(showId, currentShow)]?.layout || []

    function keydown(e: any) {
        if (e.altKey) {
            e.preventDefault()
            altKeyPressed = true
        }

        if (e.target instanceof HTMLTextAreaElement || e.target.closest(".edit")) return

        if (e.key === "ArrowDown") {
            // Arrow Down
            e.preventDefault()
            ;(document.activeElement as any)?.blur()

            if ($activeEdit.slide === null || $activeEdit.slide === undefined) {
                activeEdit.set({ slide: 0, items: [] })
            } else if ($activeEdit.slide < layoutSlides.length - 1) {
                activeEdit.set({ slide: $activeEdit.slide + 1, items: [] })
            }
        } else if (e.key === "ArrowUp") {
            // Arrow Up
            e.preventDefault()
            ;(document.activeElement as any)?.blur()

            if ($activeEdit.slide === null || $activeEdit.slide === undefined) {
                activeEdit.set({ slide: layoutSlides.length - 1, items: [] })
            } else if ($activeEdit.slide > 0) {
                activeEdit.set({ slide: $activeEdit.slide - 1, items: [] })
            }
        }
    }

    let scrollElem: any
    let offset: number = -1
    $: {
        if (loaded && $activeEdit.slide !== null && $activeEdit.slide !== undefined) {
            let index = $activeEdit.slide - 1
            setTimeout(() => {
                if (index >= 0 && scrollElem) offset = scrollElem.querySelector(".grid")?.children?.[index]?.offsetTop || 5 - 5
            }, 10)
        }
    }

    let columns: number = 1

    let nextScrollTimeout: any = null
    function wheel(e: any) {
        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout) return

        e.preventDefault()
        columns = Math.max(1, Math.min(4, columns + (e.deltaY < 0 ? -1 : 1)))

        // don't start timeout if scrolling with mouse
        if (e.deltaY > 100 || e.deltaY < -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    let altKeyPressed: boolean = false
    function keyup() {
        altKeyPressed = false
    }

    // lazy loader

    let lazyLoader: number = 1
    let timeout: any = null
    let loaded: boolean = false

    // reset loading when changing view modes
    $: if ($activeShow?.id) loaded = false

    $: if (!loaded && !lazyLoading && layoutSlides?.length) {
        lazyLoading = true
        lazyLoader = 1
        startLazyLoader()
    }

    let lazyLoading: boolean = false
    function startLazyLoader() {
        if (!layoutSlides) return
        if (lazyLoader >= layoutSlides.length) {
            loaded = true
            lazyLoading = false
            return
        }
        if (timeout) clearTimeout(timeout)

        timeout = setTimeout(() => {
            lazyLoader++
            startLazyLoader()
        }, 10)
    }
</script>

<svelte:window on:keydown={keydown} on:keyup={keyup} on:mousedown={keyup} />

<Autoscroll {offset} bind:scrollElem style="display: flex;background-color: var(--primary-darker);">
    <DropArea id="all_slides" selectChildren>
        <DropArea id="slides" hoverTimeout={0} selectChildren>
            {#if layoutSlides.length}
                <div class="grid" on:wheel={wheel}>
                    {#each layoutSlides as slide, i}
                        {#if (loaded || i < lazyLoader) && currentShow?.slides?.[slide.id]}
                            <Slide
                                {showId}
                                slide={currentShow.slides[slide.id]}
                                show={currentShow}
                                layoutSlide={slide}
                                {layoutSlides}
                                index={i}
                                color={slide.color}
                                active={findMatchingOut(slide.id) !== null}
                                focused={$activeEdit.slide === i}
                                noQuickEdit
                                {altKeyPressed}
                                {columns}
                                on:click={(e) => {
                                    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) activeEdit.set({ slide: i, items: [] })
                                }}
                            />
                        {/if}
                    {/each}
                </div>
            {:else}
                <Center faded>
                    <T id="empty.slides" />
                </Center>
            {/if}
        </DropArea>
    </DropArea>
</Autoscroll>

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        padding: 5px;
        width: 100%;
        height: 100%;
        align-content: flex-start;
    }
</style>
