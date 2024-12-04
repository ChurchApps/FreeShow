import { get } from "svelte/store"
import { MAIN, OUTPUT } from "../../../types/Channels"
import type { OutSlide, Slide } from "../../../types/Show"
import { send } from "../../utils/request"
import { runAction, slideHasAction } from "../actions/actions"
import type { API_output_style } from "../actions/api"
import { playPauseGlobal } from "../drawer/timers/timers"
import { clearOverlays, clearTimers } from "../output/clear"
import {
    timers,
    activeEdit,
    activeFocus,
    activePage,
    activeProject,
    activeShow,
    allOutputs,
    audioStreams,
    currentWindow,
    driveData,
    focusMode,
    media,
    midiIn,
    outLocked,
    outputSlideCache,
    outputs,
    overlays,
    projects,
    showsCache,
    slideTimers,
    special,
    stageShows,
    styles,
    templates,
    triggers,
    videosData,
    videosTime,
} from "./../../stores"
import { clone } from "./array"
import { clearAudio, playAudio, startMicrophone } from "./audio"
import { getExtension, getFileName, getMediaStyle, getMediaType, removeExtension } from "./media"
import { getActiveOutputs, refreshOut, setOutput } from "./output"
import { loadShows } from "./setShow"
import { initializeMetadata } from "./show"
import { _show } from "./shows"
import { addZero, joinTime, secondsToTime } from "./time"
import { stopTimers } from "./timerTick"

const getProjectIndex: any = {
    next: (index: number | null, shows: any) => {
        // change active show in project
        if (index === null) return 0
        index = shows.findIndex((_a: any, i: number) => i - 1 === index)
        return index === null || index < 0 ? null : index
    },
    previous: (index: number | null, shows: any) => {
        // change active show in project
        if (index === null) return shows.length - 1
        index = shows.findIndex((_a: any, i: number) => i + 1 === index)
        return index === null || index < 0 ? null : index
    },
}

export function checkInput(e: any) {
    if (e.target?.closest(".edit") || e.ctrlKey || e.metaKey) return
    // TODO: combine with ShowButton.svelte click()

    if (!["ArrowDown", "ArrowUp"].includes(e.key)) return
    if (get(activeProject) === null) return
    e.preventDefault()
    ;(document.activeElement as any)?.blur()

    const selectItem: "next" | "previous" = e.key === "ArrowDown" ? "next" : "previous"
    selectProjectShow(selectItem)
}

export function selectProjectShow(select: number | "next" | "previous") {
    const shows = get(projects)[get(activeProject) || ""]?.shows
    const index: null | number = (get(focusMode) ? get(activeFocus).index : get(activeShow)?.index) ?? null
    const newIndex: number | null = typeof select === "number" ? select : getProjectIndex[select](index, shows)

    if (newIndex === null || !shows[newIndex]) return

    // show
    if (!get(focusMode) && (shows[newIndex].type || "show") === "show") {
        // async waiting for show to load
        setTimeout(async () => {
            // preload show (so the layout can be changed)
            await loadShows([shows[newIndex!].id])
            if (get(showsCache)[shows[newIndex!].id]) swichProjectItem(newIndex!, shows[newIndex!].id)
        })
    }

    // set active show in project list
    if (newIndex !== index) {
        if (get(focusMode)) activeFocus.set({ id: shows[newIndex]?.id, index: newIndex })
        else activeShow.set({ ...shows[newIndex], index: newIndex })
    }
}

export function swichProjectItem(pos: number, id: string) {
    if (!get(showsCache)[id]?.layouts) return
    let projectLayout: string = get(projects)[get(activeProject)!].shows[pos!].layout || ""

    // set active layout from project if it exists
    if (projectLayout) {
        if (!get(showsCache)[id].layouts[projectLayout]) projectLayout = Object.keys(get(showsCache)[id].layouts)[0]
        showsCache.update((a) => {
            a[id].settings.activeLayout = projectLayout
            return a
        })
    }

    // set project layout
    projects.update((a) => {
        if (Object.keys(get(showsCache)[id].layouts).length < 2) delete a[get(activeProject)!].shows[pos!].layout
        else a[get(activeProject)!].shows[pos!].layout = get(showsCache)[id].settings.activeLayout
        return a
    })
}

export function getItemWithMostLines(slide: Slide) {
    let amount = 0
    slide.items?.forEach((item) => {
        console.log(item.lines)
        const lines: number = item.lines?.filter((a) => a.text.filter((a) => a.value.length)?.length)?.length || 0
        if (lines > amount) amount = lines
    })
    return amount
}

// TODO: multiple outputs with different lines!
function getOutputWithLines() {
    const outs = getActiveOutputs()

    let currentLines = 0
    outs.forEach((id: string) => {
        const output = get(outputs)[id]
        if (!output.style) return

        const style = get(styles)[output.style]
        if (!style) return
        const lines = style.lines
        if (!lines) return

        if (lines > currentLines) currentLines = lines
    })

    return Number(currentLines)
}

const PRESENTATION_KEYS_NEXT = [" ", "ArrowRight", "PageDown"]
const PRESENTATION_KEYS_PREV = ["ArrowLeft", "PageUp"]

// this will go to next for each slide (better for multiple outputs with "Specific outputs")
export function nextSlideIndividual(e: any, start = false, end = false) {
    getActiveOutputs().forEach((id) => nextSlide(e, start, end, false, false, id))
}

export function nextSlide(e: any, start = false, end = false, loop = false, bypassLock = false, customOutputId = "", nextAfterMedia = false) {
    if (get(outLocked) && !bypassLock) return
    if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

    const outputId = customOutputId || getActiveOutputs()[0]
    const currentOutput: any = get(outputs)[outputId] || {}
    let slide: null | OutSlide = currentOutput.out?.slide || null
    if (!slide) {
        const cachedSlide: null | OutSlide = get(outputSlideCache)[outputId] || null
        if (cachedSlide && cachedSlide?.id === get(activeShow)?.id && cachedSlide?.layout === get(showsCache)[get(activeShow)?.id || ""]?.settings?.activeLayout) slide = cachedSlide
    }

    // PPT
    if (slide?.type === "ppt") {
        send(MAIN, ["PRESENTATION_CONTROL"], {
            action: e?.key === "PageDown" ? "last" : "next",
        })
        return
    }

    // PDF
    if (((!slide || start) && get(activeShow)?.type === "pdf") || (!start && slide?.type === "pdf")) {
        if (start && slide?.id !== get(activeShow)?.id) slide = null
        const nextPage = slide?.page !== undefined ? slide.page + 1 : 0
        playPdf(slide, nextPage)
        return
    }

    // let layout: SlideData[] = GetLayout(slide ? slide.id : null, slide ? slide.layout : null)
    let layout: any[] = _show(slide ? slide.id : "active")
        .layouts(slide ? [slide.layout] : "active")
        .ref()[0]
    const slideIndex: number = slide?.index || 0
    let isLastSlide: boolean = layout && slide ? slideIndex >= layout.filter((a, i) => i < slideIndex || !a?.data?.disabled).length - 1 && !layout[slideIndex].end : false

    let index: null | number = null

    // lines
    const amountOfLinesToShow: number = getOutputWithLines() ? getOutputWithLines() : 0
    const linesIndex: null | number = amountOfLinesToShow && slide ? slide.line || 0 : null
    const showSlide: any = slide?.index !== undefined ? _show(slide.id).slides([layout?.[slideIndex]?.id]).get()[0] : null
    const slideLines: null | number = showSlide ? getItemWithMostLines(showSlide) : null
    const currentLineStart: number = slideLines ? slideLines - (amountOfLinesToShow! % slideLines) : 0
    const hasLinesEnded: boolean = slideLines === null || linesIndex === null ? true : slideLines <= amountOfLinesToShow || amountOfLinesToShow! * linesIndex >= currentLineStart
    if (isLastSlide && !hasLinesEnded) isLastSlide = false

    // TODO: active show slide index on delete......

    // go to first slide in next project show ("Next after media" feature)
    const isNotLooping = loop && slide?.index !== undefined && !layout?.[slideIndex]?.data?.end
    if ((isNotLooping || nextAfterMedia) && bypassLock && slide && isLastSlide) {
        // check if it is last slide (& that slide does not loop to start)
        goToNextShowInProject(slide, customOutputId)
        return
    }

    // go to beginning if live mode & ctrl | no output | last slide active
    const currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
    if (currentShow && (start || !slide || e?.ctrlKey || (isLastSlide && (currentShow.id !== slide?.id || get(showsCache)[currentShow.id]?.settings.activeLayout !== slide.layout)))) {
        if (get(activeShow)?.type === "section" || !get(showsCache)[currentShow.id]) return goToNextProjectItem()

        const id = loop ? slide?.id : currentShow.id
        if (!id) return

        // layout = GetLayout()
        layout = _show(id).layouts("active").ref()[0]
        if (!layout?.filter((a) => !a.data.disabled).length) return

        index = 0
        while (layout[index].data.disabled || notBound(layout[index], customOutputId)) index++

        setOutput("slide", { id, layout: _show(id).get("settings.activeLayout"), index }, false, customOutputId)
        updateOut(id, index, layout, !e?.altKey, customOutputId)
        return
    }

    if (!slide || slide.id === "temp") return

    const newSlideOut: any = { ...slide, line: 0 }
    if (!hasLinesEnded) {
        index = slideIndex
        newSlideOut.line = linesIndex! + 1
    } else {
        // TODO: Check for loop to beginning slide...
        index = getNextEnabled(slideIndex, end, customOutputId)
    }
    newSlideOut.index = index

    // go to next show if end
    if (index === null && currentShow?.id === slide?.id && get(showsCache)[currentShow?.id || ""]?.settings.activeLayout === slide.layout) {
        if (PRESENTATION_KEYS_NEXT.includes(e?.key)) goToNextProjectItem(e.key)
        return
    }

    if (index !== null) {
        setOutput("slide", newSlideOut, false, customOutputId)
        updateOut(slide ? slide.id : "active", index, layout, !e?.altKey, customOutputId)
    }
}

async function goToNextShowInProject(slide, customOutputId) {
    if (!get(activeProject)) return

    // get current project show
    const currentProject = get(projects)[get(activeProject)!]
    // this will get the first show in the project with this id, so it won't work properly with multiple of the same shows in a project
    const projectIndex = currentProject.shows.findIndex((a) => a.id === slide!.id)
    if (projectIndex < 0) return

    const currentOutputProjectShowIndex = currentProject.shows[projectIndex]
    if (currentOutputProjectShowIndex.id !== slide.id) return

    const nextShowInProjectIndex = currentProject.shows.findIndex((a, i) => i > projectIndex && (a.type || "show") === "show")
    if (nextShowInProjectIndex < 0) return

    const nextShow = currentProject.shows[nextShowInProjectIndex]
    await loadShows([nextShow.id])
    const activeLayout = nextShow.layout || _show(nextShow.id).get("settings.activeLayout")
    const layout: any[] = _show(nextShow.id).layouts([activeLayout]).ref()[0]

    // let hasNextAfterMediaAction = layout[slide.index].data.actions?.nextAfterMedia
    // if (!hasNextAfterMediaAction) return

    setOutput("slide", { id: nextShow.id, layout: activeLayout, index: 0 }, false, customOutputId)
    updateOut(nextShow.id, 0, layout, true, customOutputId)

    // open next item in project (if current is open)
    if (get(activeShow)?.index === projectIndex) {
        if (get(focusMode)) activeFocus.set({ id: nextShow.id, index: nextShowInProjectIndex })
        else activeShow.set({ ...nextShow, index: nextShowInProjectIndex })
    }
}

// only let "first" output change project item if multiple outputs
let changeProjectItemTimeout: any = null

export function goToNextProjectItem(key = "") {
    if (changeProjectItemTimeout) return
    changeProjectItemTimeout = setTimeout(() => {
        changeProjectItemTimeout = null

        const currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
        if (!get(activeProject) || typeof currentShow?.index !== "number") return

        let index: number = currentShow.index ?? -1
        if (index + 1 < get(projects)[get(activeProject)!].shows.length) index++
        if (index > -1 && index !== currentShow.index) {
            const newShow = get(projects)[get(activeProject)!].shows[index]
            if (get(focusMode)) activeFocus.set({ id: newShow.id, index })
            else activeShow.set({ ...newShow, index })

            if (newShow.type === "section" && PRESENTATION_KEYS_NEXT.includes(key) && get(special).sectionTriggerAction) {
                runAction(get(midiIn)[get(special).sectionTriggerAction])
                return
            }

            // skip if section is empty
            if (newShow.type === "section" && !newShow.notes) goToNextProjectItem()
        }
    })
}

export function goToPreviousProjectItem(key = "") {
    if (changeProjectItemTimeout) return
    changeProjectItemTimeout = setTimeout(() => {
        changeProjectItemTimeout = null

        const currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
        if (!get(activeProject) || typeof currentShow?.index !== "number") return

        let index: number = currentShow.index ?? get(projects)[get(activeProject)!].shows.length
        if (index - 1 >= 0) index--
        if (index > -1 && index !== currentShow.index) {
            const newShow = get(projects)[get(activeProject)!].shows[index]
            if (get(focusMode)) activeFocus.set({ id: newShow.id, index })
            else activeShow.set({ ...newShow, index })

            if (newShow.type === "section" && PRESENTATION_KEYS_PREV.includes(key) && get(special).sectionTriggerAction) {
                runAction(get(midiIn)[get(special).sectionTriggerAction])
                return
            }

            // skip if section is empty
            if (newShow.type === "section" && !newShow.notes) goToPreviousProjectItem()
        }
    })
}

// this will go to next for each slide (better for multiple outputs with "Specific outputs")
export function previousSlideIndividual(e: any) {
    getActiveOutputs().forEach((id) => previousSlide(e, id))
}

export function previousSlide(e: any, customOutputId?: string) {
    if (get(outLocked)) return
    if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

    const outputId = customOutputId || getActiveOutputs()[0]
    const currentOutput: any = get(outputs)[outputId] || {}
    let slide: null | OutSlide = currentOutput.out?.slide || null
    if (!slide) {
        const cachedSlide: null | OutSlide = get(outputSlideCache)[outputId] || null
        if (cachedSlide && cachedSlide?.id === get(activeShow)?.id && cachedSlide?.layout === get(showsCache)[get(activeShow)?.id || ""]?.settings?.activeLayout) slide = cachedSlide
    }

    // PPT
    if (slide?.type === "ppt") {
        send(MAIN, ["PRESENTATION_CONTROL"], {
            action: e?.key === "PageUp" ? "first" : "previous",
        })
        return
    }

    // PDF
    if ((!slide && get(activeShow)?.type === "pdf") || slide?.type === "pdf") {
        const nextPage = slide?.page ? slide.page - 1 : 0
        playPdf(slide, nextPage)
        return
    }

    // let layout: SlideData[] = GetLayout(slide ? slide.id : null, slide ? slide.layout : null)
    let layout: any[] = _show(slide ? slide.id : "active")
        .layouts(slide ? [slide.layout] : "active")
        .ref()[0]
    let activeLayout: string = _show(slide ? slide.id : "active").get("settings.activeLayout")
    const currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
    let index: number | null = slide?.index !== undefined ? slide.index - 1 : layout ? layout.length - 1 : null
    if (index === null) {
        if (get(activeShow)?.type === "section" || !get(showsCache)[currentShow?.id || ""]) goToPreviousProjectItem()
        return
    }

    const activeShowLayout = get(showsCache)[currentShow?.id || ""]?.settings?.activeLayout
    if (index < 0 && activeShowLayout !== slide?.layout) {
        slide = null
        layout = _show("active").layouts("active").ref()[0]
        activeLayout = activeShowLayout
        index = (layout?.length || 0) - 1
    }

    // lines
    const outputWithLines = getOutputWithLines()
    const amountOfLinesToShow: number = outputWithLines ? outputWithLines : 0
    const linesIndex: null | number = amountOfLinesToShow && slide ? slide.line || 0 : null
    const hasLinesEnded: boolean = !slide || linesIndex === null || linesIndex < 1

    // skip disabled slides if clicking previous when another show is selected and no enabled slide is before
    let isFirstSlide: boolean = slide && layout ? layout.filter((a) => !a?.data?.disabled).findIndex((a) => a.layoutIndex === slide?.index) === 0 : false
    if (!hasLinesEnded && isFirstSlide) isFirstSlide = false
    if (isFirstSlide && activeShowLayout !== slide?.layout) {
        slide = null
        layout = _show("active").layouts("active").ref()[0]
        activeLayout = activeShowLayout
        index = (layout?.length || 0) - 1
    }

    let line: number = linesIndex || 0
    if (hasLinesEnded) {
        if (index < 0 || !layout.slice(0, index + 1).filter((a) => !a.data.disabled).length) {
            // go to previous show if out slide at start
            if ((currentShow?.id === slide?.id && activeShowLayout === slide?.layout) || get(activeShow)?.type === "section" || !get(showsCache)[currentShow?.id || ""]) {
                if (PRESENTATION_KEYS_PREV.includes(e?.key)) goToPreviousProjectItem(e.key)
            }
            return
        }

        while (layout[index].data.disabled || notBound(layout[index], customOutputId)) index--

        // get slide line
        const showSlide: any = _show(slide ? slide.id : "active")
            .slides([layout[index].id])
            .get()[0]
        const slideLines: null | number = showSlide ? getItemWithMostLines(showSlide) : null
        if (amountOfLinesToShow) line = slideLines ? Math.ceil(slideLines / amountOfLinesToShow) - 1 : 0
    } else {
        index = slide!.index!
        line--
    }

    if (slide) setOutput("slide", { ...slide, index, line }, false, customOutputId)
    else if (currentShow) setOutput("slide", { id: currentShow.id, layout: activeLayout, index }, false, customOutputId)

    updateOut(slide ? slide.id : "active", index, layout, !e?.altKey, customOutputId)
}

// skip slides that are bound to specific output not customId
function notBound(ref, outputId: string | undefined) {
    return outputId && ref.data.bindings?.length && !ref.data.bindings.includes(outputId)
}

function playPdf(slide: null | OutSlide, nextPage: number) {
    const viewports = get(activeShow)?.data?.viewports || []
    const pages = slide?.pages || viewports.length
    if (nextPage > pages - 1) return

    const data = slide || get(activeShow)
    const name = data?.name || get(projects)[get(activeProject) || ""]?.shows[get(activeShow)?.index || 0]?.name

    setOutput("slide", {
        type: "pdf",
        id: data?.id,
        page: nextPage,
        pages,
        viewport: slide?.viewport || viewports[nextPage],
        name,
    })
}

function getNextEnabled(index: null | number, end = false, customOutputId = ""): null | number {
    if (index === null || isNaN(index)) return null

    index++

    const outputId = customOutputId || getActiveOutputs()[0]
    const currentOutput: any = get(outputs)[outputId] || {}
    const slide: null | OutSlide = currentOutput.out?.slide || null
    const layout: any[] = _show(slide ? slide.id : "active")
        .layouts(slide ? [slide.layout] : "active")
        .ref()[0]

    if (layout[index - 1]?.data.end) index = 0
    if (!layout[index]) return null
    if (index >= layout.length || !layout.slice(index, layout.length).filter((a) => !a.data.disabled).length) return null

    while ((layout[index].data.disabled || notBound(layout[index], customOutputId)) && index < layout.length) index++

    if (end) {
        index = layout.length - 1
        while ((layout[index].data.disabled || notBound(layout[index], customOutputId)) && index > 0) index--
    }

    return index
}

// go to random slide in current project
export function randomSlide() {
    if (get(outLocked)) return
    if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

    const outputId = getActiveOutputs()[0]
    const currentOutput: any = get(outputs)[outputId] || {}
    const slide: null | OutSlide = currentOutput.out?.slide || null
    const currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
    const showId = slide?.id || currentShow?.id
    if (!showId) return

    const layout: any[] = _show(showId)
        .layouts(slide ? [slide.layout] : "active")
        .ref()[0]

    const slideCount = layout.length || 0
    if (slideCount < 2) return

    const currentSlideIndex = slide?.index ?? -1

    // get new random index that is not the currently selected one
    let randomIndex = -1
    do {
        randomIndex = randomNumber(slideCount)
    } while (randomIndex === currentSlideIndex)

    // play slide
    setOutput(
        "slide",
        {
            id: showId,
            layout: _show(showId).get("settings.activeLayout"),
            index: randomIndex,
        },
        false
    )
    updateOut(showId, currentSlideIndex, layout)
}
function randomNumber(end: number) {
    return Math.floor(Math.random() * end)
}

export function updateOut(showId: string, index: number, layout: any, extra = true, outputId = "", actionTimeout = 10) {
    if (get(activePage) !== "edit") activeEdit.set({ slide: index, items: [] })

    _show(showId).set({ key: "timestamps.used", value: new Date().getTime() })
    if (!layout) return
    const data = layout[index]?.data

    // holding "alt" key will disable all extra features
    if (!extra || !data) return

    // trigger start show action first
    const startShowId = data.actions?.startShow?.id || data.actions?.slideActions?.actionValues?.start_show?.id
    if (startShowId) {
        startShow(startShowId)
        return
    }

    // get output slide
    const outputIds = outputId ? [outputId] : data.bindings?.length ? data.bindings : getActiveOutputs()

    // WIP custom next slide timer duration (has to be changed on slide click & in preview as well)
    // let outputWithLine = outputIds.find((id: string) => get(outputs)[id].out?.slide?.line !== undefined)
    // let outSlide: any = get(outputs)[outputWithLine]?.out?.slide || {}
    // let showSlide = outSlide.index !== undefined ? _show(outSlide.id).slides([layout[index].id]).get()[0] : null
    // let slideLines = showSlide ? getItemWithMostLines(showSlide) : null
    // let outputWithLines = getOutputWithLines() || 0
    // let maxLines = slideLines && outSlide.index !== null ? (outputWithLines >= slideLines ? 0 : Math.ceil(slideLines / outputWithLines)) : 0
    const duration = data.nextTimer
    // if (maxLines) duration /= maxLines

    // find any selected output with no lines
    const outputAtLine = outputIds.find((id: string) => get(outputs)[id].out?.slide?.line)
    // actions will only trigger on index 0 if multiple lines
    if (outputAtLine) {
        // restart any next slide timers
        outputIds.map(nextSlideTimers)
        return
    }

    outputIds.map(activateActions)

    function activateActions(outputId: string) {
        let background = data.background

        // get ghost background
        if (!background) {
            layout.forEach((a, i) => {
                if (i <= index && !a.data.disabled) {
                    if (slideHasAction(a.data?.actions, "clear_background")) background = null
                    else if (a.data.background) background = a.data.background
                    if (a.data.background && _show(showId).get("media")[a.data.background]?.loop === false) background = null
                }
            })
        }

        // background
        if (background && _show(showId).get("media")[background]) {
            const bg = _show(showId).get("media")[background]
            const outputBg = get(outputs)[outputId]?.out?.background
            const cloudId = get(driveData).mediaId
            const bgPath = cloudId && cloudId !== "default" ? bg.cloud?.[cloudId] || bg.path || bg.id : bg.path || bg.id
            const name = bg.name || removeExtension(getFileName(bgPath))
            const extension = getExtension(bgPath)
            const type = bg.type || getMediaType(extension)

            // get stored media files
            // if (get(special).storeShowMedia && bg.base64) {
            //     bgPath = `data:${type}/${extension};base64,${bg.base64}`
            // }

            if (bg && bgPath !== outputBg?.path) {
                const mediaStyle = getMediaStyle(get(media)[bgPath], { name: "" })
                const bgData: any = {
                    name,
                    type,
                    path: bgPath,
                    cameraGroup: bg.cameraGroup || "",
                    id: bg.id || bgPath, // path = cameras
                    muted: bg.muted !== false,
                    loop: bg.loop !== false,
                    ...mediaStyle,
                }

                // outBackground.set(bgData)
                setOutput("background", bgData, false, outputId)
            }
        }

        // mics
        if (data.mics) {
            data.mics.forEach((mic: any) => {
                // setTimeout(() => {
                //     setMicState.set({ id: mic.id, muted: false })
                // }, 10 * i)
                startMicrophone(mic)
            })
        }

        // audio
        if (data.audio) {
            // let clear action trigger first
            setTimeout(() => {
                data.audio.forEach((audio: string) => {
                    const a = clone(_show(showId).get("media")[audio])
                    const cloudId = get(driveData).mediaId
                    if (cloudId && cloudId !== "default") a.path = a.cloud?.[cloudId] || a.path

                    if (a) playAudio(a, false)
                })
            }, 200)
        }

        // overlays
        if (data.overlays?.length) {
            // send overlays again, because it sometimes don't have it for some reason
            send(OUTPUT, ["OVERLAYS"], get(overlays))

            setOutput("overlays", data.overlays, false, outputId, true)
        }

        // nextTimer
        nextSlideTimers(outputId)

        // DEPRECATED since <= 1.1.6, but still in use
        // actions per output
        if (data.actions) {
            if (data.actions.clearBackground) setOutput("background", null, false, outputId)
            if (data.actions.clearOverlays) clearOverlays(outputId)
        }
    }

    // actions
    // DEPRECATED since <= 1.1.6, but still in use
    if (data.actions) {
        // clear first
        if (data.actions.stopTimers) stopTimers()
        if (data.actions.clearAudio) clearAudio()

        // startShow is at the top
        if (data.actions.trigger) activateTrigger(data.actions.trigger)
        if (data.actions.audioStream) startAudioStream(data.actions.audioStream)
        // if (data.actions.sendMidi) sendMidi(_show(showId).get("midi")[data.actions.sendMidi])
        // if (data.actions.nextAfterMedia) // go to next when video/audio is finished
        if (data.actions.outputStyle) changeOutputStyle(data.actions)
        if (data.actions.startTimer)
            playSlideTimers({
                showId: showId,
                slideId: layout[index].id,
                overlayIds: data.overlays,
            })
    }

    if (data.actions?.slideActions?.length) {
        // let values update
        setTimeout(() => {
            playSlideActions(data.actions.slideActions, outputIds, index)
        }, actionTimeout)
    } else playOutputStyleTemplateActions(outputIds)

    function nextSlideTimers(outputId) {
        // clear any active slide timers
        Object.keys(get(slideTimers)).forEach((id) => {
            if (outputIds.includes(id)) get(slideTimers)[id].timer?.clear()
        })

        if ((duration || 0) > 0) {
            // outTransition.set({ duration })
            setOutput("transition", { duration }, false, outputId)
        } else {
            clearTimers(outputId)
        }
    }
}

const runPerOutput = ["clear_background", "clear_overlays"]
function playSlideActions(actions: any[], outputIds: string[] = [], slideIndex = -1) {
    actions = clone(actions)

    // run these actions on each active output
    if (outputIds.length > 1) {
        runPerOutput.forEach((id) => {
            const existingIndex = actions.findIndex((a) => a.triggers?.[0] === id)
            if (existingIndex < 0) return

            outputIds.forEach((outputId) => {
                if (id.includes("background")) setOutput("background", null, false, outputId)
                else if (id.includes("overlays")) clearOverlays(outputId)
            })
            actions.splice(existingIndex, 1)
        })
    }

    actions.forEach((a) => runAction(a, { slideIndex }))

    playOutputStyleTemplateActions(outputIds)
}

// play any output style template actions
function playOutputStyleTemplateActions(outputIds: string[]) {
    outputIds.forEach((outputId) => {
        const outputStyleId = get(outputs)[outputId]?.style || ""
        if (!outputStyleId) return

        const styleTemplateId = get(styles)[outputStyleId]?.template || ""
        if (!styleTemplateId) return

        const templateSettings = get(templates)[styleTemplateId]?.settings?.actions || []
        if (!templateSettings?.length) return

        templateSettings?.forEach((action) => runAction(action))
    })
}

export function startShowSync(showId: string) {
    startShow(showId)
}

export async function startShow(showId: string) {
    if (!showId) return

    const show = await loadShows([showId])
    if (show !== "loaded") return

    if (!get(showsCache)[showId]) return
    const activeLayout = get(showsCache)[showId].settings?.activeLayout || ""

    // slideClick() - Slides.svelte
    const slideRef: any = _show(showId).layouts("active").ref()[0]
    if (!slideRef[0]) return

    setOutput("slide", { id: showId, layout: activeLayout, index: 0, line: 0 })
    // timeout has to be 1200 to let output data update properly (in case slide has special actions)
    updateOut(showId, 0, slideRef, true, "", 1200)
}

export function changeOutputStyle({ outputStyle, styleOutputs }: API_output_style) {
    const type = styleOutputs?.type || "active"
    const outputsList = styleOutputs?.outputs || []

    const chosenOutputs = getActiveOutputs(get(outputs), type === "active")
    chosenOutputs.forEach(changeStyle)

    function changeStyle(outputId: string) {
        if (type === "specific") outputStyle = outputsList[outputId]
        if (!outputStyle) return

        outputs.update((a) => {
            a[outputId].style = outputStyle

            return a
        })
    }

    refreshOut()
}

export function playNextGroup(globalGroupIds: string[], { showRef, outSlide, currentShowId }, extra = true) {
    if (!globalGroupIds.length || get(outLocked)) return

    // play first matching group
    let nextAfterOutput = undefined
    let index = undefined
    showRef.forEach((ref) => {
        // if (ref.id !== slideId) return
        if (!globalGroupIds.includes(ref.id)) return

        // get next slide if global group is outputted
        if (index === undefined) index = ref.layoutIndex
        if (outSlide?.index === undefined || nextAfterOutput || ref.layoutIndex <= outSlide.index) return

        nextAfterOutput = ref.layoutIndex
    })

    if (nextAfterOutput) index = nextAfterOutput
    if (index === undefined) return

    // WIP duplicate of "slideClick" in Slides.svelte
    updateOut(currentShowId, index, showRef, extra)
    setOutput("slide", {
        id: currentShowId,
        layout: _show(currentShowId).get("settings.activeLayout"),
        index,
        line: 0,
    })

    setTimeout(() => {
        // defocus search input
        ;(document.activeElement as any)?.blur()
    }, 10)

    return true
}

// go to next slide if current output slide has nextAfterMedia action
let nextActive = false
export function checkNextAfterMedia(endedId: string, type: "media" | "audio" | "timer" = "media", outputId = "") {
    if (nextActive) return false

    nextActive = true
    setTimeout(() => {
        nextActive = false
    }, 600) // MAKE SURE NEXT SLIDE HAS TRANSITIONED

    if (!outputId) outputId = getActiveOutputs(get(outputs), true, true, true)[0]
    if (!outputId) return false

    const currentOutput: any = get(outputs)[outputId]
    if (!currentOutput) return false

    const slideOut = currentOutput.out?.slide
    if (!slideOut) return false

    const layoutSlide = _show(slideOut.id).layouts([slideOut.layout]).ref()[0]?.[slideOut.index]
    if (!layoutSlide) return false

    // check that current slide has the ended media!
    if (type === "media" || type === "audio") {
        const showMedia = _show(slideOut.id).media().get()
        // find all matching paths because some slides with same background might have different media ids
        const allMediaIds = showMedia.filter((a) => a.path === endedId).map((a) => a.key)

        // don't go to next if current slide don't has outputted media
        if (type === "media") {
            if (!allMediaIds.includes(layoutSlide.data?.background)) return false
        } else if (type === "audio") {
            if (!layoutSlide.data?.audio?.find((id) => allMediaIds.includes(id))) return false
        }
    } else if (type === "timer") {
        const slide = _show(slideOut.id).get("slides")[layoutSlide.id]
        const slideTimer = slide?.items?.find((a) => a.type === "timer" && a.timerId === endedId)
        if (!slideTimer) return false
    }

    const nextAfterMedia = layoutSlide?.data?.actions?.nextAfterMedia
    if (!nextAfterMedia) return false

    // WIP PAUSE PLAYING VIDEO WHEN ENDED, so it does not loop to start
    const loop = layoutSlide?.data?.end
    nextSlide(null, false, false, loop, true, outputId, !loop)

    return true
}

export function playSlideTimers({ showId = "active", slideId = "", overlayIds = [] }) {
    if (!slideId) {
        const outputRef: any = get(outputs)[getActiveOutputs()[0]]?.out?.slide || {}
        showId = outputRef.id

        const layoutRef = _show(showId).layouts([outputRef.layout]).ref()[0]
        slideId = layoutRef[outputRef.index]?.id || ""
    }

    const showSlides: any = _show(showId).get("slides") || {}
    const slide = showSlides[slideId]
    if (!slide) return

    // find all timers in current slide & any overlay placed on the slide
    const slideItems = slide.items || []
    const allOverlayItems = overlayIds.flatMap((id: string) => get(overlays)[id]?.items)
    const items = [...slideItems, ...allOverlayItems]

    items.forEach((item) => {
        if (item.type === "timer" && item.timerId) playPauseGlobal(item.timerId, get(timers)[item.timerId], true)
    })
}

export function sendMidi(data: any) {
    send(MAIN, ["SEND_MIDI"], data)
}

export function activateTriggerSync(triggerId: string) {
    activateTrigger(triggerId)
}

export async function activateTrigger(triggerId: string): Promise<string> {
    const trigger = get(triggers)[triggerId]
    if (!trigger) return ""

    if (!customTriggers[trigger.type]) {
        console.log("Missing trigger:", trigger.type)
        return "error"
    }

    return customTriggers[trigger.type](trigger.value)
}

const customTriggers = {
    http: (value: string) => {
        return new Promise((resolve) => {
            fetch(value, { method: "GET" })
                .then((r) => {
                    if (!r.ok) return resolve("error")
                    resolve("success")
                })
                // .then((response) => response.json())
                // .then((json) => console.log(json))
                .catch((err) => {
                    console.error("Could not send HTTP request:", err)
                    resolve("error")
                })
        })
    },
}

export function startAudioStream(stream) {
    const url = stream.value || get(audioStreams)[stream.id]?.value

    playAudio({ path: url, name: stream.name })
}

// DYNAMIC VALUES

export const dynamicValueText = (id: string) => `{${id}}`
export function getDynamicIds() {
    const mainValues = Object.keys(dynamicValues)
    const metaValues = Object.keys(initializeMetadata({})).map((id) => `meta_` + id)

    return [...mainValues, ...metaValues]
}

export function replaceDynamicValues(text: string, { showId, layoutId, slideIndex, type, id }: any, _updater = 0) {
    if (type === "stage" && get(currentWindow) === "output") {
        const outputId = Object.values(get(outputs))[0]?.stageOutput || ""
        const outSlide = get(allOutputs)[outputId]?.out?.slide
        showId = outSlide?.id
        slideIndex = outSlide?.index
    } else if (type === "stage") {
        const stageOutput = get(stageShows)[id]?.settings?.output
        const outputId = stageOutput || getActiveOutputs(get(outputs), false, true, true)[0]
        const outSlide = get(outputs)[outputId]?.out?.slide
        showId = outSlide?.id
        slideIndex = outSlide?.index
    }

    const show = _show(showId).get()
    if (!show) return text

    getDynamicIds().forEach((id) => {
        if (!text.includes(dynamicValueText(id))) return

        const newValue = getDynamicValue(id, show)
        text = text.replaceAll(dynamicValueText(id), newValue)
    })

    return text

    function getDynamicValue(id, show) {
        if (id.includes("meta_")) {
            const key = id.slice(5)
            return show.meta[key] || ""
        }

        const outputId: string = getActiveOutputs()[0]

        if (id.includes("video_") && get(currentWindow) === "output") {
            send(OUTPUT, ["MAIN_REQUEST_VIDEO_DATA"], { id: outputId })
        }

        const activeLayout = layoutId ? [layoutId] : "active"
        const ref = _show(showId).layouts(activeLayout).ref()[0]
        const layout = _show(showId).layouts(activeLayout).get()[0]

        const videoTime: number = get(videosTime)[outputId] || 0
        const videoDuration: number = get(videosData)[outputId]?.duration || 0

        return dynamicValues[id]({
            show,
            ref,
            slideIndex,
            layout,
            videoTime,
            videoDuration,
        })
    }
}

const dynamicValues = {
    // time
    time_date: () => addZero(new Date().getDate()),
    time_month: () => addZero(new Date().getMonth() + 1),
    time_year: () => new Date().getFullYear(),
    time_hours: () => addZero(new Date().getHours()),
    time_minutes: () => addZero(new Date().getMinutes()),
    time_seconds: () => addZero(new Date().getSeconds()),

    // show
    show_name: ({ show }) => show.name || "",

    layout_slides: ({ ref }) => ref.length,
    layout_notes: ({ layout }) => layout.notes || "",

    slide_group: ({ show, ref, slideIndex }) => show.slides[ref[slideIndex]?.id]?.group || "",
    slide_number: ({ slideIndex }) => Number(slideIndex || 0) + 1,
    slide_notes: ({ show, ref, slideIndex }) => show.slides[ref[slideIndex]?.id]?.notes || "",

    // media
    video_time: ({ videoTime }) => joinTime(secondsToTime(videoTime)),
    video_duration: ({ videoDuration }) => joinTime(secondsToTime(videoDuration)),
    video_countdown: ({ videoTime, videoDuration }) => joinTime(secondsToTime(videoDuration - videoTime)),
}
