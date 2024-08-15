<script lang="ts">
    import { activePage, activePopup, alertMessage, focusMode, lessonsLoaded, notFound, outLocked, outputs, showsCache, slidesOptions, special, styles, videoExtensions } from "../../stores"
    import { customActionActivation } from "../actions/actions"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { encodeFilePath, getExtension } from "../helpers/media"
    import { getActiveOutputs, refreshOut, setOutput } from "../helpers/output"
    import { getCachedShow } from "../helpers/show"
    import { getItemWithMostLines, updateOut } from "../helpers/showActions"
    import { _show } from "../helpers/shows"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import Loader from "../main/Loader.svelte"
    import Slide from "../slide/Slide.svelte"
    import Autoscroll from "../system/Autoscroll.svelte"
    import Center from "../system/Center.svelte"
    import DropArea from "../system/DropArea.svelte"
    import TextEditor from "./TextEditor.svelte"

    export let showId: string
    export let layout: string = ""

    $: currentShow = $showsCache[showId]
    $: activeLayout = layout || $showsCache[showId]?.settings?.activeLayout
    $: layoutSlides = currentShow ? getCachedShow(showId, activeLayout)?.layout || [] : []

    let scrollElem: any
    let offset: number = -1
    $: {
        let output = $outputs[activeOutputs[0]] || {}
        if (loaded && scrollElem && showId === output.out?.slide?.id && activeLayout === output.out?.slide?.layout) {
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

        customActionActivation("slide_click")

        let slideRef: any = _show(showId).layouts([activeLayout]).ref()[0]
        updateOut(showId, index, slideRef, !e.altKey)

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

    // update show by its template
    $: gridMode = $slidesOptions.mode === "grid" || $slidesOptions.mode === "simple"
    $: if (showId && gridMode && !isLessons && loaded) setTimeout(updateTemplate, 100)
    function updateTemplate() {
        if (!loaded) return

        let showTemplate = currentShow?.settings?.template || ""
        history({ id: "TEMPLATE", save: false, newData: { id: showTemplate }, location: { page: "show" } })
    }

    $: if (showId && $special.capitalize_words) capitalizeWords()
    function capitalizeWords() {
        // keep letters and spaces
        const regEx = /[^a-zA-Z\s]+/

        let capitalized = false
        let slides = _show(showId).get("slides") || {}
        Object.keys(slides).forEach((slideId) => {
            let slide = slides[slideId]

            slide.items.forEach((item) => {
                if (!item.lines) return

                item.lines.forEach((line) => {
                    line?.text.forEach((text) => {
                        let newValue = capitalize(text.value)
                        if (text.value !== newValue) capitalized = true
                        text.value = newValue
                    })
                })
            })
        })

        if (!capitalized) return

        showsCache.update((a) => {
            a[showId].slides = slides
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
                            word = word.slice(0, matching) + capitalized + word.slice(matching + capitalized.length)
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
                let showSlide = outSlide.index !== undefined ? _show(outSlide.id).slides([ref[outSlide.index]?.id]).get()[0] : null
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

    function createSlide() {
        history({ id: "SLIDES" })
        activePage.set("edit")
    }

    // lazy loader

    let lazyLoader: number = 1
    let timeout: any = null
    let loaded: boolean = false

    // reset loading when changing view modes
    $: if (showId || activeLayout) loaded = false

    $: if (!loaded && !lazyLoading && layoutSlides?.length) {
        lazyLoading = true
        lazyLoader = 0
        startLazyLoader()
    }

    $: isLessons = currentShow?.category === "lessons"
    // let showLessonsAlert: boolean = false
    let lessonsFailed: number = 0
    // let currentTries: number = 0
    let lessonsTimeout: any = null

    $: if (isLessons && $lessonsLoaded) startLazyLoader()

    let lazyLoading: boolean = false
    async function startLazyLoader() {
        if (!layoutSlides || timeout) return

        if (lazyLoader >= layoutSlides.length) {
            loaded = true
            lazyLoading = false

            return
        }

        // check that media has loaded
        if (isLessons) {
            timeout = true
            if (lessonsTimeout) clearTimeout(lessonsTimeout)

            let count = $lessonsLoaded[showId]
            if (count === undefined) {
                lessonsTimeout = setTimeout(async () => {
                    // might already be done (check first slide)
                    let mediaId = layoutSlides[lazyLoader]?.background
                    let mediaPath = currentShow.media?.[mediaId]?.path || ""
                    let exists = await checkImage(mediaPath)

                    if (exists) {
                        lazyLoader = layoutSlides.length
                        loaded = true
                        lazyLoading = false

                        return
                    }

                    // could not load
                    lazyLoader++
                    lessonsFailed++
                    startLazyLoader()
                }, 800)

                timeout = null
                return
            }

            let downloaded = count.finished + count.failed

            // ensure media is loaded before initializing cache loading
            lazyLoader = downloaded
            lessonsFailed = count.failed

            if (downloaded < layoutSlides.length) {
                alertMessage.set(`Please wait! Downloading Lessons.church media ${downloaded + 1}/${layoutSlides.length} ...`)
                activePopup.set("alert")
            } else {
                if (lessonsFailed) alertMessage.set(`Something went wrong!<br>Could not get ${count.failed} files of total ${layoutSlides.length}!<br><br>The files might have expired, but you can try importing again`)
                else alertMessage.set(`Downloaded ${layoutSlides.length} files!`)
                activePopup.set("alert")

                loaded = true
                lazyLoading = false
                lessonsLoaded.set({})
            }

            timeout = null
            return
        }

        timeout = setTimeout(next, 10)

        function next() {
            lazyLoader += $focusMode ? 20 : 4
            timeout = null
            startLazyLoader()
        }
    }

    function checkImage(src: string) {
        let isVideo = $videoExtensions.includes(getExtension(src))
        let media: any = new Image()
        if (isVideo) media = document.createElement("video")

        return new Promise((resolve) => {
            if (isVideo)
                media.onloadeddata = () => {
                    resolve(true)
                }
            else media.onload = () => resolve(true)
            media.onerror = () => {
                resolve(false)
            }

            media.src = encodeFilePath(src)
        })
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

<Autoscroll class={$focusMode || currentShow?.locked ? "" : "context #shows__close"} on:wheel={wheel} {offset} bind:scrollElem style="display: flex;">
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
                                    {showId}
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
                                    disableThumbnails={isLessons && !loaded}
                                    on:click={(e) => slideClick(e, i)}
                                />
                            {/if}
                        {/each}
                    {:else}
                        <Center absolute size={2}>
                            <span style="opacity: 0.5;"><T id="empty.slides" /></span>
                            <!-- Add slides button -->
                            <Button on:click={createSlide} style="font-size: initial;margin-top: 10px;" dark center>
                                <Icon id="add" right />
                                <T id="new.slide" />
                            </Button>
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
