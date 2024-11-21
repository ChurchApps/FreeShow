import { get } from "svelte/store"
import { clone, keysToID, removeDeleted } from "../components/helpers/array"
import { getBase64Path, mediaSize } from "../components/helpers/media"
import { getActiveOutputs, setOutput } from "../components/helpers/output"
import { loadShows } from "../components/helpers/setShow"
import { updateOut } from "../components/helpers/showActions"
import { _show } from "../components/helpers/shows"
import { BIBLE, REMOTE } from "./../../types/Channels"
import { activeProject, connections, dictionary, driveData, folders, language, openedFolders, outLocked, outputs, projects, remotePassword, scriptures, scripturesCache, shows, showsCache, styles } from "./../stores"
import { sendData } from "./sendData"
import { uid } from "uid"
import { clearAll } from "../components/output/clear"
import { destroy, send } from "./request"
import type { Show } from "../../types/Show"
import { API_ACTIONS } from "../components/actions/api"
import type { ClientMessage } from "../../types/Socket"
import { loadBible, receiveBibleContent } from "../components/drawer/bible/scripture"
import { waitUntilValueIsDefined } from "./common"

// REMOTE

let currentOut: string = ""
export const receiveREMOTE: any = {
    PASSWORD: (msg: any) => {
        msg.data = {
            dictionary: get(dictionary),
            password: !!get(remotePassword).length,
        }
        if (msg.data.password) return msg

        connections.update((a: any) => {
            if (!a.REMOTE) a.REMOTE = {}
            if (!a.REMOTE[msg.id]) a.REMOTE[msg.id] = {}
            a.REMOTE[msg.id].entered = true
            return a
        })

        // msg = { id: msg.id, channel: "SHOWS_CACHE", data: filterObjectArray(get(showsCache), ["name", "private", "category", "timestamps"]) }
        msg = { id: msg.id, channel: "SHOWS", data: get(shows) }
        initializeRemote(msg.id)

        return msg
    },
    ACCESS: (msg: any) => {
        if (get(remotePassword).length && msg.data !== get(remotePassword)) return { id: msg.id, channel: "ERROR", data: "wrongPass" }

        send(REMOTE, ["LANGUAGE"], { lang: get(language), strings: get(dictionary) })

        connections.update((a: any) => {
            if (!a.REMOTE) a.REMOTE = {}
            if (!a.REMOTE[msg.id]) a.REMOTE[msg.id] = {}
            a.REMOTE[msg.id].entered = true
            return a
        })

        // msg = { id: msg.id, channel: "SHOWS_CACHE", data: filterObjectArray(get(showsCache), ["name", "private", "category", "timestamps"]) }
        msg = { id: msg.id, channel: "SHOWS", data: get(shows) }
        initializeRemote(msg.id)

        return msg
    },
    // SHOWS: (msg: any) => {
    //   msg.data = filterObjectArray(get(shows), ["name"])
    //   return msg
    // },
    SHOW: async (msg: any) => {
        // msg.data = filterObjectArray(get(shows)[msg.data], [""])
        let showID: string = msg.data
        console.log(msg)

        await loadShows([showID])
        msg.data = clone({ ...(await convertBackgrounds(get(showsCache)[showID])), id: showID })
        // send(REMOTE, ["MEDIA"], { media: msg.data.media })

        if (msg.id) {
            connections.update((a) => {
                if (!a.REMOTE) a.REMOTE = {}
                if (!a.REMOTE[msg.id!]) a.REMOTE[msg.id!] = {}
                a.REMOTE[msg.id!].active = showID
                return a
            })
        }

        return msg
    },
    OUT: async (msg: any) => {
        if (get(outLocked)) return
        // set id because convertBackgrounds might use a long time
        let currentId = uid(5)
        currentOut = currentId

        let currentOutput: any = get(outputs)[getActiveOutputs()[0]]
        let out: any = currentOutput?.out?.slide || null
        let id: string = ""

        if (msg.data === "clear") {
            clearAll()
            return
        } else if (msg.data?.id) {
            id = msg.data.id
            await loadShows([id])

            let layout = _show(id).layouts("active").ref()[0] || []
            if (msg.data.index < layout.length && msg.data.index >= 0) {
                if (!msg.data.layout) msg.data.layout = _show(id).get("settings.activeLayout")
                updateOut(msg.data.id, msg.data.index, _show(msg.data.id).layouts([msg.data.layout]).ref()[0])
                setOutput("slide", msg.data)
            }

            return
        } else if (msg.data !== null && msg.data !== undefined && out) {
            id = out.id
            console.log(msg.data)

            let layout = _show(id).layouts("active").ref()[0]
            if (msg.data < layout.length && msg.data >= 0) {
                let newOutSlide: any = { ...out, index: msg.data }
                setOutput("slide", newOutSlide)
            }
            msg.data = null
        } else {
            let styleRes = currentOutput?.style ? get(styles)[currentOutput?.style]?.resolution : null
            msg.data = { slide: out ? out.index : null, layout: out?.layout || null, styleRes }
            // && out.id !== oldOutSlide
            if (out && out.id !== "temp") {
                id = out.id
                oldOutSlide = id
                msg.data.show = await convertBackgrounds(get(showsCache)[id])
                msg.data.show.id = id
            }

            if (currentOut !== currentId) return
        }
        if (id.length && msg.id) {
            connections.update((a) => {
                if (!a.REMOTE) a.REMOTE = {}
                if (!a.REMOTE[msg.id!]) a.REMOTE[msg.id!] = {}
                a.REMOTE[msg.id!].active = id
                return a
            })
        }

        return msg
    },
    PROJECTS: (msg: any) => {
        msg.data = removeDeleted(keysToID(get(projects)))
        return msg
    },
    GET_SCRIPTURE: async (msg: ClientMessage) => {
        let id = msg.data?.id
        if (!id) return

        let listenerId = uid()
        window.api.receive(BIBLE, receiveBibleContent, listenerId)
        receiveBibleContent(msg)
        loadBible(id, 0, clone(get(scriptures)[id] || {}))
        const bible = await waitUntilValueIsDefined(() => get(scripturesCache)[id])
        destroy(BIBLE, listenerId)

        msg.data.bible = bible
        return msg
    },
    API: async (msg: ClientMessage) => {
        if (!msg.data) msg.data = {}
        const id = msg.api || ""
        const data = await API_ACTIONS[id]?.(msg.data)

        if (id === "get_thumbnail") {
            msg.data.thumbnail = data
        } else {
            msg.data = data
        }

        return data ? msg : null
    },
}

let oldOutSlide = ""
export function initializeRemote(id: string) {
    console.log(id)
    send(REMOTE, ["ACCESS"])

    sendData(REMOTE, { channel: "PROJECTS", data: removeDeleted(keysToID(get(projects))) })
    send(REMOTE, ["FOLDERS"], { folders: get(folders), opened: get(openedFolders) })
    send(REMOTE, ["PROJECT"], get(activeProject))

    let currentOutput: any = get(outputs)[getActiveOutputs()[0]]
    let styleRes = currentOutput?.style ? get(styles)[currentOutput?.style]?.resolution : null
    let out: any = { slide: currentOutput?.out?.slide ? currentOutput.out.slide.index : null, layout: currentOutput.out?.slide?.layout || null, styleRes }
    if (out.slide !== null && out.slide?.id) {
        oldOutSlide = out.slide.id
        out.show = get(showsCache)[oldOutSlide]
    }
    send(REMOTE, ["OUT"], out)

    send(REMOTE, ["SCRIPTURE"], get(scriptures))
}

export async function convertBackgrounds(show: Show) {
    if (!show) return {}

    show = clone(show)
    let mediaIds = show.layouts[show.settings?.activeLayout]?.slides.map((a) => a.background || "").filter(Boolean)

    await Promise.all(
        mediaIds.map(async (id) => {
            let path = show.media[id].path || show.media[id].id || ""
            let cloudId = get(driveData).mediaId
            if (cloudId && cloudId !== "default") path = show.media[id].cloud?.[cloudId] || path

            let base64Path: string = await getBase64Path(path, mediaSize.slideSize)
            if (base64Path) show.media[id].path = base64Path
        })
    )

    return show
}

// const toBase64 = file => new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.readAsDataURL(file);
//     reader.onload = () => resolve(reader.result);
//     reader.onerror = error => reject(error);
// });
