import type { ICommonTagsResult } from "music-metadata/lib/type"
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist"
import { get } from "svelte/store"
import { OUTPUT } from "../../../types/Channels"
import { Main } from "../../../types/IPC/Main"
import type { Variable } from "../../../types/Main"
import type { ProjectShowRef } from "../../../types/Projects"
import type { Item, LayoutRef, OutSlide, Show, Slide, SlideAction, SlideData } from "../../../types/Show"
import { clearAudio } from "../../audio/audioFading"
import { AudioMicrophone } from "../../audio/audioMicrophone"
import { AudioPlayer } from "../../audio/audioPlayer"
import { sendMain } from "../../IPC/main"
import { send } from "../../utils/request"
import { convertRSSToString, getRSS } from "../../utils/rss"
import { playFolder, togglePlayingMedia } from "../../utils/shortcuts"
import { runAction, slideHasAction } from "../actions/actions"
import type { API_output_style } from "../actions/api"
import { getCurrentTimerValue, playPauseGlobal } from "../drawer/timers/timers"
import { getDynamicValue } from "../edit/scripts/itemHelpers"
import { getTextLines } from "../edit/scripts/textStyle"
import { clearBackground, clearOverlays, clearTimers } from "../output/clear"
import {
    actions,
    activeEdit,
    activeFocus,
    activePage,
    activeProject,
    activeShow,
    allOutputs,
    audioData,
    currentWindow,
    customMetadata,
    dictionary,
    driveData,
    dynamicValueData,
    focusMode,
    media,
    outLocked,
    outputs,
    outputSlideCache,
    overlays,
    playingAudio,
    playingMetronome,
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
    videosTime
} from "./../../stores"
import { clone, keysToID, sortByName } from "./array"
import { getExtension, getFileName, getMediaStyle, getMediaType, removeExtension } from "./media"
import { getActiveOutputs, isOutCleared, refreshOut, setOutput } from "./output"
import { getSetChars } from "./randomValue"
import { loadShows } from "./setShow"
import { getCustomMetadata, getGroupName, getLayoutRef } from "./show"
import { _show } from "./shows"
import { addZero, getMonthName, getWeekday, joinTime, joinTimeBig, secondsToTime } from "./time"
import { stopTimers } from "./timerTick"

const getProjectIndex = {
    next: (index: number | null, items: ProjectShowRef[]) => {
        // change active show in project
        if (index === null) return 0
        index = items.findIndex((_a, i) => i - 1 === index)
        return index === null || index < 0 ? null : index
    },
    previous: (index: number | null, items: ProjectShowRef[]) => {
        // change active show in project
        if (index === null) return items.length - 1
        index = items.findIndex((_a, i) => i + 1 === index)
        return index === null || index < 0 ? null : index
    }
}

export function checkInput(e: any) {
    if (e.target?.closest(".edit") || e.ctrlKey || e.metaKey) return
    // TODO: combine with ShowButton.svelte click()

    if (!["ArrowDown", "ArrowUp"].includes(e.key)) return
    if (get(activeProject) === null) return
    e.preventDefault()
        ; (document.activeElement as any)?.blur()

    const selectItem: "next" | "previous" = e.key === "ArrowDown" ? "next" : "previous"
    selectProjectShow(selectItem)
}

export function selectProjectShow(select: number | "next" | "previous") {
    const items = get(projects)[get(activeProject) || ""]?.shows
    const index: null | number = (get(focusMode) ? get(activeFocus).index : get(activeShow)?.index) ?? null
    const newIndex: number | null = !isNaN((select as any) || 0) ? Number(select || 0) : getProjectIndex[select](index, items)

    if (newIndex === null || !items[newIndex]) return

    // show
    if (!get(focusMode) && (items[newIndex].type || "show") === "show") {
        // async waiting for show to load
        setTimeout(async () => {
            // preload show (so the layout can be changed)
            await loadShows([items[newIndex].id])
            if (get(showsCache)[items[newIndex].id]) swichProjectItem(newIndex, items[newIndex].id)
        })
    }

    // set active show in project list
    if (get(focusMode)) activeFocus.set({ id: items[newIndex].id, index: newIndex, type: items[newIndex].type })
    else activeShow.set({ ...items[newIndex], index: newIndex })
}

export function swichProjectItem(pos: number, id: string) {
    if (!get(showsCache)[id]?.layouts || !get(projects)[get(activeProject)!]?.shows) return
    let projectLayout: string = get(projects)[get(activeProject)!].shows[pos].layout || ""

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
        if (Object.keys(get(showsCache)[id].layouts)?.length < 2) delete a[get(activeProject)!].shows[pos].layout
        else a[get(activeProject)!].shows[pos].layout = get(showsCache)[id].settings.activeLayout
        return a
    })
}

export function getItemWithMostLines(slide: Slide | { items: Item[] }) {
    let amount = 0
    slide.items?.forEach((item) => {
        const lines: number = item.lines?.filter((line) => line.text.filter((text) => text.value.length)?.length)?.length || 0
        if (lines > amount) amount = lines
    })
    return amount
}

// TODO: multiple outputs with different lines!
// get output with fewest lines
export function getFewestOutputLines(updater = get(outputs)) {
    const outs = getActiveOutputs(updater, true, true, true)

    let currentLines = 0
    outs.forEach((id: string) => {
        const output = updater[id]
        if (!output.style) return

        const style = get(styles)[output.style]
        if (!style) return
        const lines = Number(style.lines || 0)
        if (!lines) return

        if (!currentLines || lines < currentLines) currentLines = lines
    })

    return Number(currentLines)
}

// get output with fewest revealed lines
export function getFewestOutputLinesReveal(updater = get(outputs)) {
    const outs = getActiveOutputs(updater, true, true, true)

    let currentLines = 0
    outs.forEach((id: string) => {
        const output = updater[id]
        const lines = Number(output.out?.slide?.revealCount || 0)
        if (!lines) return

        if (!currentLines || lines < currentLines) currentLines = lines
    })

    return Number(currentLines)
}

const PRESENTATION_KEYS_NEXT = [" ", "ArrowRight", "PageDown"]
const PRESENTATION_KEYS_PREV = ["ArrowLeft", "PageUp"]

// this will go to next for each slide (better for multiple outputs with "Specific outputs")
export function nextSlideIndividual(e: any, start = false, end = false) {
    getActiveOutputs(get(outputs), true, false, true).forEach((id) => nextSlide(e, start, end, false, false, id))
}

export function nextSlide(e: any, start = false, end = false, loop = false, bypassLock = false, customOutputId = "", nextAfterMedia = false) {
    if (get(outLocked) && !bypassLock) return
    // blur to remove tab highlight from slide after clicked, and using arrows
    if (document.activeElement?.closest(".slide") && !document.activeElement?.closest(".edit")) (document.activeElement as HTMLElement).blur()

    const outputId = customOutputId || getActiveOutputs(get(outputs), true, true, true)[0]
    const currentOutput = get(outputs)[outputId] || {}
    let slide: null | OutSlide = currentOutput.out?.slide || null
    if (!slide) {
        const cachedSlide: null | OutSlide = get(outputSlideCache)[outputId] || null
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
        const nextPage = slide?.page !== undefined ? slide.page + 1 : 0
        playPdf(slide, nextPage)
        return
    }

    // Folder
    if (((!slide || start) && get(activeShow)?.type === "folder") || (!start && slide?.type === "folder")) {
        const path = slide?.type === "folder" ? slide.id : get(activeShow)?.id || ""
        playFolder(path)
        return
    }

    // let layout: SlideData[] = GetLayout(slide ? slide.id : null, slide ? slide.layout : null)
    let layout = _show(slide ? slide.id : "active")
        .layouts(slide ? [slide.layout] : "active")
        .ref()[0]
    const slideIndex: number = slide?.index || 0
    let isLastSlide: boolean = layout && slide ? slideIndex >= layout.filter((a, i) => i < slideIndex || !a?.data?.disabled).length - 1 && !layout[slideIndex]?.data?.end : false

    // open next project item if previous has been opened and next is still active when going forward
    const isFirstSlide: boolean = slide && layout ? layout.filter((a) => !a?.data?.disabled).findIndex((a) => a.layoutIndex === slide?.index) === 0 : false
    const isFirstLine = (slide?.line || 0) === 0
    const nextProjectItem = get(projects)[get(activeProject) || ""]?.shows?.[(get(activeShow)?.index ?? -2) + 1]?.id
    const isPreviousProjectItem = slide?.id === nextProjectItem && isFirstSlide && isFirstLine
    if (isPreviousProjectItem && e?.key !== " ") {
        goToNextProjectItem()
        return
    }

    let index: null | number = null

    const showSlides = _show(slide?.id).slides([layout?.[slideIndex]?.id]).get()?.[0]
    const showSlide: Slide | null = slide?.index !== undefined ? showSlides : null

    // lines
    const amountOfLinesToShow: number = getFewestOutputLines()
    const linesIndex: null | number = amountOfLinesToShow && slide ? slide.line || 0 : null
    const slideLines: null | number = showSlide ? getItemWithMostLines(showSlide) : null
    const hasLinesEnded: boolean = slideLines === null || linesIndex === null ? true : linesIndex + amountOfLinesToShow >= slideLines
    if (isLastSlide && !hasLinesEnded) isLastSlide = false

    // item/click reveal
    const clickRevealItems = (showSlide?.items || []).filter((a) => a.clickReveal)
    const itemsRevealed = clickRevealItems.length ? !!slide?.itemClickReveal : true
    if (isLastSlide && !itemsRevealed) isLastSlide = false

    // lines reveal
    const linesRevealItems = (showSlide?.items || []).filter((a) => a.lineReveal)
    const shouldLinesReveal = !!linesRevealItems.length
    const maxRevealLines = getItemWithMostLines({ items: linesRevealItems })
    const currentReveal = slide?.revealCount ?? 0
    const allLinesRevealed = shouldLinesReveal ? currentReveal >= maxRevealLines : true
    if (isLastSlide && !allLinesRevealed) isLastSlide = false

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
        if (get(activeShow)?.type === "section" || !get(showsCache)[currentShow.id] || !getLayoutRef(currentShow.id).length) return goToNextProjectItem()

        const id = loop ? slide?.id : currentShow.id
        if (!id) return

        // layout = GetLayout()
        layout = getLayoutRef(id)
        if (!layout?.filter((a) => !a.data.disabled).length) return

        index = 0
        while (layout[index]?.data.disabled || notBound(layout[index], customOutputId)) index++

        const data = layout[index]?.data
        checkActionTrigger(data, index)
        // allow custom actions to trigger first
        setTimeout(() => {
            setOutput("slide", { id, layout: _show(id).get("settings.activeLayout"), index }, false, customOutputId)
            updateOut(id, index!, layout, !e?.altKey, customOutputId)
        })
        return
    }

    if (!slide || slide.id === "temp") return

    const newSlideOut = { ...slide, line: 0, revealCount: 0, itemClickReveal: itemsRevealed }
    if (!hasLinesEnded || !allLinesRevealed || !itemsRevealed) {
        index = slideIndex
        if (amountOfLinesToShow && linesIndex !== null) newSlideOut.line = linesIndex + amountOfLinesToShow
        if (clickRevealItems.length && !itemsRevealed) newSlideOut.itemClickReveal = true
        else if (shouldLinesReveal) newSlideOut.revealCount = currentReveal + 1
    } else {
        // TODO: Check for loop to beginning slide...
        newSlideOut.itemClickReveal = false
        index = getNextEnabled(slideIndex, end, customOutputId)
    }
    if (index !== null) newSlideOut.index = index

    // go to next show if end
    if (index === null && currentShow?.id === slide?.id && get(showsCache)[currentShow?.id || ""]?.settings.activeLayout === slide.layout) {
        console.log(index, hasLinesEnded, newSlideOut, slide)
        if (PRESENTATION_KEYS_NEXT.includes(e?.key)) goToNextProjectItem(e.key)
        return
    }

    if (index !== null) {
        const data = layout[index]?.data
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
    }
}
function shouldTriggerBefore(action: any) {
    return action.triggers?.find((trigger) => triggerActionsBeforeOutput[trigger]?.(action.actionValues?.[trigger]))
}
export function checkActionTrigger(layoutData: SlideData, slideIndex = 0) {
    layoutData?.actions?.slideActions?.forEach((a) => {
        if (shouldTriggerBefore(a)) runAction(a, { slideIndex })
    })
}

async function goToNextShowInProject(slide, customOutputId) {
    if (!get(activeProject)) return

    // get current project show
    const currentProject = get(projects)[get(activeProject)!]
    // this will get the first show in the project with this id, so it won't work properly with multiple of the same shows in a project
    const projectIndex = currentProject.shows.findIndex((a) => a.id === slide.id)
    if (projectIndex < 0) return

    const currentOutputProjectShowIndex = currentProject.shows[projectIndex]
    if (currentOutputProjectShowIndex.id !== slide.id) return

    const nextShowInProjectIndex = currentProject.shows.findIndex((a, i) => i > projectIndex && (a.type || "show") === "show")
    if (nextShowInProjectIndex < 0) return

    const nextShow = currentProject.shows[nextShowInProjectIndex]
    await loadShows([nextShow.id])
    const activeLayout = nextShow.layout || _show(nextShow.id).get("settings.activeLayout")
    const layout = _show(nextShow.id).layouts([activeLayout]).ref()[0]

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
export function goToNextProjectItem(key = "") {
    // play project media with arrow right if not already playing
    const currentProjectItem = get(projects)[get(activeProject) || ""]?.shows?.[get(activeShow)?.index ?? -1]
    if (currentProjectItem?.type === "video" || currentProjectItem?.type === "image" || currentProjectItem?.type === "player") {
        const outputId = getActiveOutputs(get(outputs), false, true, true)[0]
        const outBg = get(outputs)[outputId]?.out?.background
        if ((outBg?.path || outBg?.id) !== currentProjectItem?.id) {
            return togglePlayingMedia()
        }
    }

    if (changeProjectItemTimeout) return
    changeProjectItemTimeout = setTimeout(() => {
        changeProjectItemTimeout = null

        const currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
        if (!get(activeProject) || typeof currentShow?.index !== "number") return

        let index: number = currentShow.index ?? -1
        if (index + 1 < get(projects)[get(activeProject)!]?.shows?.length) index++
        if (index > -1 && index !== currentShow.index) {
            const newShow = get(projects)[get(activeProject)!].shows[index]
            if (get(focusMode)) activeFocus.set({ id: newShow.id, index, type: newShow.type })
            else activeShow.set({ ...newShow, index })

            if (newShow.type === "section" && PRESENTATION_KEYS_NEXT.includes(key) && (newShow.data?.settings?.triggerAction || get(special).sectionTriggerAction)) {
                let actionId = newShow.data?.settings?.triggerAction
                if (!actionId || !get(actions)[actionId]) actionId = get(special).sectionTriggerAction
                if (actionId) runAction(get(actions)[actionId])
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

        let index: number = currentShow.index ?? get(projects)[get(activeProject)!]?.shows?.length
        if (index - 1 >= 0) index--
        if (index > -1 && index !== currentShow.index) {
            const newShow = get(projects)[get(activeProject)!].shows[index]
            if (get(focusMode)) activeFocus.set({ id: newShow.id, index, type: newShow.type })
            else activeShow.set({ ...newShow, index })

            if (newShow.type === "section" && get(activePage) === "edit") activeEdit.set({ items: [] })

            if (newShow.type === "section" && PRESENTATION_KEYS_PREV.includes(key) && (newShow.data?.settings?.triggerAction || get(special).sectionTriggerAction)) {
                let actionId = newShow.data?.settings?.triggerAction
                if (!actionId || !get(actions)[actionId]) actionId = get(special).sectionTriggerAction
                if (actionId) runAction(get(actions)[actionId])
                return
            }

            // skip if section is empty
            if (newShow.type === "section" && !newShow.notes) goToPreviousProjectItem()
        }
    })
}

// this will go to next for each slide (better for multiple outputs with "Specific outputs")
export function previousSlideIndividual(e: any) {
    getActiveOutputs(get(outputs), true, false, true).forEach((id) => previousSlide(e, id))
}

export function previousSlide(e: any, customOutputId?: string) {
    if (get(outLocked)) return
    if (document.activeElement?.closest(".slide") && !document.activeElement?.closest(".edit")) (document.activeElement as HTMLElement).blur()

    const outputId = customOutputId || getActiveOutputs(get(outputs), true, true, true)[0]
    const currentOutput = get(outputs)[outputId] || {}
    let slide = currentOutput.out?.slide || null
    if (!slide) {
        const cachedSlide: null | OutSlide = get(outputSlideCache)[outputId] || null
        if (cachedSlide && cachedSlide?.id === get(activeShow)?.id && cachedSlide?.layout === get(showsCache)[get(activeShow)?.id || ""]?.settings?.activeLayout) slide = cachedSlide
    }

    // PPT
    if (slide?.type === "ppt") {
        sendMain(Main.PRESENTATION_CONTROL, { action: e?.key === "PageUp" ? "first" : "previous" })
        return
    }

    // PDF
    if ((!slide && get(activeShow)?.type === "pdf") || slide?.type === "pdf") {
        const nextPage = slide?.page ? slide.page - 1 : 0
        playPdf(slide, nextPage)
        return
    }

    // Folder
    if ((!slide && get(activeShow)?.type === "folder") || slide?.type === "folder") {
        const path = slide?.type === "folder" ? slide.id : get(activeShow)?.id || ""
        playFolder(path, true)
        return
    }

    // let layout: SlideData[] = GetLayout(slide ? slide.id : null, slide ? slide.layout : null)
    let layout = _show(slide ? slide.id : "active")
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

    // lines
    const outputWithLines = getFewestOutputLines()
    const amountOfLinesToShow: number = outputWithLines ? outputWithLines : 0
    const linesIndex: null | number = amountOfLinesToShow && slide ? slide.line || 0 : null
    const hasLinesEnded: boolean = !slide || linesIndex === null || linesIndex < 1

    // open previous project item if next has been opened and previous is still active when going back
    const slideIndex: number = slide?.index || 0
    let isLastSlide: boolean = layout && slide ? slideIndex >= layout.filter((a, i) => i < slideIndex || !a?.data?.disabled).length - 1 && !layout[slideIndex]?.data?.end : false
    const showSlide: Slide | null =
        _show(slide ? slide.id : "active")
            .slides([layout[index]?.id])
            .get()[0] || null
    const isLastLine = slide?.line === undefined || !amountOfLinesToShow || !showSlide || slide.line >= Math.ceil(getItemWithMostLines(showSlide) / amountOfLinesToShow) - 1

    // skip disabled slides if clicking previous when another show is selected and no enabled slide is before
    const isFirstSlide: boolean = slide && layout ? layout.filter((a) => !a?.data?.disabled).findIndex((a) => a.layoutIndex === slide?.index) === 0 : false

    const currentShowSlide: Slide | null =
        _show(slide ? slide.id : "active")
            .slides([layout[slide?.index ?? -1]?.id])
            .get()[0] || null

    // item/click reveal
    const clickRevealItems = (currentShowSlide?.items || []).filter((a) => a.clickReveal)
    const itemsRevealed = !!slide?.itemClickReveal
    const clickRevealEnded = !clickRevealItems.length || !itemsRevealed
    if (isFirstSlide && !clickRevealEnded) isLastSlide = false

    // lines reveal
    const linesRevealItems = ((slide?.revealCount ? currentShowSlide?.items : showSlide?.items) || []).filter((a) => a.lineReveal)
    const shouldLinesReveal = !!linesRevealItems.length
    let currentReveal = slide?.revealCount || 0
    const revealEnded = !shouldLinesReveal || currentReveal === 0
    if (isFirstSlide && !revealEnded) isLastSlide = false

    const previousProjectItem = get(projects)[get(activeProject) || ""]?.shows?.[(get(activeShow)?.index ?? -2) - 1]?.id
    const isNextProjectItem = slide?.id === previousProjectItem && isLastSlide && isLastLine
    if (isNextProjectItem) {
        goToPreviousProjectItem()
        return
    }

    // if (!hasLinesEnded && isFirstSlide) isFirstSlide = false
    if (activeShowLayout !== slide?.layout && hasLinesEnded && revealEnded && (index < 0 || isFirstSlide)) {
        slide = null
        layout = getLayoutRef()
        activeLayout = activeShowLayout
        index = (layout?.length || 0) - 1
    }

    let line: number = linesIndex || 0
    let itemClickReveal = true
    if (hasLinesEnded && revealEnded && clickRevealEnded) {
        if (index < 0 || !layout.slice(0, index + 1).filter((a) => !a.data.disabled).length) {
            // go to previous show if out slide at start
            if ((currentShow?.id === slide?.id && activeShowLayout === slide?.layout) || get(activeShow)?.type === "section" || !get(showsCache)[currentShow?.id || ""] || !layout.length) {
                if (PRESENTATION_KEYS_PREV.includes(e?.key)) goToPreviousProjectItem(e.key)
            }
            return
        }

        while (layout[index]?.data.disabled || notBound(layout[index], customOutputId)) index--
        if (!layout[index]) return

        // get slide line
        const slideLines: null | number = showSlide ? getItemWithMostLines(showSlide) : null
        if (amountOfLinesToShow) {
            const maxIndex = slideLines ? amountOfLinesToShow * Math.ceil(slideLines / amountOfLinesToShow) : 0
            line = maxIndex ? maxIndex - amountOfLinesToShow : 0
        }
        if (shouldLinesReveal) {
            const maxRevealLines = getItemWithMostLines({ items: linesRevealItems })
            currentReveal = maxRevealLines
        } else currentReveal = 0
        itemClickReveal = true
    } else {
        index = slide!.index!
        if (amountOfLinesToShow) line -= amountOfLinesToShow
        if (shouldLinesReveal) currentReveal--
        if (!shouldLinesReveal || currentReveal < 0) itemClickReveal = false
    }
    currentReveal = Math.max(0, currentReveal)

    const data = layout[index]?.data
    checkActionTrigger(data, index)
    // allow custom actions to trigger first
    setTimeout(() => {
        if (slide) setOutput("slide", { ...slide, index, line, revealCount: currentReveal, itemClickReveal }, false, customOutputId)
        else if (currentShow) setOutput("slide", { id: currentShow.id, layout: activeLayout, index, line, revealCount: currentReveal, itemClickReveal }, false, customOutputId)

        updateOut(slide ? slide.id : "active", index!, layout, !e?.altKey, customOutputId)
    })
}

// skip slides that are bound to specific output not customId
function notBound(ref, outputId: string | undefined) {
    return outputId && ref?.data?.bindings?.length && !ref?.data?.bindings.includes(outputId)
}

async function playPdf(slide: null | OutSlide, nextPage: number) {
    const data = slide || get(activeShow)
    if (!data?.id) return

    GlobalWorkerOptions.workerSrc = "./assets/pdf.worker.min.mjs"
    const loadingTask = getDocument(data.id)
    const pdfDoc = await loadingTask.promise
    const pages = pdfDoc.numPages
    loadingTask.destroy()
    if (nextPage > pages - 1) return

    const name = data?.name || get(projects)[get(activeProject) || ""]?.shows[get(activeShow)?.index || 0]?.name

    setOutput("slide", { type: "pdf", id: data.id, page: nextPage, pages, name })
    clearBackground()
}

function getNextEnabled(index: null | number, end = false, customOutputId = ""): null | number {
    if (index === null || isNaN(index)) return null

    index++

    const outputId = customOutputId || getActiveOutputs(get(outputs), true, true, true)[0]
    const currentOutput = get(outputs)[outputId] || {}
    const slide = currentOutput.out?.slide || null
    const layout = _show(slide ? slide.id : "active")
        .layouts(slide ? [slide.layout] : "active")
        .ref()[0]

    if (layout?.[index - 1]?.data?.end) index = 0
    if (!layout?.[index]) return null
    if (index >= layout.length || !layout.slice(index, layout.length).filter((a) => !a.data.disabled).length) return null

    while ((layout[index]?.data.disabled || notBound(layout[index], customOutputId)) && index < layout.length) index++

    if (end) {
        index = layout.length - 1
        while ((layout[index]?.data.disabled || notBound(layout[index], customOutputId)) && index > 0) index--
    }

    if (!layout[index]) return null
    return index
}

// go to random slide in current project
export function randomSlide() {
    if (get(outLocked)) return

    const outputId = getActiveOutputs(get(outputs), true, true, true)[0]
    const currentOutput = get(outputs)[outputId] || {}
    const slide = currentOutput.out?.slide || null
    const currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
    const showId = slide?.id || currentShow?.id
    if (!showId) return

    const layoutId = slide?.layout || _show(showId).get("settings.activeLayout")
    const layout = _show(showId).layouts([layoutId]).ref()[0]

    const slideCount = layout.length || 0
    if (slideCount < 2) return

    const currentSlideIndex = slide?.index ?? -1

    // get new random index that is not the currently selected one
    let randomIndex = -1
    do {
        randomIndex = randomNumber(slideCount)
    } while (randomIndex === currentSlideIndex)

    // play slide
    const data = layout[randomIndex]?.data
    checkActionTrigger(data, randomIndex)
    // allow custom actions to trigger first
    setTimeout(() => {
        setOutput("slide", { id: showId, layout: layoutId, index: randomIndex }, false)
        updateOut(showId, randomIndex, layout)
    })
}
function randomNumber(end: number) {
    return Math.floor(Math.random() * end)
}

export function updateOut(showId: string, index: number, layout: LayoutRef[], extra = true, specificOutputId = "", actionTimeout = 10) {
    if (get(activePage) !== "edit") activeEdit.set({ slide: index, items: [] })

    _show(showId).set({ key: "timestamps.used", value: new Date().getTime() })
    if (!layout) return
    const data = layout[index]?.data

    // holding "alt" key will disable all extra features
    if (!extra || !data) return

    // trigger start show action first
    const startShowId = data.actions?.startShow?.id || data.actions?.slideActions?.find((a) => a.actionValues?.start_show)?.id
    if (startShowId) {
        startShow(startShowId)
        return
    }

    // get output slide
    const outputIds = specificOutputId ? [specificOutputId] : data.bindings?.length ? data.bindings : getActiveOutputs(get(outputs), true, false, true)

    // WIP custom next slide timer duration (has to be changed on slide click & in preview as well)
    // let outputWithLine = outputIds.find((id: string) => get(outputs)[id].out?.slide?.line !== undefined)
    // let outSlide = get(outputs)[outputWithLine]?.out?.slide || {}
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
                const outputStyle = get(styles)[get(outputs)[outputId]?.style || ""]
                const mediaStyle = getMediaStyle(get(media)[bgPath], outputStyle)
                const loop = bg.loop !== false
                const muted = bg.muted !== false

                const bgData = {
                    name,
                    type,
                    path: bgPath,
                    cameraGroup: bg.cameraGroup || "",
                    id: bg.id || bgPath, // path = cameras
                    loop,
                    muted,
                    ...mediaStyle,
                    ignoreLayer: mediaStyle.videoType === "foreground"
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
                    const a = clone(_show(showId).get("media")[audio])
                    const cloudId = get(driveData).mediaId
                    if (cloudId && cloudId !== "default") a.path = a.cloud?.[cloudId] || a.path

                    if (a) AudioPlayer.start(a.path, { name: a.name }, { pauseIfPlaying: false })
                })
            }, 200)
        }

        // effects
        if (data.effects?.length) {
            // let clear action trigger first
            setTimeout(() => {
                setOutput("effects", data.effects, false, outputId, true)
            }, 200)
        }

        // overlays
        if (data.overlays?.length) {
            // let clear action trigger first
            setTimeout(() => {
                // send overlays again, because it sometimes don't have it for some reason
                send(OUTPUT, ["OVERLAYS"], get(overlays))

                setOutput("overlays", data.overlays, false, outputId, true)
            }, 200)
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
        if (data.actions.outputStyle) changeOutputStyle(data.actions as any)
        if (data.actions.startTimer) playSlideTimers({ showId, slideId: layout[index].id, overlayIds: data.overlays || [] })
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
            clearTimers(outputId, false)
        }
    }
}

const runPerOutput = ["clear_background", "clear_overlays"]
function playSlideActions(slideActions: SlideAction[], outputIds: string[] = [], slideIndex = -1) {
    slideActions = clone(slideActions)

    // run these actions on each active output
    if (outputIds.length > 1) {
        runPerOutput.forEach((id) => {
            const existingIndex = slideActions.findIndex((a) => a.triggers?.[0] === id)
            if (existingIndex < 0) return

            outputIds.forEach((outputId) => {
                if (id.includes("background")) setOutput("background", null, false, outputId)
                else if (id.includes("overlays")) clearOverlays(outputId)
            })
            slideActions.splice(existingIndex, 1)
        })
    }

    slideActions.forEach((a) => {
        // no need to "re-run" actions triggered right before output
        if (shouldTriggerBefore(a)) return

        runAction(a, { slideIndex })
    })

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

    await loadShows([showId])
    if (!get(showsCache)[showId]) return
    const activeLayout = get(showsCache)[showId].settings?.activeLayout || ""

    // slideClick() - Slides.svelte
    const slideRef = getLayoutRef(showId)
    if (!slideRef[0]) return

    setOutput("slide", { id: showId, layout: activeLayout, index: 0, line: 0 })
    // timeout has to be 1200 to let output data update properly (in case slide has special actions)
    updateOut(showId, 0, slideRef, true, "", 1200)
}

export function changeOutputStyle(data: API_output_style) {
    // pre 1.5.0 (deprecated)
    let outputStyle: string | undefined = (data as any).outputStyle
    const styleOutputs: any = (data as any).styleOutputs
    if (outputStyle || styleOutputs) {
        const type = styleOutputs?.type || "active"
        const outputsList = styleOutputs?.outputs || []

        const chosenOutputs = getActiveOutputs(get(outputs), type === "active", true, true)
        chosenOutputs.forEach(changeStyle)

        function changeStyle(outputId: string) {
            if (type === "specific") outputStyle = outputsList[outputId]
            if (!outputStyle) return

            outputs.update((a) => {
                a[outputId].style = outputStyle

                return a
            })
        }
    }
    ///

    const outputIds = data.outputId ? [data.outputId] : getActiveOutputs(get(outputs), false, true, true)
    outputs.update((a) => {
        outputIds.forEach((outputId) => {
            a[outputId].style = data.styleId || ""
        })
        return a
    })


    refreshOut()
}

export function playNextGroup(globalGroupIds: string[], { showRef, outSlide, currentShowId }, extra = true) {
    if (!globalGroupIds.length || get(outLocked)) return

    // play first matching group
    let nextAfterOutput
    let index
    showRef.forEach((ref) => {
        // if (ref.id !== slideId) return
        if (!globalGroupIds.includes(ref.id) || ref.data?.disabled) return

        // get next slide if global group is outputted
        if (index === undefined) index = ref.layoutIndex
        if (outSlide?.index === undefined || nextAfterOutput || ref.layoutIndex <= outSlide.index) return

        nextAfterOutput = ref.layoutIndex
    })

    if (nextAfterOutput) index = nextAfterOutput
    if (index === undefined) return

    // WIP duplicate of "slideClick" in Slides.svelte
    const data = showRef[index]?.data
    checkActionTrigger(data, index)
    // allow custom actions to trigger first
    setTimeout(() => {
        setOutput("slide", { id: currentShowId, layout: _show(currentShowId).get("settings.activeLayout"), index, line: 0 })
        updateOut(currentShowId, index, showRef, extra, "")
    })

    setTimeout(() => {
        // defocus search input
        ; (document.activeElement as any)?.blur()
    }, 10)

    return true
}

// go to next slide if current output slide has nextAfterMedia action
const nextActive: string[] = []
export function checkNextAfterMedia(endedId: string, type: "media" | "audio" | "timer" = "media", outputId = "") {
    if (nextActive.includes(outputId)) return false

    nextActive.push(outputId)
    setTimeout(() => {
        nextActive.splice(nextActive.indexOf(outputId), 1)
    }, 600) // MAKE SURE NEXT SLIDE HAS TRANSITIONED

    if (!outputId) outputId = getActiveOutputs(get(outputs), true, true, true)[0]
    if (!outputId) return false

    const currentOutput = get(outputs)[outputId]
    if (!currentOutput) return false

    const slideOut = currentOutput.out?.slide
    if (!slideOut) return false

    const layoutSlide = _show(slideOut.id).layouts([slideOut.layout]).ref()[0]?.[slideOut.index ?? -1]
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
        const slideTimer = slide?.items?.find((a) => a.type === "timer" && (a.timer?.id || a.timerId) === endedId)
        if (!slideTimer) return false
    }

    const nextAfterMedia = layoutSlide?.data?.actions?.nextAfterMedia
    if (!nextAfterMedia) return false

    // WIP PAUSE PLAYING VIDEO WHEN ENDED, so it does not loop to start
    const loop = layoutSlide?.data?.end
    nextSlide(null, false, false, loop, true, outputId, !loop)

    return true
}

export function playSlideTimers({ showId = "active", slideId = "", overlayIds = [] as string[] }) {
    if (!slideId) {
        const outSlide: OutSlide | null = get(outputs)[getActiveOutputs(get(outputs), false, true, true)[0]]?.out?.slide || null
        if (!outSlide) return

        showId = outSlide.id || ""

        const layoutRef = _show(showId).layouts([outSlide.layout]).ref()[0]
        if (!layoutRef) return
        slideId = layoutRef[outSlide.index ?? -1]?.id || ""
    }

    const showSlides: { [key: string]: Slide } = _show(showId).get("slides") || {}
    const slide = showSlides[slideId]
    if (!slide) return

    // find all timers in current slide & any overlay placed on the slide
    const slideItems = slide.items || []
    const allOverlayItems = overlayIds.map((id: string) => get(overlays)[id]?.items).flat()
    const items = [...slideItems, ...allOverlayItems]

    items.forEach((item) => {
        if (item.type !== "timer") return
        const timerId = item.timer?.id || item.timerId || ""
        playPauseGlobal(timerId, get(timers)[timerId], true)
    })
}

export function sendMidi(data: any) {
    sendMain(Main.SEND_MIDI, data)
}

export function activateTriggerSync(triggerId: string) {
    activateTrigger(triggerId)
}

export async function activateTrigger(triggerId: string): Promise<string> {
    const trigger = get(triggers)[triggerId]
    if (!trigger) return ""

    if (!customTriggers[trigger.type]) {
        console.error("Missing trigger:", trigger.type)
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
    }
}

// DYNAMIC VALUES

export const dynamicValueText = (id: string) => `{${id}}`
export function getDynamicIds(noVariables = false) {
    const mainValues = Object.keys(dynamicValues)
    const metaValues = Object.keys(getCustomMetadata()).map((id) => `meta_${id.replaceAll(" ", "_").toLowerCase()}`)

    const mergedValues = [...mainValues, ...metaValues]
    if (noVariables) return mergedValues

    const timersList = sortByName(Object.values(get(timers))).map(({ name }) => `timer_${getVariableNameId(name)}`)

    const rssValues = sortByName(get(special).dynamicRSS || []).map(({ name }) => `rss_${getVariableNameId(name)}`)

    if (timersList.length) mergedValues.push(...timersList)
    if (rssValues.length) mergedValues.push(...rssValues)
    mergedValues.push(...getVariablesIds())
    return mergedValues
}

export function getVariablesIds() {
    // WIP sort by type?
    const variablesList = sortByName(Object.values<Variable>(get(variables)).filter((a) => a?.name))
    const variableValues = variablesList.filter((a) => a.type !== "text_set").map(({ name }) => `$${getVariableNameId(name)}`)
    const variableSetNameValues = variablesList.filter((a) => a.type === "random_number" && (a.sets?.length || 0) > 1).map(({ name }) => `variable_set_${getVariableNameId(name)}`)

    const variableTextSets: string[] = []
    variablesList
        .filter((a) => a.type === "text_set")
        .forEach((set) => {
            const name = `$` + getVariableNameId(set.name)
            set.textSetKeys?.filter(Boolean).forEach((key) => {
                variableTextSets.push(`${name}__${getVariableNameId(key)}`)
            })
        })

    return [...variableValues, ...variableSetNameValues, ...variableTextSets]
}

export function getVariableValue(dynamicId: string, ref: any = null) {
    if (dynamicId.includes("variable_set_")) {
        const nameId = dynamicId.slice(13)
        const variable = Object.values(get(variables)).find((a) => getVariableNameId(a.name) === nameId)
        if (variable?.type !== "random_number") return ""

        return variable.setName || ""
    }

    if (dynamicId.includes("$") || dynamicId.includes("variable_")) {
        const nameId = dynamicId.includes("$") ? dynamicId.slice(1) : dynamicId.slice(9)
        let variable = Object.values(get(variables)).find((a) => getVariableNameId(a.name) === nameId)

        if (!variable && nameId.includes("__")) {
            const textSetId = nameId.slice(0, nameId.indexOf("__"))
            variable = Object.values(get(variables)).find((a) => getVariableNameId(a.name) === textSetId)
        }
        if (!variable) return ""

        if (variable.type === "number") return Number(variable.number || 0).toString()
        if (variable.type === "random_number") return (variable.number || 0).toString().padStart(getSetChars(variable.sets), "0")
        if (variable.type === "text_set") {
            const currentSet = variable.textSets?.[variable.activeTextSet ?? 0] || {}
            const setId = nameId.slice(nameId.indexOf("__") + 2)
            const setName = variable.textSetKeys?.find((name) => getVariableNameId(name) === setId) || ""
            return currentSet[setName] || ""
        }

        if (variable.enabled === false) return ""
        if (variable.text?.includes(dynamicId) || !ref) return variable.text || ""
        return replaceDynamicValues(variable.text || "", ref)
    }

    return ""
}

export function replaceDynamicValues(text: string, { showId, layoutId, slideIndex, type, id }: any, _updater = 0) {
    const isOutputWindow = get(currentWindow) === "output"

    if (type === "stage") {
        const stageLayoutId: string = isOutputWindow ? Object.values(get(outputs))[0]?.stageOutput || id : id
        const stageOutput = get(stageShows)[stageLayoutId]?.settings?.output
        const outputId = stageOutput || getActiveOutputs(isOutputWindow ? get(allOutputs) : get(outputs), false, true, true)[0]
        const outSlide = (isOutputWindow ? get(allOutputs) : get(outputs))[outputId]?.out?.slide
        showId = outSlide?.id
        slideIndex = outSlide?.index ?? -1
    }

    const currentShow = _show(showId).get()
    if (type === "show" && !currentShow) return ""

    const customIds = ["slide_text_current", "active_layers", "active_styles"]
        ;[...getDynamicIds(), ...customIds].forEach((dynamicId) => {
            let textHasValue = text.includes(dynamicValueText(dynamicId))
            if (dynamicId.includes("$") && text.includes(dynamicValueText(dynamicId.replace("$", "variable_")))) textHasValue = true
            if (!textHasValue) return

            const newValue = getDynamicValueText(dynamicId, currentShow)
            text = text.replaceAll(dynamicValueText(dynamicId), newValue)

            // $ = variable_
            if (dynamicId.includes("$")) text = text.replaceAll(dynamicValueText(dynamicId.replace("$", "variable_")), newValue)
        })

    return text

    function getDynamicValueText(dynamicId: string, show: Show | object): string {
        // VARIABLE
        if (dynamicId.includes("variable_set_") || dynamicId.includes("$") || dynamicId.includes("variable_")) {
            return getVariableValue(dynamicId, { showId, layoutId, slideIndex, type, id: dynamicId })
        }

        if (dynamicId.includes("timer_")) {
            const nameId = dynamicId.slice(6)
            const timer = keysToID(get(timers)).find((a) => getVariableNameId(a.name) === nameId)
            if (!timer) return "00:00"

            const today = new Date()
            const currentTime = getCurrentTimerValue(timer, { id: timer.id }, today)
            const timeValue = joinTimeBig(typeof currentTime === "number" ? currentTime : 0)

            return timeValue
        }

        if (dynamicId.includes("rss_")) {
            const nameId = dynamicId.slice(4)
            const rss = get(special).dynamicRSS?.find((a) => getVariableNameId(a.name) === nameId)
            if (!rss) return ""

            return convertRSSToString(getRSS(rss.url, rss.updateInterval), rss.divider, rss.count)
        }

        let outputId: string = getActiveOutputs(get(outputs), false, true, true)[0]

        if (dynamicId.includes("video_") && isOutputWindow) {
            send(OUTPUT, ["MAIN_REQUEST_VIDEO_DATA"], { id: outputId })
        }

        // set to normal output, if stage output, for video time
        const stageLayout = get(outputs)[outputId].stageOutput
        if (stageLayout) outputId = get(stageShows)[stageLayout]?.settings?.output || getActiveOutputs(get(allOutputs), false, true, true)[0]

        const outSlide: OutSlide | null = get(outputs)[outputId]?.out?.slide || null

        if (!showId) {
            showId = outSlide?.id
            layoutId = outSlide?.layout
            slideIndex = outSlide?.index ?? -1
            show = _show(showId).get() || {}
        }
        if (!show) show = {}

        // META
        if (dynamicId.includes("meta_")) {
            const key = dynamicId.slice(5).replaceAll("_", " ")
            if (!Object.keys(show)) return ""
            let customKey = get(customMetadata).custom.find((a) => a.toLowerCase() === key) || key
            if (customKey === "ccli") customKey = "CCLI"
            return (show as Show).meta?.[customKey] || ""
        }

        const activeLayout = layoutId ? [layoutId] : "active"
        const ref = _show(showId).layouts(activeLayout).ref()[0] || []
        const layout = _show(showId).layouts(activeLayout).get()[0] || {}

        const videoTime: number = get(videosTime)[outputId] || 0
        const videoDuration: number = get(videosData)[outputId]?.duration || 0

        const playingAudioIds = AudioPlayer.getAllPlaying(false)
        const activeAudio = get(playingAudio)[playingAudioIds[0]]?.audio
        const audioTime = (isOutputWindow ? get(dynamicValueData).audioTime : activeAudio?.currentTime) || 0
        const audioDuration = (isOutputWindow ? get(dynamicValueData).audioDuration : activeAudio?.duration) || 0

        let projectIndex = get(projects)[get(activeProject) || ""]?.shows?.findIndex((a) => a.id === showId)
        if (projectIndex < 0) projectIndex = get(activeShow)?.index ?? -2
        const projectRef = { id: get(activeProject) || "", index: projectIndex }

        const audioPath = playingAudioIds[playingAudioIds.length - 1] // get newest

        // custom - only from external source (Companion)
        // or used to set variable value: https://github.com/ChurchApps/FreeShow/issues/1720
        if (dynamicId === "slide_text_current") {
            return getTextLines(outSlide?.id === "temp" ? { items: outSlide?.previousSlides } : (show as any).slides?.[ref[slideIndex]?.id]).join("<br>")
        } else if (dynamicId === "active_layers") {
            const backgroundActive = !isOutCleared("background")
            const slideActive = !isOutCleared("slide")
            const overlaysActive = !isOutCleared("overlays")
            const audioActive = Object.keys(get(playingAudio)).length || get(playingMetronome)
            return [backgroundActive ? "background" : "", slideActive ? "slide" : "", overlaysActive ? "overlays" : "", audioActive ? "audio" : ""].filter(Boolean).join(", ")
        } else if (dynamicId === "active_styles") {
            const activeOutputIds = getActiveOutputs(get(outputs), false, true, true)
            const outputStyeIds = activeOutputIds.map((oId) => get(outputs)[oId].style || "").filter(Boolean)
            const outputStyleNames = outputStyeIds.map((styleId) => get(styles)[styleId]?.name).filter(Boolean)
            return outputStyleNames.sort((a, b) => a.localeCompare(b)).join(", ")
        }

        if (!dynamicValues[dynamicId]) return ""

        const value = (dynamicValues[dynamicId]({ show, ref, slideIndex, layout, projectRef, outSlide, videoTime, videoDuration, audioTime, audioDuration, audioPath }) ?? "").toString()

        if (dynamicId === "show_name_next" && !value && isOutputWindow) {
            send(OUTPUT, ["MAIN_SHOWS_DATA"])
        }

        // send data to output
        const sendToOutput = ["audio_time", "audio_countdown", "audio_duration"]
        if (sendToOutput.includes(dynamicId) && !get(currentWindow)) {
            send(OUTPUT, ["DYNAMIC_VALUE_DATA"], { audioTime, audioDuration })
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
    // time_weeknum: () => "52",

    time_str_day: () => getWeekday(new Date().getDay(), get(dictionary), true),
    time_str_month: () => getMonthName(new Date().getMonth(), get(dictionary), true),

    // show
    show_name: ({ show }) => show.name || "",
    show_name_next: ({ projectRef }) => get(shows)[get(projects)[projectRef.id]?.shows?.[projectRef.index + 1]?.id]?.name || "",

    layout_slides: ({ ref }) => ref.length,
    layout_notes: ({ layout }) => layout.notes || "",

    slide_number: ({ slideIndex }) => (Number(slideIndex ?? -1) + 1).toString(),
    slide_group: ({ show, ref, slideIndex, outSlide }) => {
        const parentIndex = ref[slideIndex]?.parent?.layoutIndex ?? slideIndex
        const group = show.slides?.[ref[parentIndex]?.id]?.group || ""
        return getGroupName({ show, showId: outSlide?.id }, ref[parentIndex]?.id, group, parentIndex, false, false)
    },
    slide_group_next: ({ show, ref, slideIndex, outSlide }) => {
        const parentIndex = ref[slideIndex + 1]?.parent?.layoutIndex ?? slideIndex + 1
        const group = show.slides?.[ref[parentIndex]?.id]?.group || ""
        return getGroupName({ show, showId: outSlide?.id }, ref[parentIndex]?.id, group, parentIndex, false, false)
    },
    slide_group_upcomming: ({ show, ref, slideIndex, outSlide }) => {
        if (slideIndex < 0) return ""
        let nextParentIndex = slideIndex + 1
        while (ref[nextParentIndex]?.type !== "parent" && nextParentIndex < ref.length) nextParentIndex++
        const group = show.slides?.[ref[nextParentIndex]?.id]?.group || ""
        return getGroupName({ show, showId: outSlide?.id }, ref[nextParentIndex]?.id, group, nextParentIndex, false, false)
    },
    slide_notes: ({ show, ref, slideIndex }) => show.slides?.[ref[slideIndex]?.id]?.notes || "",
    slide_notes_next: ({ show, ref, slideIndex }) => show.slides?.[ref[slideIndex + 1]?.id]?.notes || "",

    // text
    slide_text_previous: ({ show, ref, slideIndex, outSlide }) => getTextLines(outSlide?.id === "temp" ? { items: outSlide?.previousSlides } : show.slides?.[ref[slideIndex - 1]?.id]).join("<br>"),
    slide_text_next: ({ show, ref, slideIndex, outSlide }) => getTextLines(outSlide?.id === "temp" ? { items: outSlide?.nextSlides } : show.slides?.[ref[slideIndex + 1]?.id]).join("<br>"),

    // video
    video_time: ({ videoTime }) => joinTime(secondsToTime(videoTime)),
    video_countdown: ({ videoTime, videoDuration }) => joinTime(secondsToTime(videoDuration > 0 ? videoDuration - videoTime : 0)),
    video_duration: ({ videoDuration }) => joinTime(secondsToTime(videoDuration)),

    // audio
    audio_title: ({ audioPath }) => getMetadata(audioPath).title || removeExtension(getFileName(audioPath)) || "",
    audio_subtitle: ({ audioPath }) => (getMetadata(audioPath).subtitle || []).join(", "),
    audio_artist: ({ audioPath }) => getArtist(getMetadata(audioPath)),
    audio_album: ({ audioPath }) => getMetadata(audioPath).album || "",
    audio_genre: ({ audioPath }) => (getMetadata(audioPath).genre || []).join(", "),
    audio_year: ({ audioPath }) => getMetadata(audioPath).date || "",
    // audio_cover: ({audioPath}) => getMetadata(audioPath).picture?.[0].data, // buffer
    // disk: {no: null, of: null}
    // track: {no: null, of: null}
    audio_time: ({ audioTime }) => joinTime(secondsToTime(audioTime)),
    audio_countdown: ({ audioTime, audioDuration }) => joinTime(secondsToTime(audioDuration > 0 ? audioDuration - audioTime : 0)),
    audio_duration: ({ audioDuration }) => joinTime(secondsToTime(audioDuration)),
    audio_volume: () => AudioPlayer.getVolume() * 100
}

export function getVariableNameId(name: string) {
    return name.toLowerCase().trim().replaceAll(" ", "_")
}

export function getNumberVariables(variableUpdater = get(variables), _dynamicUpdaters: any = null) {
    const numberVariables = Object.values(variableUpdater).filter((a) => a.type === "number" || a.type === "random_number" || (a.type === "text" && a.text?.includes("{")))
    return numberVariables.reduce((css, v) => (css += `--variable-${getVariableNameId(v.name)}: ${v.type === "text" ? getDynamicValue(v.text || "") : (v.number ?? (v.default || 0))};`), "")
}

// AUDIO METADATA

function getMetadata(audioPath: string) {
    return get(audioData)[audioPath]?.metadata || {}
}

function getArtist(metadata: ICommonTagsResult) {
    const artists = [metadata.originalartist, metadata.artist, metadata.albumartist, ...(metadata.artists || [])].filter(Boolean)
    return [...new Set(artists)].join(", ")
}
