import { get } from "svelte/store"
import { MAIN, OUTPUT } from "../../../types/Channels"
import type { OutSlide, Slide } from "../../../types/Show"
import { send } from "../../utils/request"
import { playPauseGlobal } from "../drawer/timers/timers"
import { activeEdit, activePage, activeProject, activeShow, activeTimers, lockedOverlays, media, outLocked, outputCache, outputs, overlays, playingAudio, projects, showsCache, slideTimers, styles, timers } from "./../../stores"
import { clearAudio, playAudio } from "./audio"
import { getMediaType } from "./media"
import { getActiveOutputs, isOutCleared, setOutput } from "./output"
import { _show } from "./shows"
import { loadShows } from "./setShow"
import { clone } from "./array"

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

    let selectItem: "next" | "previous" = e.key === "ArrowDown" ? "next" : "previous"
    selectProjectShow(selectItem)
}

export function selectProjectShow(select: number | "next" | "previous") {
    let shows = get(projects)[get(activeProject)!].shows
    let index: null | number = get(activeShow)?.index !== undefined ? get(activeShow)!.index! : null
    let newIndex: number | null = typeof select === "number" ? select : getProjectIndex[select](index, shows)

    if (newIndex === null || !shows[newIndex]) return

    // show
    if (get(showsCache)[shows[newIndex].id]) swichProjectItem(newIndex, shows[newIndex].id)

    // set active show in project list
    if (newIndex !== index) activeShow.set({ ...shows[newIndex], index: newIndex })
}

export function swichProjectItem(pos: number, id: string) {
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
        a[get(activeProject)!].shows[pos!].layout = get(showsCache)[id].settings.activeLayout
        return a
    })
}

export function getItemWithMostLines(slide: Slide) {
    let amount: number = 0
    slide.items?.forEach((item) => {
        console.log(item.lines)
        let lines: number = item.lines?.filter((a) => a.text.filter((a) => a.value.length)?.length)?.length || 0
        if (lines > amount) amount = lines
    })
    return amount
}

// TODO: multiple outputs with different lines!
function getOutputWithLines() {
    let outs = getActiveOutputs()

    let currentLines = 0
    outs.forEach((id: string) => {
        let output = get(outputs)[id]
        if (!output.style) return

        let style = get(styles)[output.style]
        if (!style) return
        let lines = style.lines
        if (!lines) return

        if (lines > currentLines) currentLines = lines
    })

    return currentLines
}

export function nextSlide(e: any, start: boolean = false, end: boolean = false, loop: boolean = false, bypassLock: boolean = false, customOutputId: string | null = null) {
    if (get(outLocked) && !bypassLock) return
    if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

    let outputIds = customOutputId ? [customOutputId] : getActiveOutputs()
    outputIds.forEach(triggerInOutput)

    // let currentOutput: any = get(outputs)[getActiveOutputs()[0]]
    // if (customOutputId) currentOutput = get(outputs)[customOutputId]

    function triggerInOutput(outputId: string) {
        let currentOutput: any = get(outputs)[outputId]
        let slide: null | OutSlide = currentOutput.out?.slide || null
        console.log(slide)

        // let layout: SlideData[] = GetLayout(slide ? slide.id : null, slide ? slide.layout : null)
        let layout: any[] = _show(slide ? slide.id : "active")
            .layouts(slide ? [slide.layout] : "active")
            .ref()[0]
        let isLastSlide: boolean = slide && layout ? slide.index === layout.length - 1 && !layout[slide.index].end : false
        let index: null | number = null

        // lines
        let amountOfLinesToShow: number = getOutputWithLines() ? getOutputWithLines() : 0
        let linesIndex: null | number = amountOfLinesToShow && slide ? slide.line || 0 : null
        let showSlide: any = slide?.index !== undefined ? _show(slide.id).slides([layout[slide.index].id]).get()[0] : null
        let slideLines: null | number = showSlide ? getItemWithMostLines(showSlide) : null
        let currentLineStart: number = slideLines ? slideLines - (amountOfLinesToShow! % slideLines) : 0
        let hasLinesEnded: boolean = slideLines === null || linesIndex === null ? true : slideLines <= amountOfLinesToShow || amountOfLinesToShow! * linesIndex >= currentLineStart
        if (isLastSlide && !hasLinesEnded) isLastSlide = false

        // TODO: active show slide index on delete......

        // go to beginning if live mode & ctrl | no output | last slide active
        if (get(activeShow) && (start || !slide || e?.ctrlKey || (isLastSlide && (get(activeShow)!.id !== slide?.id || get(showsCache)[get(activeShow)!.id]?.settings.activeLayout !== slide.layout)))) {
            let id = loop ? slide?.id : get(activeShow)?.id
            if (!id) return

            // layout = GetLayout()
            layout = _show(id).layouts("active").ref()[0]
            if (!layout?.filter((a) => !a.data.disabled).length) return

            index = 0
            while (layout[index].data.disabled) index++

            setOutput("slide", { id, layout: _show(id).get("settings.activeLayout"), index }, false, outputId)
            updateOut(id, index, layout, !e?.altKey, outputId)
            return
        }

        if (!slide || slide.id === "temp") return

        let newSlideOut: any = { ...slide, line: 0 }
        if (!hasLinesEnded) {
            index = slide.index!
            newSlideOut.line = linesIndex! + 1
        } else {
            // TODO: Check for loop to beginning slide...
            index = getNextEnabled(slide.index!, end)
        }
        newSlideOut.index = index

        // go to next show if end
        if (index === null && get(activeShow)!.id === slide.id && get(showsCache)[get(activeShow)!.id]?.settings.activeLayout === slide.layout) {
            if (e?.key === " ") goToNextProjectItem()
            return
        }

        if (index !== null) {
            setOutput("slide", newSlideOut, false, outputId)
            updateOut(slide ? slide.id : "active", index, layout, !e?.altKey, outputId)
        }
    }
}

export function goToNextProjectItem() {
    if (!get(activeProject)) return

    let index: number = typeof get(activeShow)?.index === "number" ? get(activeShow)!.index! : -1
    if (index + 1 < get(projects)[get(activeProject)!].shows.length) index++
    if (index > -1 && index !== get(activeShow)?.index) activeShow.set({ ...get(projects)[get(activeProject)!].shows[index], index })
}

export function previousSlide() {
    if (get(outLocked)) return
    if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

    let currentOutput: any = get(outputs)[getActiveOutputs()[0]]
    let slide: null | OutSlide = currentOutput.out?.slide || null
    // let layout: SlideData[] = GetLayout(slide ? slide.id : null, slide ? slide.layout : null)
    let layout: any[] = _show(slide ? slide.id : "active")
        .layouts(slide ? [slide.layout] : "active")
        .ref()[0]
    let activeLayout: string = _show(slide ? slide.id : "active").get("settings.activeLayout")
    let index: number | null = slide?.index !== undefined ? slide.index - 1 : layout ? layout.length - 1 : null
    if (index === null) return

    // lines
    let outputWithLines = getOutputWithLines()
    let amountOfLinesToShow: number = outputWithLines ? outputWithLines : 0
    let linesIndex: null | number = amountOfLinesToShow && slide ? slide.line || 0 : null
    let hasLinesEnded: boolean = !slide || linesIndex === null || linesIndex < 1

    let line: number = linesIndex || 0
    if (hasLinesEnded) {
        if (index < 0 || !layout.slice(0, index + 1).filter((a) => !a.data.disabled).length) return
        while (layout[index].data.disabled) index--

        // get slide line
        let showSlide: any = _show(slide ? slide.id : "active")
            .slides([layout[index].id])
            .get()[0]
        let slideLines: null | number = showSlide ? getItemWithMostLines(showSlide) : null
        // line = slideLines ? (amountOfLinesToShow >= slideLines ? 0 : slideLines - (amountOfLinesToShow % slideLines) - 1) : 0
        line = slideLines ? slideLines - 1 : 0
    } else {
        index = slide!.index!
        line--
    }

    if (slide) setOutput("slide", { ...slide, index, line })
    else if (get(activeShow)) setOutput("slide", { id: get(activeShow)!.id, layout: activeLayout, index })

    updateOut(slide ? slide.id : "active", index, layout)
}

function getNextEnabled(index: null | number, end: boolean = false): null | number {
    if (index === null) return null

    index++

    let currentOutput: any = get(outputs)[getActiveOutputs()[0]]
    let slide: null | OutSlide = currentOutput.out?.slide || null
    let layout: any[] = _show(slide ? slide.id : "active")
        .layouts(slide ? [slide.layout] : "active")
        .ref()[0]

    if (layout[index - 1]?.data.end) index = 0
    if (!layout[index]) return null
    if (index >= layout.length || !layout.slice(index, layout.length).filter((a) => !a.data.disabled).length) return null

    while (layout[index].data.disabled && index < layout.length) index++

    if (end) {
        index = layout.length - 1
        while (layout[index].data.disabled && index > 0) index--
    }

    return index
}

export function getMediaFilter(bakgroundPath: string) {
    // let filter = ""
    // let mediaFilter = get(media)[bakgroundPath]?.filter
    // if (mediaFilter) Object.entries(mediaFilter).forEach(([id, a]: any) => (filter += ` ${id}(${a})`))
    // return filter
    return get(media)[bakgroundPath]?.filter || ""
}

export function updateOut(showId: string, index: number, layout: any, extra: boolean = true, outputId: string | null = null) {
    if (get(activePage) !== "edit") activeEdit.set({ slide: index, items: [] })

    _show(showId).set({ key: "timestamps.used", value: new Date().getTime() })
    if (!layout) return
    let data = layout[index]?.data

    // holding "alt" key will disable all extra features
    if (!extra || !data) return

    // trigger start show action first
    if (data.actions?.startShow) {
        startShow(data.actions.startShow?.id)
        return
    }

    // get output slide
    let outputIds = getActiveOutputs()
    let l = outputIds.find((id: string) => get(outputs)[id].show?.lines)
    // don't trigger actions if same slide, but different outputted line
    if (l && get(outputs)[l]?.out?.slide?.line && get(outputs)[l].out!.slide!.line! > 0) return

    let background = data.background

    // get ghost background
    if (!background) {
        layout.forEach((a, i) => {
            if (i <= index && !a.data.disabled) {
                if (a.data.actions?.clearBackground) background = null
                else if (a.data.background) background = a.data.background
            }
        })
    }

    // background
    if (background) {
        let bg = _show(showId).get("media")[background!]
        let outputBg = get(outputs)[outputIds[0]]?.out?.background

        if (bg && bg.path !== outputBg?.path) {
            let bgData: any = {
                name: bg.name,
                type: bg.type || getMediaType(bg.path.slice(bg.path.lastIndexOf(".") + 1, bg.path.length)),
                path: bg.path,
                cameraGroup: bg.cameraGroup || "",
                id: bg.id || bg.path, // path = cameras
                muted: bg.muted !== false,
                loop: bg.loop !== false,
                filter: getMediaFilter(bg.path),
                flipped: get(media)[bg.path]?.flipped || false,
                fit: get(media)[bg.path]?.fit || "contain",
                speed: get(media)[bg.path]?.speed || "1",
            }
            // outBackground.set(bgData)
            setOutput("background", bgData, false, outputId)
        }
    }

    // overlays
    if (data.overlays?.length) {
        // send overlays again, because it sometimes don't have it for some reason
        send(OUTPUT, ["OVERLAYS"], get(overlays))

        setOutput("overlays", data.overlays, false, outputId, true)
    }

    // audio
    if (data.audio) {
        data.audio.forEach((audio: string) => {
            console.log(audio)
            let a = _show(showId).get("media")[audio]
            if (a) playAudio(a, false)
        })
    }

    // nextTimer
    // clear any active slide timers
    if (outputId) outputIds = [outputId]
    Object.keys(get(slideTimers)).forEach((id) => {
        if (outputIds.includes(id)) get(slideTimers)[id].timer?.clear()
    })

    if ((data.nextTimer || 0) > 0) {
        // outTransition.set({ duration: data.nextTimer })
        setOutput("transition", { duration: data.nextTimer }, false, outputId)
    } else {
        // outTransition.set(null)
        setOutput("transition", null, false, outputId)
    }

    // actions
    if (data.actions) {
        // startShow is at the top
        if (data.actions.sendMidi) sendMidi(_show(showId).get("midi")[data.actions.sendMidi])
        // if (data.actions.nextAfterMedia) // go to next when video/audio is finished
        if (data.actions.outputStyle) changeOutputStyle(data.actions.outputStyle)
        if (data.actions.startTimer) playSlideTimers({ showId: showId, slideId: layout[index].id })
        if (data.actions.stopTimers) activeTimers.set([])
        if (data.actions.clearBackground) setOutput("background", null, false, outputId)
        if (data.actions.clearOverlays) clearOverlays()
        if (data.actions.clearAudio) clearAudio()
    }
}

export async function startShow(showId: string) {
    console.log("start show", showId)
    if (!showId) return

    let show = await loadShows([showId])
    if (show !== "loaded") return

    let activeLayout = get(showsCache)[showId].settings?.activeLayout || ""

    // slideClick() - Slides.svelte
    let slideRef: any = _show(showId).layouts("active").ref()[0]
    updateOut(showId, 0, slideRef)
    setOutput("slide", { id: showId, layout: activeLayout, index: 0, line: 0 })
}

export function changeOutputStyle(styleId: string) {
    let activeOutputs = getActiveOutputs(get(outputs))
    activeOutputs.forEach(changeStyle)

    function changeStyle(outputId: string) {
        outputs.update((a) => {
            a[outputId].style = styleId

            return a
        })
    }
}

export function playNextGroup(globalGroupIds: string[], { showRef, outSlide, currentShowId }, extra: boolean = true) {
    console.log(globalGroupIds)
    // TODO: get groups from midi!!!
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
    setOutput("slide", { id: currentShowId, layout: _show(currentShowId).get("settings.activeLayout"), index, line: 0 })

    setTimeout(() => {
        // defocus search input
        ;(document.activeElement as any)?.blur()
    }, 10)

    return true
}

function playSlideTimers({ showId, slideId }) {
    if (showId === "active") showId = get(activeShow)?.id
    let showSlides: any[] = _show(showId).slides().get()

    // find all timers in current slide
    showSlides.forEach((slide) => {
        if (slide.id !== slideId) return
        let items = slide.items
        items.forEach((item) => {
            if (item.type === "timer" && item.timerId) playPauseGlobal(item.timerId, get(timers)[item.timerId], true)
        })
    })
}

export function sendMidi(data: any) {
    send(MAIN, ["SEND_MIDI"], data)
}

export function clearOverlays() {
    let outs = getActiveOutputs()
    let outOverlays: string[] = get(outputs)[outs[0]]?.out?.overlays || []
    outOverlays = outOverlays.filter((id) => get(overlays)[id]?.locked)
    setOutput("overlays", outOverlays)
    lockedOverlays.set([])
}

// TODO: output/clearButtons
export function clearAll() {
    if (get(outLocked)) return

    let allCleared = isOutCleared(null) && !Object.keys(get(playingAudio)).length
    if (allCleared) return

    // TODO: audio
    if (!get(outputCache)) outputCache.set(clone(get(outputs)))

    // clearVideo()
    setOutput("background", null)
    setOutput("slide", null)
    clearOverlays()
    clearAudio()
    // clearTimers()
    setOutput("transition", null)
}
