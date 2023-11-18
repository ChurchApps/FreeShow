import { get } from "svelte/store"
import { STAGE } from "../../types/Channels"
import type { ClientMessage } from "../../types/Socket"
import { getActiveOutputs } from "../components/helpers/output"
import { _show } from "../components/helpers/shows"
import { events, mediaCache, outputs, previewBuffers, showsCache, stageShows, timeFormat, timers, variables } from "../stores"
import { connections } from "./../stores"
import { send } from "./request"
import { arrayToObject, eachConnection, filterObjectArray, sendData, timedout } from "./sendData"

// WIP this should not send to all stage, just connected ids
export function stageListen() {
    stageShows.subscribe((data: any) => {
        data = arrayToObject(filterObjectArray(data, ["disabled", "name", "settings", "items"]).filter((a: any) => a.disabled === false))
        timedout(STAGE, { channel: "SHOW", data }, () =>
            eachConnection(STAGE, "SHOW", (connection) => {
                if (!connection.active) return

                let currentData = data[connection.active]
                if (!currentData.settings.resolution?.width) currentData.settings.resolution = { width: 1920, height: 1080 }
                return currentData
            })
        )
    })
    showsCache.subscribe(() => {
        sendData(STAGE, { channel: "SLIDES" })
    })

    outputs.subscribe(() => {
        sendData(STAGE, { channel: "SLIDES" }, true)
        // send(STAGE, ["OUTPUTS"], data)

        // sendBackgroundToStage(a)
    })
    mediaCache.subscribe(() => {
        sendData(STAGE, { channel: "SLIDES" }, true)
        // sendBackgroundToStage(get(outputs))
    })

    timers.subscribe((a) => {
        send(STAGE, ["TIMERS"], a)
    })
    variables.subscribe((a) => {
        send(STAGE, ["VARIABLES"], a)
    })
    events.subscribe((a) => {
        send(STAGE, ["EVENTS"], a)
    })

    timeFormat.subscribe((a) => {
        send(STAGE, ["DATA"], { timeFormat: a })
    })
}

export function sendBackgroundToStage(outputId, updater = get(outputs), returnPath = false) {
    let path = updater[outputId]?.out?.background?.path || ""
    if (!path) return

    let background = get(mediaCache)[path]?.data || null
    if (!background) return

    let bg = { path: background, nextPath: getNextBackground(outputId) }

    if (returnPath) return bg

    // TODO: send next background as well....
    send(STAGE, ["BACKGROUND"], bg)
    return
}

function getNextBackground(outputId: string) {
    let currentOutputSlide = get(outputs)[outputId]?.out?.slide
    if (!currentOutputSlide?.id) return ""

    let layout: any[] = _show(currentOutputSlide.id).layouts([currentOutputSlide.layout]).ref()[0]
    let nextLayout = layout[(currentOutputSlide.index || 0) + 1]
    if (!nextLayout) return ""

    let bgId = nextLayout.data.background || ""
    let path = _show(currentOutputSlide.id).media([bgId]).get()?.[0]?.path
    let background = get(mediaCache)[path]?.data || ""

    return background
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

        // if (show.disabled) return { id: msg.id, channel: "ERROR", data: "noShow" }

        msg.data = show
        sendData(STAGE, { channel: "SLIDES", data: [] })

        // initial
        window.api.send(STAGE, { id: msg.id, channel: "TIMERS", data: get(timers) })
        window.api.send(STAGE, { id: msg.id, channel: "EVENTS", data: get(events) })
        send(STAGE, ["DATA"], { timeFormat: get(timeFormat) })
        return msg
    },
    SLIDES: (msg: ClientMessage) => {
        console.log(get(connections))
        console.log(msg)
        // TODO: rework how stage talk works!! (I should send to to each individual connected stage with it's id!)
        let stageId = msg.data?.id
        if (!stageId && Object.keys(get(connections).STAGE || {}).length === 1) stageId = (Object.values(get(connections).STAGE)[0] as any).active
        let show = get(stageShows)[stageId] || {}
        console.log(show)
        let outputId = show.settings?.output || getActiveOutputs()[0]
        let currentOutput: any = get(outputs)[outputId]
        let out: any = currentOutput?.out?.slide || null
        msg.data = []
        console.log(out)

        if (!out || out.id === "temp") return msg
        let ref: any[] = _show(out.id).layouts([out.layout]).ref()[0]
        let slides: any = _show(out.id).get()?.slides
        console.log(slides)

        if (!ref?.[out.index!]) return
        msg.data = [slides[ref[out.index!].id]]

        let nextIndex = out.index! + 1
        while (nextIndex < ref.length && ref[nextIndex].data.disabled === true) nextIndex++

        console.log(ref[nextIndex])
        if (nextIndex < ref.length && !ref[nextIndex].data.disabled) msg.data.push(slides[ref[nextIndex].id])
        else msg.data.push(null)

        sendBackgroundToStage(outputId)

        console.log(msg.data)
        return msg
    },
    REQUEST_STREAM: (msg: ClientMessage) => {
        let id = msg.data.outputId
        if (!id) id = getActiveOutputs(get(outputs), true, true)[0]
        if (msg.data.alpha && get(outputs)[id].keyOutput) id = get(outputs)[id].keyOutput

        if (!id) return

        msg.data.stream = get(previewBuffers)[id]

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

// function getStageShows() {
//   return Object.entries(get(stageShows))
//     .map(([id, a]: any) => ({ id, enabled: a.enabled, name: a.name, password: a.password.length ? true : false }))
//     .filter((a) => a.enabled)
// }
// export function getStageShow() {
//   let obj = {}
//   Object.entries(get(stageShows))
//     .map(([id, a]: any) => ({ id, enabled: a.enabled, name: a.name, settings: a.settings, items: a.items }))
//     .filter((a) => a.enabled)
//   return obj
// }
