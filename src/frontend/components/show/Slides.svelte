<script lang="ts">
    // import {flip} from 'svelte/animate';
    // import type { Resolution } from "../../../types/Settings"

    import { activeShow, cachedShowsData, notFound, outLocked, outputs, showsCache, slidesOptions, styles } from "../../stores"
    import { history } from "../helpers/history"
    import { getActiveOutputs, refreshOut, setOutput } from "../helpers/output"
    import { getItemWithMostLines, updateOut } from "../helpers/showActions"
    import { _show } from "../helpers/shows"
    import T from "../helpers/T.svelte"
    import Loader from "../main/Loader.svelte"
    import Slide from "../slide/Slide.svelte"
    import Autoscroll from "../system/Autoscroll.svelte"
    import Center from "../system/Center.svelte"
    import DropArea from "../system/DropArea.svelte"
    import TextEditor from "./TextEditor.svelte"
    // import { GetLayout } from "../helpers/get"

    // let viewWidth: number = window.innerWidth / 3
    // let resolution: Resolution = $showsCache[showId].settings.resolution || $screen.resolution
    // let zoom = 0.15
    // console.log(elem)

    // = width / main padding - slide padding - extra - columns*gaps/padding / columns / resolution
    // $: zoom = (viewWidth - 20 - 0 - 0 - ($slidesOptions.columns - 1) * (10 + 0)) / $slidesOptions.columns / resolution.width
    $: showId = $activeShow?.id || ""
    $: currentShow = $showsCache[showId]
    $: activeLayout = $showsCache[showId]?.settings?.activeLayout
    // $: layoutSlides = GetLayout(showId, activeLayout)
    // $: layoutSlides = [$showsCache[showId]?.layouts?.[activeLayout]?.slides, GetLayout(showId)][1]
    // $: layoutSlides = _show(showId).layouts(activeLayout).ref()[0]
    $: layoutSlides = $cachedShowsData[showId]?.layout || []

    let scrollElem: any
    let offset: number = -1
    // let behaviour: string = ""
    // setTimeout(() => (behaviour = "scroll-behavior: smooth;"), 50)
    $: {
        // output.out?.slide?.id !== null &&
        let output = $outputs[activeOutputs[0]] || {}
        if (scrollElem && showId === output.out?.slide?.id && activeLayout === output.out?.slide?.layout) {
            let columns = $slidesOptions.mode === "grid" ? ($slidesOptions.columns > 2 ? $slidesOptions.columns : 0) : 1
            let index = Math.max(0, (output.out.slide.index || 0) - columns)
            offset = (scrollElem.querySelector(".grid")?.children[index]?.offsetTop || 5) - 5

            // TODO: always show active slide....
            // console.log(offset, scrollElem.scrollTop, scrollElem.scrollTop + scrollElem.offsetHeight)
            // if (offset < scrollElem.scrollTop || offset > scrollElem.scrollTop + scrollElem.offsetHeight) offset = scrollElem.querySelector(".grid").children[s.index].offsetTop - 5
        }
    }

    let nextScrollTimeout: any = null
    function wheel({ detail }: any) {
        let e: any = detail.event
        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout) return

        slidesOptions.set({ ...$slidesOptions, columns: Math.max(2, Math.min(10, $slidesOptions.columns + (e.deltaY < 0 ? -1 : 1))) })

        // don't start timeout if scrolling with mouse
        if (e.deltaY > 100 || e.deltaY < -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    function slideClick(e: any, index: number) {
        // TODO: duplicate function of "preview:126 - updateOut"
        if ($outLocked || e.ctrlKey || e.metaKey || e.shiftKey) return

        let slideRef: any = _show("active").layouts("active").ref()[0]
        updateOut("active", index, slideRef, !e.altKey)

        // if (activeOutputs[0]?.out?.slide?.id === id && activeOutputs[0]?.out?.slide?.index === index && activeOutputs[0]?.out?.slide?.layout === activeLayout) return
        // outSlide.set({ id, layout: activeLayout, index })
        setOutput("slide", { id: showId, layout: activeLayout, index, line: 0 })

        // force update output if index is the same as previous
        if (activeSlides[index]) refreshOut()
    }

    // disable slides that is after end (only visual)
    let endIndex: null | number = null
    $: {
        if (layoutSlides.length) {
            let index = layoutSlides.findIndex((a) => a.end === true && a.disabled !== true)
            if (index >= 0) endIndex = index
            else endIndex = null
        } else endIndex = null
    }

    $: if (showId && currentShow?.settings?.template && $cachedShowsData[showId]?.template?.slidesUpdated === false) {
        // update show by its template
        history({ id: "TEMPLATE", save: false, newData: { id: currentShow.settings.template }, location: { page: "show" } })
    }

    let altKeyPressed: boolean = false
    function keydown(e: any) {
        if (e.altKey) {
            e.preventDefault()
            altKeyPressed = true
        }
    }
    function keyup() {
        altKeyPressed = false
    }

    $: activeOutputs = getActiveOutputs($outputs, false)

    let activeSlides: any[] = []
    $: {
        activeSlides = []
        activeOutputs.forEach((a) => {
            let currentOutput: any = $outputs[a]
            let currentStyle = $styles[currentOutput?.style || ""] || {}
            if (!currentOutput) return

            let outSlide: any = currentOutput.out?.slide || {}

            // console.log(s, slideIndex, id, activeLayout)
            if (!activeSlides[outSlide.index] && outSlide.id === showId && outSlide.layout === activeLayout) {
                // get progress of current line division
                let amountOfLinesToShow: number = currentStyle.lines !== undefined ? Number(currentStyle.lines) : 0
                let lineIndex: any = outSlide.line || 0
                let maxLines: number = 0
                if (amountOfLinesToShow > 0) {
                    let ref = a?.id === "temp" ? [{ temp: true, items: outSlide.tempItems }] : _show(outSlide.id).layouts([outSlide.layout]).ref()[0]
                    let showSlide = outSlide.index !== undefined ? _show(outSlide.id).slides([ref[outSlide.index].id]).get()[0] : null
                    let slideLines = showSlide ? getItemWithMostLines(showSlide) : null
                    maxLines = slideLines && lineIndex !== null ? (amountOfLinesToShow >= slideLines ? 0 : Math.ceil(slideLines / amountOfLinesToShow)) : 0
                }

                activeSlides[outSlide.index] = {
                    color: $outputs[a].color,
                    line: lineIndex,
                    maxLines,
                }
            }
        })
    }

    // lazy loader

    let lazyLoader: number = 1
    let timeout: any = null
    let loaded: boolean = false

    // reset loading when changing view modes
    $: if (showId || activeLayout) loaded = false

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

    let loading: boolean = false
    $: if (showId) startLoading()
    $: if ($notFound.show?.includes(showId)) loading = false
    function startLoading() {
        loading = true
        setTimeout(() => {
            loading = false
        }, 8000)
    }
</script>

<!-- TODO: tab enter not woring -->

<svelte:window on:keydown={keydown} on:keyup={keyup} on:mousedown={keyup} />

<Autoscroll class="context #shows__close" on:wheel={wheel} {offset} bind:scrollElem style="display: flex;">
    <!-- on:drop={(e) => {
      if (selected.length && e.dataTransfer && ($dragged === "slide" || $dragged === "slideGroup")) drop(e.dataTransfer.getData("text"))
    }}
    on:dragover|preventDefault -->
    <DropArea id="all_slides" selectChildren>
        <DropArea id="slides" hoverTimeout={0} selectChildren>
            {#if $showsCache[showId] === undefined}
                <Center faded={!loading}>
                    {#if loading}
                        <Loader />
                    {:else}
                        <T id="error.no_show" />
                    {/if}
                </Center>
            {:else if $slidesOptions.mode === "text"}
                <TextEditor {currentShow} />
            {:else}
                <div class="grid">
                    <!-- {#each Object.values($showsCache[id].slides) as slide, i} -->
                    {#if layoutSlides.length}
                        {#each layoutSlides as slide, i}
                            {#if (loaded || i < lazyLoader) && currentShow.slides[slide.id] && ($slidesOptions.mode === "grid" || !slide.disabled)}
                                <Slide
                                    slide={currentShow.slides[slide.id]}
                                    show={currentShow}
                                    {layoutSlides}
                                    layoutSlide={slide}
                                    index={i}
                                    color={slide.color}
                                    output={activeSlides[i]}
                                    active={activeSlides[i] !== undefined}
                                    {endIndex}
                                    list={$slidesOptions.mode !== "grid" && $slidesOptions.mode !== "simple"}
                                    columns={$slidesOptions.columns}
                                    icons
                                    {altKeyPressed}
                                    on:click={(e) => slideClick(e, i)}
                                />
                            {/if}
                        {/each}
                    {:else}
                        <Center faded absolute size={2}>
                            <T id="empty.slides" />
                            <!-- Add slides button -->
                        </Center>
                    {/if}

                    <!-- TODO: snap to width! (Select columns instead of manual zoom size) -->
                </div>
            {/if}
        </DropArea>
    </DropArea>
</Autoscroll>

<style>
    /* .scroll {
    padding-bottom: 10px;
  } */

    .grid {
        display: flex;
        flex-wrap: wrap;
        /* gap: 10px; */
        padding: 5px;
        /* height: 100%; */
        /* align-content: flex-start; */
    }
</style>
