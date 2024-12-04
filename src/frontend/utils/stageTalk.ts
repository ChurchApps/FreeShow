import { get } from "svelte/store"
import { STAGE } from "../../types/Channels"
import type { ClientMessage } from "../../types/Socket"
import { clone } from "../components/helpers/array"
import { getBase64Path } from "../components/helpers/media"
import { getActiveOutputs } from "../components/helpers/output"
import { getGroupName } from "../components/helpers/show"
import { _show } from "../components/helpers/shows"
import { getCustomStageLabel } from "../components/stage/stage"
import { events, timers, dictionary, groups, media, outputSlideCache, outputs, previewBuffers, stageShows, timeFormat, variables, videosData, videosTime } from "../stores"
import { connections } from "./../stores"
import { send } from "./request"
import { arrayToObject, filterObjectArray, sendData } from "./sendData"

// WIP loading different paths, might cause returned base64 to be different than it should if previous thumbnail finishes after
export async function sendBackgroundToStage(outputId, updater = get(outputs), returnPath = false) {
    const currentOutput = updater[outputId]?.out
    const next = await getNextBackground(currentOutput?.slide, returnPath)
    const path = currentOutput?.background?.path || ""

    if (returnPath) {
        return clone({ path, mediaStyle: get(media)[path] || {}, next })
    }

    if (!path && !next.path?.length) {
        if (!returnPath) send(STAGE, ["BACKGROUND"], { path: "" })
        return
    }

    const base64path = await getBase64Path(path)

    const bg = clone({
        path: base64path,
        filePath: path,
        mediaStyle: get(media)[path] || {},
        next,
    })

    if (returnPath) return bg

    send(STAGE, ["BACKGROUND"], bg)
    return
}

async function getNextBackground(currentOutputSlide: any, returnPath = false) {
    if (!currentOutputSlide?.id) return {}

    const layout: any[] = _show(currentOutputSlide.id).layouts([currentOutputSlide.layout]).ref()[0]
    if (!layout) return {}

    const nextLayout = layout[(currentOutputSlide.index || 0) + 1]
    if (!nextLayout) return {}

    const bgId = nextLayout.data.background || ""
    const path = _show(currentOutputSlide.id).media([bgId]).get()?.[0]?.path

    if (returnPath) return { path, mediaStyle: get(media)[path] || {} }

    const base64path = await getBase64Path(path)

    return {
        path: base64path,
        filePath: path,
        mediaStyle: get(media)[path] || {},
    }
}

export const receiveSTAGE: any = {
    SHOWS: (msg: ClientMessage) => {
        msg.data = turnIntoBoolean(
            filterObjectArray(get(stageShows), ["disabled", "name", "password"]).filter((a: any) => !a.disabled),
            "password"
        )
        return msg
    },
    SHOW: (msg: ClientMessage) => {
        if (!msg.id) return { id: msg.id, channel: "ERROR", data: "missingID" }

        let show = get(stageShows)[msg.data.id]
        if (!show || show.disabled) return { id: msg.id, channel: "ERROR", data: "noShow" }
        if (show.password.length && show.password !== msg.data.password) return { id: msg.id, channel: "ERROR", data: "wrongPass" }

        // connection successfull
        connections.update((a) => {
            if (!a.STAGE) a.STAGE = {}
            if (!a.STAGE[msg.id!]) a.STAGE[msg.id!] = {}
            a.STAGE[msg.id!].active = msg.data.id
            return a
        })
        show = arrayToObject(filterObjectArray(get(stageShows), ["disabled", "name", "settings", "items"]))[msg.data.id]

        // add labels
        Object.keys(show.items).map((itemId) => {
            show.items[itemId].label = getCustomStageLabel(itemId)
        })

        // if (show.disabled) return { id: msg.id, channel: "ERROR", data: "noShow" }

        msg.data = show
        sendData(STAGE, { channel: "SLIDES", data: [] })

        // initial
        window.api.send(STAGE, {
            id: msg.id,
            channel: "TIMERS",
            data: get(timers),
        })
        window.api.send(STAGE, {
            id: msg.id,
            channel: "EVENTS",
            data: get(events),
        })
        window.api.send(STAGE, {
            id: msg.id,
            channel: "VARIABLES",
            data: get(variables),
        })
        send(STAGE, ["DATA"], { timeFormat: get(timeFormat) })
        return msg
    },
    SLIDES: (msg: ClientMessage) => {
        // TODO: rework how stage talk works!! (I should send to to each individual connected stage with it's id!)
        let stageId = msg.data?.id
        if (!stageId && Object.keys(get(connections).STAGE || {}).length === 1) stageId = (Object.values(get(connections).STAGE)[0] as any).active
        const show = get(stageShows)[stageId] || {}
        const outputId = show.settings?.output || getActiveOutputs()[0]
        const currentOutput: any = get(outputs)[outputId]
        const outSlide: any = currentOutput?.out?.slide || null
        const outCached: any = get(outputSlideCache)[outputId]
        const out: any = outSlide || outCached
        msg.data = []

        if (!out) {
            // next slide image thumbnail will remain if not cleared here
            setTimeout(() => send(STAGE, ["BACKGROUND"], { path: "" }), 500)
            return msg
        }

        // scripture
        if (out.id === "temp") {
            msg.data = [{ items: out.tempItems }]
            return msg
        }

        const ref: any[] = _show(out.id).layouts([out.layout]).ref()[0]
        const slides: any = _show(out.id).get()?.slides

        if (!ref?.[out.index!]) return
        msg.data = [slides[ref[out.index!].id]]

        let nextIndex = out.index! + 1
        if (ref[nextIndex]) {
            while (nextIndex < ref.length && ref[nextIndex].data.disabled === true) nextIndex++

            if (nextIndex < ref.length && !ref[nextIndex].data.disabled) msg.data.push(slides[ref[nextIndex].id])
            else msg.data.push(null)
        } else msg.data.push(null)

        // don't show current slide if just in cache
        if (!outSlide) msg.data[0] = null

        sendBackgroundToStage(outputId)

        return msg
    },
    REQUEST_PROGRESS: (msg: ClientMessage) => {
        let outputId = msg.data.outputId
        if (!outputId) outputId = getActiveOutputs(get(outputs), false, true, true)[0]
        if (!outputId) return

        const currentSlideOut = get(outputs)[outputId]?.out?.slide || null
        const currentShowId = currentSlideOut?.id || ""
        const currentShowSlide = currentSlideOut?.index ?? -1
        const currentLayoutRef = _show(currentShowId).layouts("active").ref()[0] || []
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

            const name = getGroupName({ show: _show(currentShowId).get(), showId: currentShowId }, ref.id, group, ref.layoutIndex)?.replace(/ *\([^)]*\) */g, "")
            const oneLetterName = getGroupName({ show: _show(currentShowId).get(), showId: currentShowId }, ref.id, group[0].toUpperCase(), ref.layoutIndex)?.replace(/ *\([^)]*\) */g, "")
            return {
                name: name || "—",
                oneLetterName: (oneLetterName || "—").replace(" ", ""),
                index: ref.layoutIndex,
                child: a.type === "child" ? (currentLayoutRef[ref.layoutIndex]?.children || []).findIndex((id) => id === a.id) + 1 : 0,
            }
        })

        msg.data.progress = { currentShowSlide, slidesLength, layoutGroups }

        return msg
    },
    REQUEST_STREAM: (msg: ClientMessage) => {
        let id = msg.data.outputId
        if (!id) id = getActiveOutputs(get(outputs), false, true, true)[0]
        if (msg.data.alpha && get(outputs)[id].keyOutput) id = get(outputs)[id].keyOutput

        if (!id) return

        msg.data.stream = get(previewBuffers)[id]

        return msg
    },
    REQUEST_VIDEO_DATA: (msg: ClientMessage) => {
        if (!msg.data) msg.data = {}

        // WIP don't know the outputId
        // let id = msg.data.outputId
        const outputId = getActiveOutputs(get(outputs), false, true, true)[0]
        if (!outputId) return

        msg.data.data = get(videosData)[outputId]
        msg.data.time = get(videosTime)[outputId]

        return msg
    },
    // TODO: send data!
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

function turnIntoBoolean(array: any[], key: string) {
    return array.map((a) => {
        a[key] = a[key].length ? true : false
        return a
    })
}
