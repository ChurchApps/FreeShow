import { get } from "svelte/store"
import { MAIN } from "../../../types/Channels"
import type { OutSlide, Slide } from "../../../types/Show"
import { send } from "../../utils/request"
import { activeEdit, activePage, activeProject, activeShow, media, outLocked, outputs, overlays, projects, showsCache, slideTimers } from "./../../stores"
import { clearAudio, playAudio } from "./audio"
import { getMediaType } from "./media"
import { getActiveOutputs, setOutput } from "./output"
import { _show } from "./shows"

const keys: any = {
    ArrowDown: (index: number | null, shows: any) => {
        // change active show in project
        if (index === null) return 0
        index = shows.findIndex((_a: any, i: number) => i - 1 === index)
        return index === null || index < 0 ? null : index
    },
    ArrowUp: (index: number | null, shows: any) => {
        // change active show in project
        if (index === null) return shows.length - 1
        index = shows.findIndex((_a: any, i: number) => i + 1 === index)
        return index === null || index < 0 ? null : index
    },
}

export function checkInput(e: any) {
    if (e.target?.closest(".edit") || e.ctrlKey || e.metaKey) return
    // TODO: combine with ShowButton.svelte click()

    if (keys[e.key]) {
        if (get(activeProject) === null) return
        e.preventDefault()
        let shows = get(projects)[get(activeProject)!].shows
        let index: null | number = get(activeShow)?.index !== undefined ? get(activeShow)!.index! : null
        let newIndex: number = keys[e.key](index, shows)

        // show
        if (get(showsCache)[shows[newIndex].id]) swichProjectItem(newIndex, shows[newIndex].id)

        // Set active show in project list
        if (newIndex !== null && newIndex !== index) activeShow.set({ ...shows[newIndex], index: newIndex })
    }
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

function getOutputWithLines() {
    let outs = getActiveOutputs()
    let l = outs.find((id: string) => get(outputs)[id].show?.lines)
    l = get(outputs)[l]?.show?.lines
    return Number(l) || 0
}

export function nextSlide(e: any, start: boolean = false, end: boolean = false, loop: boolean = false, bypassLock: boolean = false, outputId: string | null = null) {
    if (get(outLocked) && !bypassLock) return
    if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

    let currentOutput: any = get(outputs)[getActiveOutputs()[0]]
    if (outputId) currentOutput = get(outputs)[outputId]
    console.log(currentOutput)
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
    if (
        get(activePage) === "show" &&
        get(activeShow) &&
        (start || !slide || e?.ctrlKey || (isLastSlide && (get(activeShow)!.id !== slide?.id || get(showsCache)[get(activeShow)!.id]?.settings.activeLayout !== slide.layout)))
    ) {
        let id = loop ? slide!.id : get(activeShow)!.id
        if (!id) return

        // layout = GetLayout()
        layout = _show(id).layouts("active").ref()[0]
        if (!layout?.filter((a) => !a.data.disabled).length) return

        index = 0
        while (layout[index].data.disabled) index++

        // console.log(id, layout, index)
        setOutput("slide", { id, layout: _show(id).get("settings.activeLayout"), index }, false, outputId)
        updateOut(id, index, layout, true, outputId)
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
        if (e?.key === " " && get(activeProject)) {
            let index: number = typeof get(activeShow)?.index === "number" ? get(activeShow)!.index! : -1
            if (index + 1 < get(projects)[get(activeProject)!].shows.length) index++
            if (index > -1 && index !== get(activeShow)?.index) activeShow.set({ ...get(projects)[get(activeProject)!].shows[index], index })
        }
        return
    }

    if (index !== null) {
        setOutput("slide", newSlideOut, false, outputId)
        updateOut(slide ? slide.id : "active", index, layout, true, outputId)
    }
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
    let amountOfLinesToShow: number = getOutputWithLines() ? getOutputWithLines() : 0
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
        line = slideLines ? (amountOfLinesToShow >= slideLines ? 0 : slideLines - (amountOfLinesToShow % slideLines) - 1) : 0
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

export function updateOut(id: string, index: number, layout: any, extra: boolean = true, outputId: string | null = null) {
    if (get(activePage) !== "edit") activeEdit.set({ slide: index, items: [] })
    console.log(id)

    _show(id).set({ key: "timestamps.used", value: new Date().getTime() })
    let data = layout[index]?.data

    // holding "alt" key will disable all extra features
    if (!extra || !data) return

    // get output slide
    let outs = getActiveOutputs()
    let l = outs.find((id: string) => get(outputs)[id].show?.lines)
    // don't trigger actions if same slide, but different outputted line
    if (l && get(outputs)[l]?.out?.slide?.line && get(outputs)[l].out!.slide!.line! > 0) return

    let background = data.background

    // get ghost background
    if (!background) {
        layout.forEach((a, i) => {
            if (i <= index) {
                if (a.data.actions?.clearBackground || a.data.disabled) background = null
                else if (a.data.background) background = a.data.background
            }
        })
    }

    // background
    if (background) {
        let bg = _show(id).get("media")[background!]
        if (bg) {
            let bgData: any = {
                name: bg.name,
                type: bg.type || getMediaType(bg.path.slice(bg.path.lastIndexOf(".") + 1, bg.path.length)),
                path: bg.path,
                id: bg.id,
                muted: bg.muted !== false,
                loop: bg.loop !== false,
                filter: getMediaFilter(bg.path),
                flipped: get(media)[bg.path]?.flipped || false,
                fit: get(media)[bg.path]?.fit || "contain",
            }
            // outBackground.set(bgData)
            setOutput("background", bgData, false, outputId)
        }
    }

    // overlays
    if (data.overlays?.length) {
        setOutput("overlays", data.overlays, false, outputId, true)
    }

    // audio
    if (data.audio) {
        data.audio.forEach((audio: string) => {
            console.log(audio)
            let a = _show(id).get("media")[audio]
            if (a) playAudio(a, false)
        })
    }

    // nextTimer
    // clear any active slide timers
    Object.keys(get(slideTimers)).forEach((id) => {
        if (outs.includes(id)) get(slideTimers)[id].timer?.clear()
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
        if (data.actions.sendMidi) sendMidi(data.actions.sendMidi)
        if (data.actions.clearBackground) setOutput("background", null, false, outputId)
        if (data.actions.clearOverlays) clearOverlays()
        if (data.actions.clearAudio) clearAudio()
    }
}

export function sendMidi(data: any) {
    send(MAIN, ["SEND_MIDI"], data)
}

export function clearOverlays() {
    let outs = getActiveOutputs()
    let outOverlays: string[] = get(outputs)[outs[0]]?.out?.overlays || []
    outOverlays = outOverlays.filter((id) => get(overlays)[id]?.locked)
    setOutput("overlays", outOverlays)
}
