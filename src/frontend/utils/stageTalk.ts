import { get } from "svelte/store"
import { STAGE } from "../../types/Channels"
import type { OutSlide } from "../../types/Show"
import { clone, keysToID } from "../components/helpers/array"
import { getBase64Path } from "../components/helpers/media"
import { getActiveOutputs } from "../components/helpers/output"
import { getGroupName, getLayoutRef } from "../components/helpers/show"
import { _show } from "../components/helpers/shows"
import { getCustomStageLabel } from "../components/stage/stage"
import { dictionary, events, groups, media, midiIn, outputs, previewBuffers, showsCache, stageShows, timeFormat, timers, variables } from "../stores"
import { connections } from "./../stores"
import { send } from "./request"
import { arrayToObject, filterObjectArray, sendData, setConnectedState } from "./sendData"
import { runAction } from "../components/actions/actions"

// WIP loading different paths, might cause returned base64 to be different than it should if previous thumbnail finishes after
export async function sendBackgroundToStage(outputId, updater = get(outputs), returnPath = false) {
    const currentOutput = updater[outputId]?.out
    const next = await getNextBackground(currentOutput?.slide || null, returnPath)
    let path = currentOutput?.background?.path || ""
    if (typeof path !== "string") path = ""

    if (returnPath) {
        return clone({ path, mediaStyle: get(media)[path] || {}, next })
    }

    if (!path && !next.path?.length) {
        if (!returnPath) send(STAGE, ["BACKGROUND"], { path: "" })
        return
    }

    const base64path = await getBase64Path(path)

    const bg = clone({ path: base64path, filePath: path, mediaStyle: get(media)[path] || {}, next })

    if (returnPath) return bg

    send(STAGE, ["BACKGROUND"], bg)
    return
}

async function getNextBackground(currentOutputSlide: OutSlide | null, returnPath = false) {
    if (!currentOutputSlide?.id) return {}

    const showRef = _show(currentOutputSlide.id).layouts([currentOutputSlide.layout]).ref()[0]
    if (!showRef) return {}

    // GET CORRECT INDEX OFFSET, EXCLUDING DISABLED SLIDES
    const slideOffset = 1
    let layoutOffset = currentOutputSlide.index || 0
    let offsetFromCurrentExcludingDisabled = 0
    while (offsetFromCurrentExcludingDisabled < slideOffset && layoutOffset <= showRef.length) {
        layoutOffset++
        if (!showRef[layoutOffset]?.data?.disabled) offsetFromCurrentExcludingDisabled++
    }
    const slideIndex = layoutOffset

    const nextLayout = showRef[slideIndex]
    if (!nextLayout) return {}

    const bgId = nextLayout.data.background || ""
    let path = _show(currentOutputSlide.id).media([bgId]).get()?.[0]?.path || ""
    if (typeof path !== "string") path = ""

    if (returnPath) return { path, mediaStyle: get(media)[path] || {} }

    const base64path = await getBase64Path(path)

    return { path: base64path, filePath: path, mediaStyle: get(media)[path] || {} }
}

export const receiveSTAGE = {
    LAYOUTS: () => {
        return keysToID(get(stageShows))
            .filter((a) => !a.disabled)
            .map((a) => ({ id: a.id, name: a.name, password: !!a.password }))
    },
    LAYOUT: (data: { id: string }, connectionId: string) => {
        let layout = get(stageShows)[data.id]
        if (!layout || layout.disabled) return { channel: "ERROR", data: "noShow" }
        // if (show.password.length && show.password !== data.password) return { channel: "ERROR", data: "wrongPass" }
        setConnectedState("STAGE", connectionId, "active", data.id)

        layout = arrayToObject(filterObjectArray(get(stageShows), ["disabled", "name", "settings", "items"]))[data.id]

        // add labels
        Object.keys(layout.items).map((itemId) => {
            const item = layout.items[itemId]
            item.label = getCustomStageLabel(item.type || itemId, item)
        })

        // if (show.disabled) return { id: connectionId, channel: "ERROR", data: "noShow" }

        // initial
        sendData(STAGE, { channel: "OUT" })
        sendData(STAGE, { channel: "SHOW_DATA" })
        window.api.send(STAGE, { id: connectionId, channel: "TIMERS", data: get(timers) })
        window.api.send(STAGE, { id: connectionId, channel: "EVENTS", data: get(events) })
        window.api.send(STAGE, { id: connectionId, channel: "VARIABLES", data: get(variables) })
        send(STAGE, ["DATA"], { timeFormat: get(timeFormat) })

        return layout
    },

    OUT: (data: any, connectionId: string) => {
        let stageId = data?.id
        if (!stageId) stageId = get(connections).STAGE?.[connectionId]?.active
        if (!stageId) return

        const stageLayout = get(stageShows)[stageId]
        if (!stageLayout) return

        const outputId = stageLayout.settings.output || getActiveOutputs(get(outputs), false, true, true)[0]
        const output = { ...get(outputs)[outputId], id: outputId }
        if (!output?.out) return

        const outSlideId = output.out.slide?.id
        if (outSlideId) send(STAGE, ["SHOW_DATA"], { id: outSlideId, show: get(showsCache)[outSlideId] })

        sendBackgroundToStage(outputId)
        return output
    },
    SHOW_DATA: (_data: any, connectionId: string) => {
        const stageId = get(connections).STAGE?.[connectionId]?.active
        if (!stageId) return

        const stageLayout = get(stageShows)[stageId]
        const outputId = stageLayout.settings.output || getActiveOutputs(get(outputs), false, true, true)[0]
        const outSlideId = get(outputs)[outputId]?.out?.slide?.id

        if (!outSlideId) return

        return { id: outSlideId, show: get(showsCache)[outSlideId] }
    },

    REQUEST_PROGRESS: (data: any) => {
        let outputId = data.outputId
        if (!outputId) outputId = getActiveOutputs(get(outputs), false, true, true)[0]
        if (!outputId) return

        const currentSlideOut = get(outputs)[outputId]?.out?.slide || null
        const currentShowId = currentSlideOut?.id || ""
        const currentShowSlide = currentSlideOut?.index ?? -1
        const currentLayoutRef = getLayoutRef(currentShowId)
        const currentShowSlides = _show(currentShowId).get("slides") || {}
        const slidesLength = currentLayoutRef.length || 0

        // get custom group names
        const layoutGroups = currentLayoutRef.map((a) => {
            const ref = a.parent || a
            const slide = currentShowSlides[ref.id]
            if (!slide) return { name: "—" }

            if (a.data.disabled || slide.group?.startsWith("~")) return { hide: true }

            let group = slide.group || "—"
            if (slide.globalGroup && get(groups)[slide.globalGroup]) {
                group = get(groups)[slide.globalGroup].default ? get(dictionary).groups?.[get(groups)[slide.globalGroup].name] : get(groups)[slide.globalGroup].name
            }

            if (typeof group !== "string") group = ""
            const name = getGroupName({ show: _show(currentShowId).get(), showId: currentShowId }, ref.id, group, ref.layoutIndex)?.replace(/ *\([^)]*\) */g, "")
            const oneLetterName = getGroupName({ show: _show(currentShowId).get(), showId: currentShowId }, ref.id, group[0].toUpperCase(), ref.layoutIndex)?.replace(/ *\([^)]*\) */g, "")
            return { name: name || "—", oneLetterName: (oneLetterName || "—").replace(" ", ""), index: ref.layoutIndex, child: a.type === "child" ? (currentLayoutRef[ref.layoutIndex]?.children || []).findIndex((id) => id === a.id) + 1 : 0 }
        })

        data.progress = { currentShowSlide, slidesLength, layoutGroups }

        return data
    },
    REQUEST_STREAM: (data: any) => {
        let id = data.outputId
        if (!id) id = getActiveOutputs(get(outputs), false, true, true)[0]
        if (data.alpha && get(outputs)[id].keyOutput) id = get(outputs)[id].keyOutput

        if (!id) return

        data.stream = get(previewBuffers)[id]

        return data
    },

    RUN_ACTION: (a: { id: string }) => {
        runAction(get(midiIn)[a.id])
    },

    // REQUEST_VIDEO_DATA: (data: any) => {
    //     if (!data) data = {}

    //     // WIP don't know the outputId
    //     // let id = data.outputId
    //     let outputId = getActiveOutputs(get(outputs), false, true, true)[0]
    //     if (!outputId) return

    //     data.data = get(videosData)[outputId]
    //     data.time = get(videosTime)[outputId]

    //     return data
    // },
    // case "SHOW":
    //   data = getStageShow(message.data)
    //   break
    // case "BACKGROUND":
    //   data = getOutBackground()
    //   break
    // case "SLIDE":
    //   data = getOutSlide()
    //   break
    // case "OVERLAYS":
    //   data = getOutOverlays()
    //   break
}
