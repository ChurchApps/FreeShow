import { get } from "svelte/store"
import { STAGE } from "../../types/Channels"
import type { ClientMessage } from "../../types/Socket"
import { getActiveOutputs } from "../components/helpers/output"
import { _show } from "../components/helpers/shows"
import { events, outputs, showsCache, stageShows, timeFormat, timers } from "../stores"
import { connections } from "./../stores"
import { send } from "./request"
import { arrayToObject, eachConnection, filterObjectArray, sendData, timedout } from "./sendData"

export function stageListen() {
    stageShows.subscribe((data: any) => {
        data = arrayToObject(filterObjectArray(get(stageShows), ["enabled", "name", "settings", "items"], "enabled"))
        timedout(STAGE, { channel: "SHOW", data }, () =>
            eachConnection(STAGE, "SHOW", (connection) => {
                return connection.active ? data[connection.active] : null
            })
        )
    })
    outputs.subscribe(() => {
        sendData(STAGE, { channel: "SLIDES" }, true)
        // send(STAGE, ["OUTPUTS"], data)
    })
    showsCache.subscribe(() => {
        sendData(STAGE, { channel: "SLIDES" })
    })

    timers.subscribe((a) => {
        send(STAGE, ["TIMERS"], a)
    })
    events.subscribe((a) => {
        send(STAGE, ["EVENTS"], a)
    })

    timeFormat.subscribe((a) => {
        send(STAGE, ["DATA"], { timeFormat: a })
    })
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
        return msg
    },
    SLIDES: (msg: ClientMessage) => {
        let currentOutput: any = get(outputs)[getActiveOutputs()[0]]
        let out: any = currentOutput?.out?.slide || null
        msg.data = []
        console.log(out)

        if (!out || out.id === "temp") return msg
        let ref: any[] = _show(out.id).layouts([out.layout]).ref()[0]
        let slides: any = _show(out.id).get().slides
        console.log(slides)

        if (!ref[out.index!]) return
        msg.data = [slides[ref[out.index!].id]]

        let nextIndex = out.index! + 1
        while (nextIndex < ref.length && ref[nextIndex].data.disabled === true) nextIndex++

        console.log(ref[nextIndex])
        if (nextIndex < ref.length && !ref[nextIndex].data.disabled) msg.data.push(slides[ref[nextIndex].id])
        else msg.data.push(null)

        console.log(msg.data)
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
