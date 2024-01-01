<script lang="ts">
    import { activeShow, cachedShowsData, notFound, outLocked, outputs, showsCache, slidesOptions, special, styles } from "../../stores"
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

    $: showId = $activeShow?.id || ""
    $: currentShow = $showsCache[showId]
    $: activeLayout = $showsCache[showId]?.settings?.activeLayout
    $: layoutSlides = $cachedShowsData[showId]?.layout || []

    let scrollElem: any
    let offset: number = -1
    $: {
        let output = $outputs[activeOutputs[0]] || {}
        if (scrollElem && showId === output.out?.slide?.id && activeLayout === output.out?.slide?.layout) {
            let columns = $slidesOptions.mode === "grid" ? ($slidesOptions.columns > 2 ? $slidesOptions.columns : 0) : 1
            let index = Math.max(0, (output.out.slide.index || 0) - columns)
            offset = (scrollElem.querySelector(".grid")?.children[index]?.offsetTop || 5) - 5
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

    $: if (showId && currentShow) {
        // update show by its template
        history({ id: "TEMPLATE", save: false, newData: { id: currentShow.settings?.template }, location: { page: "show" } })
    }

    $: if (showId && $special.capitalize_words) capitalizeWords()
    function capitalizeWords() {
        // keep letters and spaces
        const regEx = /[^a-zA-Z\s]+/

        showsCache.update((a) => {
            let slides = a[showId]?.slides || {}
            Object.keys(slides).forEach((slideId) => {
                let slide = slides[slideId]
                slide.items.forEach((item) => {
                    if (!item.lines) return
                    item.lines.forEach((line) => {
                        line?.text.forEach((text) => {
                            let newValue = capitalize(text.value)
                            text.value = newValue
                        })
                    })
                })
            })

            return a
        })

        function capitalize(value: string) {
            $special.capitalize_words.split(",").forEach((newWord) => {
                newWord = newWord.trim().toLowerCase()

                value = value
                    .split(" ")
                    .map((word) => {
                        if (word.replace(regEx, "").toLowerCase() !== newWord) return word

                        let matching = word.toLowerCase().indexOf(newWord)
                        if (matching >= 0) {
                            let capitalized = newWord[0].toUpperCase() + newWord.slice(1)
                            word = word.slice(0, matching) + capitalized + word.slice(capitalized.length)
                        }

                        return word
                    })
                    .join(" ")
            })

            return value
        }
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

    $: activeOutputs = getActiveOutputs($outputs, false, true)

    let activeSlides: any[] = []
    $: {
        activeSlides = []
        activeOutputs.forEach((a) => {
            let currentOutput: any = $outputs[a]
            if (!currentOutput || currentOutput.stageOutput) return

            let currentStyle = $styles[currentOutput?.style || ""] || {}
            let outSlide: any = currentOutput.out?.slide || {}

            if (activeSlides[outSlide.index] || outSlide.id !== showId || outSlide.layout !== activeLayout) return

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
        if (!layoutSlides || timeout) return

        if (lazyLoader >= layoutSlides.length) {
            loaded = true
            lazyLoading = false
            return
        }

        timeout = setTimeout(() => {
            lazyLoader++
            timeout = null
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

    // store media files
    // MAX 512MB & overflows the ram quickly
    // $: if (currentShow) storeMedia()
    // let previousFiles = ""
    // function storeMedia() {
    //     if (!$special.storeShowMedia) return

    //     let files: any = []
    //     Object.keys(currentShow.media).forEach((mediaId) => {
    //         let media = currentShow.media[mediaId]
    //         if (media.type && !["image", "video", "audio"].includes(media.type)) return

    //         files.push({ id: mediaId, path: media.path })
    //     })

    //     let newFiles = JSON.stringify(files)
    //     if (previousFiles === newFiles) return

    //     previousFiles = newFiles
    //     send(MAIN, ["MEDIA_BASE64"], files)
    // }

    // receive(MAIN, {
    //     MEDIA_BASE64: (data: any[]) => {
    //         // TODO: history
    //         showsCache.update((a) => {
    //             data.forEach(({ id, content }) => {
    //                 if (!a[showId].media[id]) return
    //                 a[showId].media[id].base64 = content
    //             })

    //             return a
    //         })
    //     },
    // })
</script>

<!-- TODO: tab enter not woring -->

<svelte:window on:keydown={keydown} on:keyup={keyup} on:mousedown={keyup} />

<Autoscroll class="context #shows__close" on:wheel={wheel} {offset} bind:scrollElem style="display: flex;">
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
                </div>
            {/if}
        </DropArea>
    </DropArea>
</Autoscroll>

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        padding: 5px;
    }
</style>
