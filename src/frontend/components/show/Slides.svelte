<script lang="ts">
    import { activeFocus, activePage, activePopup, alertMessage, cachedShowsData, focusMode, lessonsLoaded, notFound, outLocked, outputs, outputSlideCache, showsCache, slidesOptions, special } from "../../stores"
    import { getAccess } from "../../utils/profile"
    import { videoExtensions } from "../../values/extensions"
    import { customActionActivation } from "../actions/actions"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { encodeFilePath, getExtension } from "../helpers/media"
    import { getActiveOutputs, refreshOut, setOutput } from "../helpers/output"
    import { getCachedShow } from "../helpers/show"
    import { checkActionTrigger, getFewestOutputLines, getFewestOutputLinesReveal, getItemWithMostLines, updateOut } from "../helpers/showActions"
    import { _show } from "../helpers/shows"
    import { getClosestRecordingSlide } from "../helpers/slideRecording"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import Loader from "../main/Loader.svelte"
    import Slide from "../slide/Slide.svelte"
    import Autoscroll from "../system/Autoscroll.svelte"
    import Center from "../system/Center.svelte"
    import DropArea from "../system/DropArea.svelte"

    export let showId: string
    export let layout = ""
    export let projectIndex = -1

    $: currentShow = $showsCache[showId]
    $: activeLayout = layout || $showsCache[showId]?.settings?.activeLayout
    $: layoutSlides = currentShow ? getCachedShow(showId, activeLayout, $cachedShowsData)?.layout || [] : []

    // fix broken media
    $: if (showId) fixBrokenMedia()
    function fixBrokenMedia() {
        if (!currentShow) return
        showsCache.update((a) => {
            Object.entries(currentShow.layouts || {}).forEach(([layoutId, layout]) => {
                layout.slides.forEach((slide, i) => {
                    let backgroundId = slide.background
                    if (backgroundId && !currentShow.media[backgroundId]) {
                        delete a[showId].layouts[layoutId].slides[i].background
                    }
                })
            })
            return a
        })
    }

    let scrollElem: HTMLElement | undefined
    let offset = -1
    $: {
        let output = $outputs[activeOutputs[0]] || {}
        if (loaded && scrollElem && showId === output.out?.slide?.id && activeLayout === output.out?.slide?.layout) {
            let columns = $slidesOptions.mode === "grid" ? ($slidesOptions.columns > 2 ? $slidesOptions.columns : 0) : 1
            let index = Math.max(0, (output.out.slide.index || 0) - columns)
            offset = ((scrollElem.querySelector(".grid")?.children[index] as HTMLElement)?.offsetTop || 5) - 5
        }
    }

    let nextScrollTimeout: NodeJS.Timeout | null = null
    let disableAutoScroll = false
    function slideClick(e: any, index: number) {
        // TODO: duplicate function of "preview:126 - updateOut"
        if ($outLocked || e.ctrlKey || e.metaKey || e.shiftKey) return

        customActionActivation("slide_click")

        let slideRef = _show(showId).layouts([activeLayout]).ref()[0]

        let data = slideRef[index]?.data
        checkActionTrigger(data, index)
        // allow custom actions to trigger first
        setTimeout(() => {
            // get line
            let outputId = getActiveOutputs($outputs, true, true, true)[0]
            let currentOutput = $outputs[outputId] || {}
            let outSlide = currentOutput.out?.slide || null
            let amountOfLinesToShow = getFewestOutputLines()
            let showSlide = _show(showId).slides([slideRef[index]?.id]).get()?.[0]
            let line = 0
            if (outSlide && outSlide.id === showId && outSlide.layout === activeLayout && outSlide.index === index && amountOfLinesToShow > 0) {
                line = (outSlide.line || 0) + amountOfLinesToShow

                let slideLines = showSlide ? getItemWithMostLines(showSlide) : 0
                // loop back to line start
                if (line >= slideLines) line = 0
            }

            // get item click reveal
            const clickRevealItems = (showSlide?.items || []).filter((a) => a.clickReveal)
            const isRevealed = clickRevealItems.length ? !!outSlide?.itemClickReveal : true
            let itemClickReveal = false
            if (outSlide && outSlide.id === showId && outSlide.layout === activeLayout && outSlide.index === index && clickRevealItems.length) {
                // WIP this does not toggle on click
                itemClickReveal = true
            }

            // get lines reveal
            const linesRevealItems = (showSlide?.items || []).filter((a) => a.lineReveal)
            let revealCount = outSlide?.revealCount ?? 0
            if (outSlide && outSlide.id === showId && outSlide.layout === activeLayout && outSlide.index === index && linesRevealItems.length && isRevealed) {
                revealCount++

                // loop back to start
                let maxLines = getItemWithMostLines({ items: linesRevealItems })
                if (revealCount > maxLines) revealCount = 0
            } else revealCount = 0

            setOutput("slide", { id: showId, layout: activeLayout, index, line, revealCount, itemClickReveal })
            updateOut(showId, index, slideRef, !e.altKey)

            getClosestRecordingSlide({ showId, layoutId: activeLayout }, index)

            // force update output if index is the same as previous
            if (activeSlides[index]) refreshOut()
        })

        // WIP focus mode does not auto scroll on arrow navigation when many slides (that overflow view area)
        // always auto scroll in focus mode (if not very many slides)
        if ($focusMode && projectIndex > -1 && index < 10) {
            activeFocus.set({ id: showId, index: projectIndex, type: "show" })
            return
        }

        // don't auto scroll if clicking with mouse!
        disableAutoScroll = true
        if (nextScrollTimeout) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
            disableAutoScroll = false
        }, 500)
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
    $: gridMode = $slidesOptions.mode === "grid" || $slidesOptions.mode === "simple" || $slidesOptions.mode === "groups"
    $: if (showId && gridMode && !isLessons && loaded) setTimeout(updateTemplate, 100)
    function updateTemplate() {
        if (!loaded) return

        let showTemplate = currentShow?.settings?.template || ""
        history({ id: "TEMPLATE", save: false, newData: { id: showTemplate }, location: { page: "show" } })
    }

    $: if (showId && $special.capitalize_words) capitalizeWords()
    function capitalizeWords() {
        // keep letters and spaces
        // const regEx = /[^a-zA-Z\s]+/

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
            $special.capitalize_words.split(",").forEach((word) => {
                let newWord = word.trim().toLowerCase()
                if (!newWord.length) return

                const regEx = new RegExp(`\\b${newWord}\\b`, "gi")
                value = value.replace(regEx, (match) => {
                    // always capitalize: newWord.charAt(0).toUpperCase() + newWord.slice(1)
                    // use the input case styling (meaning all uppercase/lowercase also works)
                    // but don't change anything if the text is already fully uppercase
                    return match === match.toUpperCase() ? match : word.trim()
                })
            })

            return value
        }
    }

    let altTimeout: NodeJS.Timeout | null = null
    let altTemp = false
    let altKeyPressed = false
    function keydown(e: KeyboardEvent) {
        if (!e.altKey && altTimeout) clearTimeout(altTimeout)

        if (e.altKey) {
            if (altTemp) return
            altTemp = true
            // e.preventDefault()

            // only activate alt preview hide after a little time (still works instantly)
            altTimeout = setTimeout(() => {
                if (altTemp && document.hasFocus()) altKeyPressed = true
            }, 300)
        }
    }
    function keyup(e) {
        if (e.altKey) return

        altTemp = false
        altKeyPressed = false
    }
    function blurred() {
        altTemp = false
        altKeyPressed = false
    }

    $: activeOutputs = getActiveOutputs($outputs, false, true)

    let activeSlides: any[] = []
    $: {
        activeSlides = []
        activeOutputs.forEach((a) => {
            let currentOutput = $outputs[a]
            if (!currentOutput || currentOutput.stageOutput) return

            // let currentStyle = $styles[currentOutput?.style || ""] || {}
            let outSlide = currentOutput.out?.slide || $outputSlideCache[a] || {}

            if (activeSlides[outSlide.index] || outSlide.id !== showId || outSlide.layout !== activeLayout) return

            let ref = outSlide?.id === "temp" ? [{ temp: true, items: outSlide.tempItems, id: "" }] : _show(outSlide.id).layouts([outSlide.layout]).ref()[0]
            let showSlide = outSlide.index !== undefined ? _show(outSlide.id).slides([ref[outSlide.index]?.id]).get()?.[0] : null

            // get progress of current line division
            // let amountOfLinesToShow: number = currentStyle.lines !== undefined ? Number(currentStyle.lines) : 0
            let amountOfLinesToShow: number = getFewestOutputLines($outputs)
            let lineIndex = 0
            let maxLines = 0
            if (amountOfLinesToShow > 0) {
                let slideLines = showSlide ? getItemWithMostLines(showSlide) : null

                maxLines = slideLines && amountOfLinesToShow < slideLines ? Math.ceil(slideLines / amountOfLinesToShow) : 0

                let outputLine = amountOfLinesToShow && outSlide ? outSlide.line || 0 : null
                let linesPercentage = slideLines && outputLine !== null ? outputLine / slideLines : 0
                lineIndex = maxLines !== null ? Math.floor(maxLines * linesPercentage) : 0

                if (!maxLines) maxLines = 1
            }

            // lines reveal
            const linesRevealItems = (showSlide?.items || []).filter((a) => a.lineReveal)
            if (linesRevealItems.length) {
                lineIndex = getFewestOutputLinesReveal($outputs) - 1
                maxLines = getItemWithMostLines({ items: linesRevealItems })
            }

            activeSlides[outSlide.index] = {
                color: $outputs[a].color,
                line: lineIndex,
                maxLines,
                cached: !currentOutput.out?.slide,
                clickRevealed: !!currentOutput.out?.slide?.itemClickReveal
            }
        })
    }

    let profile = getAccess("shows")
    $: isLocked = currentShow?.locked || profile.global === "read" || profile[currentShow?.category || ""] === "read"

    function createSlide() {
        if (isLocked) return

        history({ id: "SLIDES" })
        activePage.set("edit")
    }

    // lazy loader

    let lazyLoader = 1
    let timeout: NodeJS.Timeout | true | null = null
    let loaded = false

    // reset loading when changing view modes
    $: if (showId || activeLayout) loaded = false

    $: if (!loaded && !lazyLoading && layoutSlides?.length) {
        lazyLoading = true
        lazyLoader = 0
        startLazyLoader()
    }

    $: isLessons = currentShow?.category === "lessons"
    // let showLessonsAlert: boolean = false
    let lessonsFailed = 0
    // let currentTries: number = 0
    let lessonsTimeout: NodeJS.Timeout | null = null

    $: if (isLessons && $lessonsLoaded) startLazyLoader()

    let lazyLoading = false
    function startLazyLoader() {
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
        let isVideo = videoExtensions.includes(getExtension(src))
        let media: HTMLImageElement | HTMLVideoElement = new Image()
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

    let loading = false
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

<svelte:window on:keydown={keydown} on:keyup={keyup} on:mousedown={keyup} on:blur={blurred} />

<Autoscroll class={$focusMode || isLocked ? "" : "context #shows__close"} {offset} disabled={disableAutoScroll} bind:scrollElem style="display: flex;">
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
            {:else}
                <div class="grid">
                    {#if layoutSlides.length}
                        {#each layoutSlides as slide, i}
                            {#if (loaded || i < lazyLoader) && currentShow.slides?.[slide.id] && ($slidesOptions.mode === "grid" || $slidesOptions.mode === "groups" || !slide.disabled) && ($slidesOptions.mode !== "groups" || currentShow.slides[slide.id].group !== null || activeSlides[i] !== undefined)}
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
                                    list={!gridMode}
                                    columns={$slidesOptions.columns}
                                    icons
                                    {altKeyPressed}
                                    disableThumbnails={isLessons && !loaded}
                                    centerPreview
                                    on:click={(e) => slideClick(e, i)}
                                />
                            {/if}
                        {/each}
                    {:else}
                        <Center absolute size={2}>
                            <span style="opacity: 0.5;"><T id="empty.slides" /></span>
                            <!-- Add slides button -->
                            <Button disabled={isLocked} on:click={createSlide} style="font-size: initial;margin-top: 10px;" dark center>
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

        padding-bottom: 60px;
    }
</style>
