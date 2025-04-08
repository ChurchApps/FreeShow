import * as pdfjsLib from "pdfjs-dist"
import { get } from "svelte/store"
import { OUTPUT } from "../../../types/Channels"
import { Main } from "../../../types/IPC/Main"
import type { ProjectShowRef } from "../../../types/Projects"
import type { LayoutRef, OutSlide, Show, Slide, SlideAction, SlideData } from "../../../types/Show"
import { clearAudio } from "../../audio/audioFading"
import { AudioMicrophone } from "../../audio/audioMicrophone"
import { AudioPlayer } from "../../audio/audioPlayer"
import { sendMain } from "../../IPC/main"
import { send } from "../../utils/request"
import { runAction, slideHasAction } from "../actions/actions"
import type { API_output_style } from "../actions/api"
import { playPauseGlobal } from "../drawer/timers/timers"
import { getTextLines } from "../edit/scripts/textStyle"
import { clearBackground, clearOverlays, clearTimers } from "../output/clear"
import {
    activeEdit,
    activeFocus,
    activePage,
    activeProject,
    activeShow,
    allOutputs,
    currentWindow,
    driveData,
    focusMode,
    media,
    midiIn,
    outLocked,
    outputs,
    outputSlideCache,
    overlays,
    projects,
    shows,
    showsCache,
    slideTimers,
    special,
    stageShows,
    styles,
    templates,
    timers,
    triggers,
    variables,
    videosData,
    videosTime,
} from "./../../stores"
import { clone } from "./array"
import { getExtension, getFileName, getMediaStyle, getMediaType, removeExtension } from "./media"
import { getActiveOutputs, refreshOut, setOutput } from "./output"
import { loadShows } from "./setShow"
import { getLayoutRef, initializeMetadata } from "./show"
import { _show } from "./shows"
import { addZero, joinTime, secondsToTime } from "./time"
import { stopTimers } from "./timerTick"

const getProjectIndex = {
    next: (index: number | null, shows: ProjectShowRef[]) => {
        // change active show in project
        if (index === null) return 0
        index = shows.findIndex((_a, i) => i - 1 === index)
        return index === null || index < 0 ? null : index
    },
    previous: (index: number | null, shows: ProjectShowRef[]) => {
        // change active show in project
        if (index === null) return shows.length - 1
        index = shows.findIndex((_a, i) => i + 1 === index)
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

    let selectItem: "next" | "previous" = e.key === "ArrowDown" ? "next" : "previous"
    selectProjectShow(selectItem)
}

export function selectProjectShow(select: number | "next" | "previous") {
    let shows = get(projects)[get(activeProject) || ""]?.shows
    let index: null | number = (get(focusMode) ? get(activeFocus).index : get(activeShow)?.index) ?? null
    let newIndex: number | null = typeof select === "number" ? select : getProjectIndex[select](index, shows)

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
        if (get(focusMode)) activeFocus.set({ id: shows[newIndex].id, index: newIndex, type: shows[newIndex].type })
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
        if (Object.keys(get(showsCache)[id].layouts)?.length < 2) delete a[get(activeProject)!].shows[pos!].layout
        else a[get(activeProject)!].shows[pos!].layout = get(showsCache)[id].settings.activeLayout
        return a
    })
}

export function getItemWithMostLines(slide: Slide) {
    let amount: number = 0
    slide.items?.forEach((item) => {
        let lines: number = item.lines?.filter((a) => a.text.filter((a) => a.value.length)?.length)?.length || 0
        if (lines > amount) amount = lines
    })
    return amount
}

// TODO: multiple outputs with different lines!
// get output with fewest lines
export function getFewestOutputLines(updater = get(outputs)) {
    let outs = getActiveOutputs(updater, true, true, true)

    let currentLines = 0
    outs.forEach((id: string) => {
        let output = updater[id]
        if (!output.style) return

        let style = get(styles)[output.style]
        if (!style) return
        let lines = Number(style.lines || 0)
        if (!lines) return

        if (!currentLines || lines < currentLines) currentLines = lines
    })

    return Number(currentLines)
}

const PRESENTATION_KEYS_NEXT = [" ", "ArrowRight", "PageDown"]
const PRESENTATION_KEYS_PREV = ["ArrowLeft", "PageUp"]

// this will go to next for each slide (better for multiple outputs with "Specific outputs")
export function nextSlideIndividual(e: any, start: boolean = false, end: boolean = false) {
    getActiveOutputs().forEach((id) => nextSlide(e, start, end, false, false, id))
}

export function nextSlide(e: any, start: boolean = false, end: boolean = false, loop: boolean = false, bypassLock: boolean = false, customOutputId: string = "", nextAfterMedia: boolean = false) {
    if (get(outLocked) && !bypassLock) return
    if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

    let outputId = customOutputId || getActiveOutputs(get(outputs), true, true, true)[0]
    let currentOutput = get(outputs)[outputId] || {}
    let slide: null | OutSlide = currentOutput.out?.slide || null
    if (!slide) {
        let cachedSlide: null | OutSlide = get(outputSlideCache)[outputId] || null
        if (cachedSlide && cachedSlide?.id === get(activeShow)?.id && cachedSlide?.layout === get(showsCache)[get(activeShow)?.id || ""]?.settings?.activeLayout) slide = cachedSlide
    }

    // PPT
    if (slide?.type === "ppt") {
        sendMain(Main.PRESENTATION_CONTROL, { action: e?.key === "PageDown" ? "last" : "next" })
        return
    }

    // PDF
    if (((!slide || start) && get(activeShow)?.type === "pdf") || (!start && slide?.type === "pdf")) {
        if (start && slide?.id !== get(activeShow)?.id) slide = null
        let nextPage = slide?.page !== undefined ? slide.page + 1 : 0
        playPdf(slide, nextPage)
        return
    }

    // let layout: SlideData[] = GetLayout(slide ? slide.id : null, slide ? slide.layout : null)
    let layout = _show(slide ? slide.id : "active")
        .layouts(slide ? [slide.layout] : "active")
        .ref()[0]
    let slideIndex: number = slide?.index || 0
    let isLastSlide: boolean = layout && slide ? slideIndex >= layout.filter((a, i) => i < slideIndex || !a?.data?.disabled).length - 1 && !layout[slideIndex]?.data?.end : false

    // open next project item if previous has been opened and next is still active when going forward
    let isFirstSlide: boolean = slide && layout ? layout.filter((a) => !a?.data?.disabled).findIndex((a) => a.layoutIndex === slide?.index) === 0 : false
    let isFirstLine = (slide?.line || 0) === 0
    let nextProjectItem = get(projects)[get(activeProject) || ""]?.shows?.[(get(activeShow)?.index ?? -2) + 1]?.id
    let isPreviousProjectItem = slide?.id === nextProjectItem && isFirstSlide && isFirstLine
    if (isPreviousProjectItem && e?.key !== " ") {
        goToNextProjectItem()
        return
    }

    let index: null | number = null

    // lines
    let amountOfLinesToShow: number = getFewestOutputLines()
    let linesIndex: null | number = amountOfLinesToShow && slide ? slide.line || 0 : null
    let showSlide: Slide | null = slide?.index !== undefined ? _show(slide.id).slides([layout?.[slideIndex]?.id]).get()[0] : null
    let slideLines: null | number = showSlide ? getItemWithMostLines(showSlide) : null
    let hasLinesEnded: boolean = slideLines === null || linesIndex === null ? true : linesIndex + amountOfLinesToShow >= slideLines
    if (isLastSlide && !hasLinesEnded) isLastSlide = false

    // TODO: active show slide index on delete......

    // go to first slide in next project show ("Next after media" feature)
    let isNotLooping = loop && slide?.index !== undefined && !layout?.[slideIndex]?.data?.end
    if ((isNotLooping || nextAfterMedia) && bypassLock && slide && isLastSlide) {
        // check if it is last slide (& that slide does not loop to start)
        goToNextShowInProject(slide, customOutputId)
        return
    }

    // go to beginning if live mode & ctrl | no output | last slide active
    let currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
    if (currentShow && (start || !slide || e?.ctrlKey || (isLastSlide && (currentShow.id !== slide?.id || get(showsCache)[currentShow.id]?.settings.activeLayout !== slide.layout)))) {
        if (get(activeShow)?.type === "section" || !get(showsCache)[currentShow.id] || !getLayoutRef(currentShow.id).length) return goToNextProjectItem()

        let id = loop ? slide?.id : currentShow.id
        if (!id) return

        // layout = GetLayout()
        layout = getLayoutRef(id)
        if (!layout?.filter((a) => !a.data.disabled).length) return

        index = 0
        while (layout[index]?.data.disabled || notBound(layout[index], customOutputId)) index++

        let data = layout[index]?.data
        checkActionTrigger(data, index)
        // allow custom actions to trigger first
        setTimeout(() => {
            setOutput("slide", { id, layout: _show(id).get("settings.activeLayout"), index }, false, customOutputId)
            updateOut(id!, index!, layout, !e?.altKey, customOutputId)
        })
        return
    }

    if (!slide || slide.id === "temp") return

    let newSlideOut = { ...slide, line: 0 }
    if (!hasLinesEnded) {
        index = slideIndex
        if (amountOfLinesToShow && linesIndex !== null) newSlideOut.line = linesIndex + amountOfLinesToShow
    } else {
        // TODO: Check for loop to beginning slide...
        index = getNextEnabled(slideIndex, end, customOutputId)
    }
    if (index !== null) newSlideOut.index = index

    // go to next show if end
    if (index === null && currentShow?.id === slide?.id && get(showsCache)[currentShow?.id || ""]?.settings.activeLayout === slide.layout) {
        if (PRESENTATION_KEYS_NEXT.includes(e?.key)) goToNextProjectItem(e.key)
        return
    }

    if (index !== null) {
        let data = layout[index]?.data
        checkActionTrigger(data, index)
        // allow custom actions to trigger first
        setTimeout(() => {
            setOutput("slide", newSlideOut, false, customOutputId)
            updateOut(slide ? slide.id : "active", index!, layout, !e?.altKey, customOutputId)
        })
    }
}

const triggerActionsBeforeOutput = {
    change_output_style: (actionValue: any) => {
        const layers = get(styles)[actionValue?.outputStyle]?.layers
        if (!Array.isArray(layers)) return false
        return !layers.includes("background")
    },
}
function shouldTriggerBefore(action: any) {
    return action.triggers?.find((trigger) => triggerActionsBeforeOutput[trigger]?.(action.actionValues?.[trigger]))
}
export function checkActionTrigger(layoutData: SlideData, slideIndex: number = 0) {
    layoutData?.actions?.slideActions?.forEach((a) => {
        if (shouldTriggerBefore(a)) runAction(a, { slideIndex })
    })
}

async function goToNextShowInProject(slide, customOutputId) {
    if (!get(activeProject)) return

    // get current project show
    let currentProject = get(projects)[get(activeProject)!]
    // this will get the first show in the project with this id, so it won't work properly with multiple of the same shows in a project
    let projectIndex = currentProject.shows.findIndex((a) => a.id === slide!.id)
    if (projectIndex < 0) return

    let currentOutputProjectShowIndex = currentProject.shows[projectIndex]
    if (currentOutputProjectShowIndex.id !== slide.id) return

    let nextShowInProjectIndex = currentProject.shows.findIndex((a, i) => i > projectIndex && (a.type || "show") === "show")
    if (nextShowInProjectIndex < 0) return

    let nextShow = currentProject.shows[nextShowInProjectIndex]
    await loadShows([nextShow.id])
    let activeLayout = nextShow.layout || _show(nextShow.id).get("settings.activeLayout")
    let layout = _show(nextShow.id).layouts([activeLayout]).ref()[0]

    // let hasNextAfterMediaAction = layout[slide.index].data.actions?.nextAfterMedia
    // if (!hasNextAfterMediaAction) return

    setOutput("slide", { id: nextShow.id, layout: activeLayout, index: 0 }, false, customOutputId)
    updateOut(nextShow.id, 0, layout, true, customOutputId)

    // open next item in project (if current is open)
    if (get(activeShow)?.index === projectIndex) {
        if (get(focusMode)) activeFocus.set({ id: nextShow.id, index: nextShowInProjectIndex, type: nextShow.type })
        else activeShow.set({ ...nextShow, index: nextShowInProjectIndex })
    }
}

// only let "first" output change project item if multiple outputs
let changeProjectItemTimeout: NodeJS.Timeout | null = null

export function goToNextProjectItem(key: string = "") {
    if (changeProjectItemTimeout) return
    changeProjectItemTimeout = setTimeout(() => {
        changeProjectItemTimeout = null

        let currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
        if (!get(activeProject) || typeof currentShow?.index !== "number") return

        let index: number = currentShow.index ?? -1
        if (index + 1 < get(projects)[get(activeProject)!]?.shows?.length) index++
        if (index > -1 && index !== currentShow.index) {
            let newShow = get(projects)[get(activeProject)!].shows[index]
            if (get(focusMode)) activeFocus.set({ id: newShow.id, index, type: newShow.type })
            else activeShow.set({ ...newShow, index })

            if (newShow.type === "section" && PRESENTATION_KEYS_NEXT.includes(key) && (newShow.data?.settings?.triggerAction || get(special).sectionTriggerAction)) {
                let actionId = newShow.data?.settings?.triggerAction
                if (!actionId || !get(midiIn)[actionId]) actionId = get(special).sectionTriggerAction
                if (actionId) runAction(get(midiIn)[actionId])
                return
            }

            // skip if section is empty
            if (newShow.type === "section" && !newShow.notes) goToNextProjectItem()
        }
    })
}

export function goToPreviousProjectItem(key: string = "") {
    if (changeProjectItemTimeout) return
    changeProjectItemTimeout = setTimeout(() => {
        changeProjectItemTimeout = null

        let currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
        if (!get(activeProject) || typeof currentShow?.index !== "number") return

        let index: number = currentShow.index ?? get(projects)[get(activeProject)!]?.shows?.length
        if (index - 1 >= 0) index--
        if (index > -1 && index !== currentShow.index) {
            let newShow = get(projects)[get(activeProject)!].shows[index]
            if (get(focusMode)) activeFocus.set({ id: newShow.id, index, type: newShow.type })
            else activeShow.set({ ...newShow, index })

            if (newShow.type === "section" && PRESENTATION_KEYS_PREV.includes(key) && (newShow.data?.settings?.triggerAction || get(special).sectionTriggerAction)) {
                let actionId = newShow.data?.settings?.triggerAction
                if (!actionId || !get(midiIn)[actionId]) actionId = get(special).sectionTriggerAction
                if (actionId) runAction(get(midiIn)[actionId])
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

    let outputId = customOutputId || getActiveOutputs(get(outputs), true, true, true)[0]
    let currentOutput = get(outputs)[outputId] || {}
    let slide = currentOutput.out?.slide || null
    if (!slide) {
        let cachedSlide: null | OutSlide = get(outputSlideCache)[outputId] || null
        if (cachedSlide && cachedSlide?.id === get(activeShow)?.id && cachedSlide?.layout === get(showsCache)[get(activeShow)?.id || ""]?.settings?.activeLayout) slide = cachedSlide
    }

    // PPT
    if (slide?.type === "ppt") {
        sendMain(Main.PRESENTATION_CONTROL, { action: e?.key === "PageUp" ? "first" : "previous" })
        return
    }

    // PDF
    if ((!slide && get(activeShow)?.type === "pdf") || slide?.type === "pdf") {
        let nextPage = slide?.page ? slide.page - 1 : 0
        playPdf(slide, nextPage)
        return
    }

    // let layout: SlideData[] = GetLayout(slide ? slide.id : null, slide ? slide.layout : null)
    let layout = _show(slide ? slide.id : "active")
        .layouts(slide ? [slide.layout] : "active")
        .ref()[0]
    let activeLayout: string = _show(slide ? slide.id : "active").get("settings.activeLayout")
    let currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
    let index: number | null = slide?.index !== undefined ? slide.index - 1 : layout ? layout.length - 1 : null
    if (index === null) {
        if (get(activeShow)?.type === "section" || !get(showsCache)[currentShow?.id || ""]) goToPreviousProjectItem()
        return
    }

    let activeShowLayout = get(showsCache)[currentShow?.id || ""]?.settings?.activeLayout

    // lines
    let outputWithLines = getFewestOutputLines()
    let amountOfLinesToShow: number = outputWithLines ? outputWithLines : 0
    let linesIndex: null | number = amountOfLinesToShow && slide ? slide.line || 0 : null
    let hasLinesEnded: boolean = !slide || linesIndex === null || linesIndex < 1

    // open previous project item if next has been opened and previous is still active when going back
    let slideIndex: number = slide?.index || 0
    let isLastSlide: boolean = layout && slide ? slideIndex >= layout.filter((a, i) => i < slideIndex || !a?.data?.disabled).length - 1 && !layout[slideIndex]?.data?.end : false
    let showSlide: Slide | null =
        _show(slide ? slide.id : "active")
            .slides([layout[index]?.id])
            .get()[0] || null
    let isLastLine = slide?.line === undefined || !amountOfLinesToShow || !showSlide || slide.line >= Math.ceil(getItemWithMostLines(showSlide) / amountOfLinesToShow) - 1
    let previousProjectItem = get(projects)[get(activeProject) || ""]?.shows?.[(get(activeShow)?.index ?? -2) - 1]?.id
    let isNextProjectItem = slide?.id === previousProjectItem && isLastSlide && isLastLine
    if (isNextProjectItem) {
        goToPreviousProjectItem()
        return
    }

    // skip disabled slides if clicking previous when another show is selected and no enabled slide is before
    let isFirstSlide: boolean = slide && layout ? layout.filter((a) => !a?.data?.disabled).findIndex((a) => a.layoutIndex === slide?.index) === 0 : false
    // if (!hasLinesEnded && isFirstSlide) isFirstSlide = false
    if (activeShowLayout !== slide?.layout && hasLinesEnded && (index < 0 || isFirstSlide)) {
        slide = null
        layout = getLayoutRef()
        activeLayout = activeShowLayout
        index = (layout?.length || 0) - 1
    }

    let line: number = linesIndex || 0
    if (hasLinesEnded) {
        if (index < 0 || !layout.slice(0, index + 1).filter((a) => !a.data.disabled).length) {
            // go to previous show if out slide at start
            if ((currentShow?.id === slide?.id && activeShowLayout === slide?.layout) || get(activeShow)?.type === "section" || !get(showsCache)[currentShow?.id || ""] || !layout.length) {
                if (PRESENTATION_KEYS_PREV.includes(e?.key)) goToPreviousProjectItem(e.key)
            }
            return
        }

        while (layout[index].data.disabled || notBound(layout[index], customOutputId)) index--

        // get slide line
        let showSlide: Slide | null =
            _show(slide ? slide.id : "active")
                .slides([layout[index].id])
                .get()[0] || null
        let slideLines: null | number = showSlide ? getItemWithMostLines(showSlide) : null
        if (amountOfLinesToShow) {
            let maxIndex = slideLines ? amountOfLinesToShow * Math.ceil(slideLines / amountOfLinesToShow) : 0
            line = maxIndex ? maxIndex - amountOfLinesToShow : 0
        }
    } else {
        index = slide!.index!
        if (amountOfLinesToShow) line -= amountOfLinesToShow
    }

    let data = layout[index]?.data
    checkActionTrigger(data, index)
    // allow custom actions to trigger first
    setTimeout(() => {
        if (slide) setOutput("slide", { ...slide, index, line }, false, customOutputId)
        else if (currentShow) setOutput("slide", { id: currentShow.id, layout: activeLayout, index, line }, false, customOutputId)

        updateOut(slide ? slide.id : "active", index!, layout, !e?.altKey, customOutputId)
    })
}

// skip slides that are bound to specific output not customId
function notBound(ref, outputId: string | undefined) {
    return outputId && ref?.data?.bindings?.length && !ref?.data?.bindings.includes(outputId)
}

async function playPdf(slide: null | OutSlide, nextPage: number) {
    let data = slide || get(activeShow)
    if (!data?.id) return

    pdfjsLib.GlobalWorkerOptions.workerSrc = "./assets/pdf.worker.min.mjs"
    const pdfDoc = await pdfjsLib.getDocument(data.id).promise
    const pages = pdfDoc.numPages
    if (nextPage > pages - 1) return

    let name = data?.name || get(projects)[get(activeProject) || ""]?.shows[get(activeShow)?.index || 0]?.name

    setOutput("slide", { type: "pdf", id: data.id, page: nextPage, pages, name })
    clearBackground()
}

function getNextEnabled(index: null | number, end: boolean = false, customOutputId: string = ""): null | number {
    if (index === null || isNaN(index)) return null

    index++

    let outputId = customOutputId || getActiveOutputs(get(outputs), true, true, true)[0]
    let currentOutput = get(outputs)[outputId] || {}
    let slide = currentOutput.out?.slide || null
    let layout = _show(slide ? slide.id : "active")
        .layouts(slide ? [slide.layout] : "active")
        .ref()[0]

    if (layout[index - 1]?.data?.end) index = 0
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

    let outputId = getActiveOutputs(get(outputs), true, true, true)[0]
    let currentOutput = get(outputs)[outputId] || {}
    let slide = currentOutput.out?.slide || null
    let currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
    let showId = slide?.id || currentShow?.id
    if (!showId) return

    let layoutId = slide?.layout || _show(showId).get("settings.activeLayout")
    let layout = _show(showId).layouts([layoutId]).ref()[0]

    let slideCount = layout.length || 0
    if (slideCount < 2) return

    let currentSlideIndex = slide?.index ?? -1

    // get new random index that is not the currently selected one
    let randomIndex = -1
    do {
        randomIndex = randomNumber(slideCount)
    } while (randomIndex === currentSlideIndex)

    // play slide
    let data = layout[randomIndex]?.data
    checkActionTrigger(data, randomIndex)
    // allow custom actions to trigger first
    setTimeout(() => {
        setOutput("slide", { id: showId, layout: layoutId, index: randomIndex }, false)
        updateOut(showId!, randomIndex, layout)
    })
}
function randomNumber(end: number) {
    return Math.floor(Math.random() * end)
}

export function updateOut(showId: string, index: number, layout: LayoutRef[], extra: boolean = true, outputId: string = "", actionTimeout: number = 10) {
    if (get(activePage) !== "edit") activeEdit.set({ slide: index, items: [] })

    _show(showId).set({ key: "timestamps.used", value: new Date().getTime() })
    if (!layout) return
    let data = layout[index]?.data

    // holding "alt" key will disable all extra features
    if (!extra || !data) return

    // trigger start show action first
    let startShowId = data.actions?.startShow?.id || data.actions?.slideActions?.find((a) => a.actionValues?.start_show)?.id
    if (startShowId) {
        startShow(startShowId)
        return
    }

    // get output slide
    let outputIds = outputId ? [outputId] : data.bindings?.length ? data.bindings : getActiveOutputs()

    // WIP custom next slide timer duration (has to be changed on slide click & in preview as well)
    // let outputWithLine = outputIds.find((id: string) => get(outputs)[id].out?.slide?.line !== undefined)
    // let outSlide = get(outputs)[outputWithLine]?.out?.slide || {}
    // let showSlide = outSlide.index !== undefined ? _show(outSlide.id).slides([layout[index].id]).get()[0] : null
    // let slideLines = showSlide ? getItemWithMostLines(showSlide) : null
    // let outputWithLines = getOutputWithLines() || 0
    // let maxLines = slideLines && outSlide.index !== null ? (outputWithLines >= slideLines ? 0 : Math.ceil(slideLines / outputWithLines)) : 0
    let duration = data.nextTimer
    // if (maxLines) duration /= maxLines

    // find any selected output with no lines
    let outputAtLine = outputIds.find((id: string) => get(outputs)[id].out?.slide?.line)
    // actions will only trigger on index 0 if multiple lines
    if (outputAtLine) {
        // restart any next slide timers
        outputIds.map(nextSlideTimers)
        return
    }

    outputIds.map(activateActions)

    function activateActions(outputId: string) {
        let background = data.background || null

        // get ghost background
        if (!background) {
            layout.forEach((a, i) => {
                if (i <= index && !a.data.disabled) {
                    if (slideHasAction(a.data?.actions, "clear_background")) background = null
                    else if (a.data.background) background = a.data.background
                    if (a.data.background && _show(showId).get("media")?.[a.data.background]?.loop === false) background = null
                }
            })
        }

        // background
        if (background && _show(showId).get("media")?.[background]) {
            let bg = _show(showId).get("media")[background]
            let outputBg = get(outputs)[outputId]?.out?.background
            let cloudId = get(driveData).mediaId
            let bgPath = cloudId && cloudId !== "default" ? bg.cloud?.[cloudId] || bg.path || bg.id : bg.path || bg.id
            let name = bg.name || removeExtension(getFileName(bgPath))
            let extension = getExtension(bgPath)
            let type = bg.type || getMediaType(extension)

            // get stored media files
            // if (get(special).storeShowMedia && bg.base64) {
            //     bgPath = `data:${type}/${extension};base64,${bg.base64}`
            // }

            if (bg && bgPath !== outputBg?.path) {
                let outputStyle = get(styles)[get(outputs)[outputId]?.style || ""]
                let mediaStyle = getMediaStyle(get(media)[bgPath], outputStyle)
                let loop = bg.loop !== false
                let muted = bg.muted !== false

                let bgData = {
                    name,
                    type,
                    path: bgPath,
                    cameraGroup: bg.cameraGroup || "",
                    id: bg.id || bgPath, // path = cameras
                    loop,
                    muted,
                    ...mediaStyle,
                    ignoreLayer: mediaStyle.videoType === "foreground",
                }

                // outBackground.set(bgData)
                setOutput("background", bgData, false, outputId)
            }
        }

        // mics
        if (data.mics) {
            data.mics.forEach((mic) => {
                AudioMicrophone.start(mic.id, { name: mic.name })
            })
        }

        // audio
        if (data.audio) {
            // let clear action trigger first
            setTimeout(() => {
                data.audio?.forEach((audio: string) => {
                    let a = clone(_show(showId).get("media")[audio])
                    let cloudId = get(driveData).mediaId
                    if (cloudId && cloudId !== "default") a.path = a.cloud?.[cloudId] || a.path

                    if (a) AudioPlayer.start(a.path, { name: a.name }, { pauseIfPlaying: false })
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
        if (data.actions.audioStream) AudioPlayer.start(data.actions.audioStream, { name: "" })
        // if (data.actions.sendMidi) sendMidi(_show(showId).get("midi")[data.actions.sendMidi])
        // if (data.actions.nextAfterMedia) // go to next when video/audio is finished
        if (data.actions.outputStyle) changeOutputStyle(data.actions)
        if (data.actions.startTimer) playSlideTimers({ showId: showId, slideId: layout[index].id, overlayIds: data.overlays || [] })
    }

    if (data.actions?.slideActions?.length) {
        // let values update
        setTimeout(() => {
            playSlideActions(data.actions!.slideActions!, outputIds, index)
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
function playSlideActions(actions: SlideAction[], outputIds: string[] = [], slideIndex: number = -1) {
    actions = clone(actions)

    // run these actions on each active output
    if (outputIds.length > 1) {
        runPerOutput.forEach((id) => {
            let existingIndex = actions.findIndex((a) => a.triggers?.[0] === id)
            if (existingIndex < 0) return

            outputIds.forEach((outputId) => {
                if (id.includes("background")) setOutput("background", null, false, outputId)
                else if (id.includes("overlays")) clearOverlays(outputId)
            })
            actions.splice(existingIndex, 1)
        })
    }

    actions.forEach((a) => {
        // no need to "re-run" actions triggered right before output
        if (shouldTriggerBefore(a)) return

        runAction(a, { slideIndex })
    })

    playOutputStyleTemplateActions(outputIds)
}

// play any output style template actions
function playOutputStyleTemplateActions(outputIds: string[]) {
    outputIds.forEach((outputId) => {
        let outputStyleId = get(outputs)[outputId]?.style || ""
        if (!outputStyleId) return

        let styleTemplateId = get(styles)[outputStyleId]?.template || ""
        if (!styleTemplateId) return

        let templateSettings = get(templates)[styleTemplateId]?.settings?.actions || []
        if (!templateSettings?.length) return

        templateSettings?.forEach((action) => runAction(action))
    })
}

export function startShowSync(showId: string) {
    startShow(showId)
}

export async function startShow(showId: string) {
    if (!showId) return

    let show = await loadShows([showId])
    if (show !== "loaded") return

    if (!get(showsCache)[showId]) return
    let activeLayout = get(showsCache)[showId].settings?.activeLayout || ""

    // slideClick() - Slides.svelte
    let slideRef = getLayoutRef(showId)
    if (!slideRef[0]) return

    setOutput("slide", { id: showId, layout: activeLayout, index: 0, line: 0 })
    // timeout has to be 1200 to let output data update properly (in case slide has special actions)
    updateOut(showId, 0, slideRef, true, "", 1200)
}

export function changeOutputStyle({ outputStyle, styleOutputs }: API_output_style) {
    let type = styleOutputs?.type || "active"
    let outputsList = styleOutputs?.outputs || []

    let chosenOutputs = getActiveOutputs(get(outputs), type === "active", true, true)
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

export function playNextGroup(globalGroupIds: string[], { showRef, outSlide, currentShowId }, extra: boolean = true) {
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
    let data = showRef[index]?.data
    checkActionTrigger(data, index)
    // allow custom actions to trigger first
    setTimeout(() => {
        setOutput("slide", { id: currentShowId, layout: _show(currentShowId).get("settings.activeLayout"), index, line: 0 })
        updateOut(currentShowId, index!, showRef, extra, "")
    })

    setTimeout(() => {
        // defocus search input
        ;(document.activeElement as any)?.blur()
    }, 10)

    return true
}

// go to next slide if current output slide has nextAfterMedia action
let nextActive: string[] = []
export function checkNextAfterMedia(endedId: string, type: "media" | "audio" | "timer" = "media", outputId: string = "") {
    if (nextActive.includes(outputId)) return false

    nextActive.push(outputId)
    setTimeout(() => {
        nextActive.splice(nextActive.indexOf(outputId), 1)
    }, 600) // MAKE SURE NEXT SLIDE HAS TRANSITIONED

    if (!outputId) outputId = getActiveOutputs(get(outputs), true, true, true)[0]
    if (!outputId) return false

    let currentOutput = get(outputs)[outputId]
    if (!currentOutput) return false

    let slideOut = currentOutput.out?.slide
    if (!slideOut) return false

    let layoutSlide = _show(slideOut.id).layouts([slideOut.layout]).ref()[0]?.[slideOut.index ?? -1]
    if (!layoutSlide) return false

    // check that current slide has the ended media!
    if (type === "media" || type === "audio") {
        let showMedia = _show(slideOut.id).media().get()
        // find all matching paths because some slides with same background might have different media ids
        let allMediaIds = showMedia.filter((a) => a.path === endedId).map((a) => a.key)

        // don't go to next if current slide don't has outputted media
        if (type === "media") {
            if (!allMediaIds.includes(layoutSlide.data?.background)) return false
        } else if (type === "audio") {
            if (!layoutSlide.data?.audio?.find((id) => allMediaIds.includes(id))) return false
        }
    } else if (type === "timer") {
        let slide = _show(slideOut.id).get("slides")[layoutSlide.id]
        let slideTimer = slide?.items?.find((a) => a.type === "timer" && a.timerId === endedId)
        if (!slideTimer) return false
    }

    let nextAfterMedia = layoutSlide?.data?.actions?.nextAfterMedia
    if (!nextAfterMedia) return false

    // WIP PAUSE PLAYING VIDEO WHEN ENDED, so it does not loop to start
    let loop = layoutSlide?.data?.end
    nextSlide(null, false, false, loop, true, outputId, !loop)

    return true
}

export function playSlideTimers({ showId = "active", slideId = "", overlayIds = [] as string[] }) {
    if (!slideId) {
        let outSlide: OutSlide | null = get(outputs)[getActiveOutputs(get(outputs), false, true, true)[0]]?.out?.slide || null
        if (!outSlide) return

        showId = outSlide.id || ""

        let layoutRef = _show(showId).layouts([outSlide.layout]).ref()[0]
        if (!layoutRef) return
        slideId = layoutRef[outSlide.index ?? -1]?.id || ""
    }

    let showSlides: { [key: string]: Slide } = _show(showId).get("slides") || {}
    let slide = showSlides[slideId]
    if (!slide) return

    // find all timers in current slide & any overlay placed on the slide
    let slideItems = slide.items || []
    let allOverlayItems = overlayIds.map((id: string) => get(overlays)[id]?.items).flat()
    let items = [...slideItems, ...allOverlayItems]

    items.forEach((item) => {
        if (item.type === "timer" && item.timerId) playPauseGlobal(item.timerId, get(timers)[item.timerId], true)
    })
}

export function sendMidi(data: any) {
    sendMain(Main.SEND_MIDI, data)
}

export function activateTriggerSync(triggerId: string) {
    activateTrigger(triggerId)
}

export async function activateTrigger(triggerId: string): Promise<string> {
    let trigger = get(triggers)[triggerId]
    if (!trigger) return ""

    if (!customTriggers[trigger.type]) {
        console.log("Missing trigger:", trigger.type)
        return "error"
    }

    return customTriggers[trigger.type](trigger.value)
}

const customTriggers = {
    http: (value: string): Promise<string> => {
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

// DYNAMIC VALUES

export const dynamicValueText = (id: string) => `{${id}}`
export function getDynamicIds() {
    let mainValues = Object.keys(dynamicValues)
    let metaValues = Object.keys(initializeMetadata({})).map((id) => `meta_` + id)
    const variablesList = Object.values(get(variables)).filter((a) => a?.name)
    let variableValues = variablesList.map(({ name }) => `variable_` + getVariableNameId(name))

    return [...mainValues, ...metaValues, ...variableValues]
}

export function replaceDynamicValues(text: string, { showId, layoutId, slideIndex, type, id }: any, _updater: number = 0) {
    if (type === "stage" && get(currentWindow) === "output") {
        let outputId = Object.values(get(outputs))[0]?.stageOutput || ""
        let outSlide = get(allOutputs)[outputId]?.out?.slide
        showId = outSlide?.id
        slideIndex = outSlide?.index
    } else if (type === "stage") {
        let stageOutput = get(stageShows)[id]?.settings?.output
        let outputId = stageOutput || getActiveOutputs(get(outputs), false, true, true)[0]
        let outSlide = get(outputs)[outputId]?.out?.slide
        showId = outSlide?.id
        slideIndex = outSlide?.index
    }

    let show = _show(showId).get()
    if (type === "show" && !show) return text

    getDynamicIds().forEach((id) => {
        if (!text.includes(dynamicValueText(id))) return

        let newValue = getDynamicValue(id, show)
        text = text.replaceAll(dynamicValueText(id), newValue)
    })

    return text

    function getDynamicValue(id: string, show: Show): string {
        // VARIABLE
        if (id.includes("variable_")) {
            let nameId = id.slice(9)
            let variable = Object.values(get(variables)).find((a) => getVariableNameId(a.name) === nameId)
            if (!variable) return ""

            if (variable.type === "number") return Number(variable.number || 0).toString()

            if (variable.enabled === false) return ""
            if (variable.text?.includes(id)) return variable.text || ""
            return replaceDynamicValues(variable.text || "", { showId, layoutId, slideIndex, type, id })
        }

        let outputId: string = getActiveOutputs(get(outputs), false, true, true)[0]

        if (id.includes("video_") && get(currentWindow) === "output") {
            send(OUTPUT, ["MAIN_REQUEST_VIDEO_DATA"], { id: outputId })
        }

        let outSlide: OutSlide | null = get(outputs)[outputId]?.out?.slide || null

        if (!showId) {
            showId = outSlide?.id
            layoutId = outSlide?.layout
            slideIndex = outSlide?.index ?? -1
            show = _show(showId).get() || {}
        }

        // META
        if (id.includes("meta_")) {
            let key = id.slice(5)
            return show?.meta?.[key] || ""
        }

        let activeLayout = layoutId ? [layoutId] : "active"
        let ref = _show(showId).layouts(activeLayout).ref()[0] || []
        let layout = _show(showId).layouts(activeLayout).get()[0] || {}

        let videoTime: number = get(videosTime)[outputId] || 0
        let videoDuration: number = get(videosData)[outputId]?.duration || 0

        let projectIndex = get(projects)[get(activeProject) || ""]?.shows?.findIndex((a) => a.id === showId)
        if (projectIndex < 0) projectIndex = get(activeShow)?.index ?? -2
        let projectRef = { id: get(activeProject) || "", index: projectIndex }

        const value = (dynamicValues[id]({ show, ref, slideIndex, layout, projectRef, outSlide, videoTime, videoDuration }) ?? "").toString()

        if (id === "show_name_next" && !value && get(currentWindow) === "output") {
            send(OUTPUT, ["MAIN_SHOWS_DATA"])
        }

        return value
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
    show_name_next: ({ projectRef }) => get(shows)[get(projects)[projectRef.id]?.shows?.[projectRef.index + 1]?.id]?.name || "",

    layout_slides: ({ ref }) => ref.length,
    layout_notes: ({ layout }) => layout.notes || "",

    slide_number: ({ slideIndex }) => (Number(slideIndex || 0) + 1).toString(),
    slide_group: ({ show, ref, slideIndex }) => show.slides?.[ref[slideIndex]?.id]?.group || "",
    slide_group_next: ({ show, ref, slideIndex }) => show.slides?.[ref[slideIndex + 1]?.id]?.group || "",
    slide_notes: ({ show, ref, slideIndex }) => show.slides?.[ref[slideIndex]?.id]?.notes || "",
    slide_notes_next: ({ show, ref, slideIndex }) => show.slides?.[ref[slideIndex + 1]?.id]?.notes || "",

    // text
    slide_text_previous: ({ show, ref, slideIndex, outSlide }) => getTextLines(outSlide?.id === "temp" ? { items: outSlide?.previousSlides } : show.slides?.[ref[slideIndex - 1]?.id]).join("<br>"),
    slide_text_next: ({ show, ref, slideIndex, outSlide }) => getTextLines(outSlide?.id === "temp" ? { items: outSlide?.nextSlides } : show.slides?.[ref[slideIndex + 1]?.id]).join("<br>"),

    // media
    video_time: ({ videoTime }) => joinTime(secondsToTime(videoTime)),
    video_countdown: ({ videoTime, videoDuration }) => joinTime(secondsToTime(videoDuration > 0 ? videoDuration - videoTime : 0)),
    video_duration: ({ videoDuration }) => joinTime(secondsToTime(videoDuration)),
}

export function getVariableNameId(name: string) {
    return name.toLowerCase().trim().replaceAll(" ", "_")
}
