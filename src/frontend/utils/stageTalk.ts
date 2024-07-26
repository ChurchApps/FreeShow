import { get } from "svelte/store"
import { STAGE } from "../../types/Channels"
import type { ClientMessage } from "../../types/Socket"
import { clone } from "../components/helpers/array"
import { getBase64Path } from "../components/helpers/media"
import { getActiveOutputs } from "../components/helpers/output"
import { _show } from "../components/helpers/shows"
import { getCustomStageLabel } from "../components/stage/stage"
import { events, media, outputs, previewBuffers, stageShows, timeFormat, timers, variables, videosData, videosTime } from "../stores"
import { connections } from "./../stores"
import { send } from "./request"
import { arrayToObject, filterObjectArray, sendData } from "./sendData"

export async function sendBackgroundToStage(outputId, updater = get(outputs), returnPath = false) {
    let currentOutput = updater[outputId]?.out
    let path = currentOutput?.background?.path || ""
    if (!path) {
        if (!returnPath) send(STAGE, ["BACKGROUND"], { path: "" })
        return
    }

    let base64path = await getBase64Path(path)
    if (!base64path) return

    let bg = clone({ path: base64path, mediaStyle: get(media)[path] || {}, next: await getNextBackground(currentOutput?.slide) })

    if (returnPath) return bg

    send(STAGE, ["BACKGROUND"], bg)
    return
}

async function getNextBackground(currentOutputSlide: any) {
    if (!currentOutputSlide?.id) return {}

    let layout: any[] = _show(currentOutputSlide.id).layouts([currentOutputSlide.layout]).ref()[0]
    if (!layout) return {}

    let nextLayout = layout[(currentOutputSlide.index || 0) + 1]
    if (!nextLayout) return {}

    let bgId = nextLayout.data.background || ""
    let path = _show(currentOutputSlide.id).media([bgId]).get()?.[0]?.path

    let base64path = await getBase64Path(path)
    if (!base64path) return {}

    return { path: base64path, mediaStyle: get(media)[path] || {} }
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
        window.api.send(STAGE, { id: msg.id, channel: "TIMERS", data: get(timers) })
        window.api.send(STAGE, { id: msg.id, channel: "EVENTS", data: get(events) })
        window.api.send(STAGE, { id: msg.id, channel: "VARIABLES", data: get(variables) })
        send(STAGE, ["DATA"], { timeFormat: get(timeFormat) })
        return msg
    },
    SLIDES: (msg: ClientMessage) => {
        // TODO: rework how stage talk works!! (I should send to to each individual connected stage with it's id!)
        let stageId = msg.data?.id
        if (!stageId && Object.keys(get(connections).STAGE || {}).length === 1) stageId = (Object.values(get(connections).STAGE)[0] as any).active
        let show = get(stageShows)[stageId] || {}
        let outputId = show.settings?.output || getActiveOutputs()[0]
        let currentOutput: any = get(outputs)[outputId]
        let out: any = currentOutput?.out?.slide || null
        msg.data = []

        if (!out) return msg

        // scripture
        if (out.id === "temp") {
            msg.data = [{ items: out.tempItems }]
            return msg
        }

        let ref: any[] = _show(out.id).layouts([out.layout]).ref()[0]
        let slides: any = _show(out.id).get()?.slides
        console.log(ref, slides)

        if (!ref?.[out.index!]) return
        msg.data = [slides[ref[out.index!].id]]

        let nextIndex = out.index! + 1
        if (ref[nextIndex]) {
            while (nextIndex < ref.length && ref[nextIndex].data.disabled === true) nextIndex++

            if (nextIndex < ref.length && !ref[nextIndex].data.disabled) msg.data.push(slides[ref[nextIndex].id])
            else msg.data.push(null)
        } else msg.data.push(null)

        sendBackgroundToStage(outputId)

        return msg
    },
    REQUEST_PROGRESS: (msg: ClientMessage) => {
        let outputId = msg.data.outputId
        if (!outputId) outputId = getActiveOutputs(get(outputs), false, true, true)[0]
        if (!outputId) return

        let currentSlideOut = get(outputs)[outputId]?.out?.slide || null
        let currentShowId = currentSlideOut?.id || ""
        let currentShowSlide = currentSlideOut?.index ?? -1
        let currentLayoutRef = _show(currentShowId).layouts("active").ref()[0] || []
        let currentShowSlides = _show(currentShowId).get("slides") || {}
        let slidesLength = currentLayoutRef.length || 0
        let layoutGroups = currentLayoutRef.map((ref) => currentShowSlides[ref.parent?.id || ref.id]?.group || "—")

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
        let outputId = getActiveOutputs(get(outputs), false, true, true)[0]
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
