import { get } from "svelte/store"
import { clone } from "../components/helpers/array"
import { getActiveOutputs, setOutput } from "../components/helpers/output"
import { loadShows } from "../components/helpers/setShow"
import { clearAll, updateOut } from "../components/helpers/showActions"
import { _show } from "../components/helpers/shows"
import { REMOTE } from "./../../types/Channels"
import { activeProject, connections, dictionary, driveData, folders, mediaCache, openedFolders, outLocked, outputs, projects, remotePassword, shows, showsCache, styles } from "./../stores"
import { sendData } from "./sendData"

// REMOTE

export const receiveREMOTE: any = {
    PASSWORD: (msg: any) => {
        msg.data = {
            dictionary: get(dictionary),
            password: !!get(remotePassword).length,
        }
        if (msg.data.password) return msg

        connections.update((a: any) => {
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

        connections.update((a: any) => {
            console.log(a, msg.id)
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
        msg.data = clone({ ...convertBackgrounds(get(showsCache)[showID]), id: showID })
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

        let currentOutput: any = get(outputs)[getActiveOutputs()[0]]
        let out: any = currentOutput?.out?.slide || null
        let id: string = ""

        if (msg.data === "clear") {
            clearAll()
        } else if (msg.data?.id) {
            id = msg.data.id
            await loadShows([id])
            let layout = _show(id).layouts("active").ref()[0]
            if (msg.data.index < layout.length && msg.data.index >= 0) {
                updateOut(msg.data.id, msg.data.index, _show(msg.data.id).layouts([msg.data.layout]).ref()[0])
                setOutput("slide", msg.data)
            }
            msg.data = null
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
                msg.data.show = convertBackgrounds(get(showsCache)[id])
                msg.data.show.id = id
            }
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
        msg.data = get(projects)
        return msg
    },
}

let oldOutSlide = ""
export function initializeRemote(id: string) {
    console.log(id)
    window.api.send(REMOTE, { channel: "ACCESS" })

    sendData(REMOTE, { channel: "PROJECTS", data: get(projects) })
    window.api.send(REMOTE, { channel: "FOLDERS", data: { folders: get(folders), opened: get(openedFolders) } })
    window.api.send(REMOTE, { channel: "PROJECT", data: get(activeProject) })

    let currentOutput: any = get(outputs)[getActiveOutputs()[0]]
    let styleRes = currentOutput?.style ? get(styles)[currentOutput?.style]?.resolution : null
    let out: any = { slide: currentOutput?.out?.slide ? currentOutput.out.slide.index : null, layout: currentOutput.out?.slide?.layout || null, styleRes }
    if (out.slide !== null) {
        oldOutSlide = out.slide.id
        out.show = get(showsCache)[oldOutSlide]
    }
    window.api.send(REMOTE, { channel: "OUT", data: out })
}

export function convertBackgrounds(show) {
    if (!show) return {}

    show = clone(show)
    // let media = {}
    Object.keys(show.media || {}).map((id) => {
        let path = show.media[id].path
        let cloudId = get(driveData).mediaId
        if (cloudId && cloudId !== "default") path = show.media[id].cloud?.[cloudId] || path

        let cachedImage: any = get(mediaCache)[path]
        if (cachedImage) show.media[id].path = cachedImage.data // "data:image/png;base64," +
        // let path = await toBase64(path)
    })

    return show
}

// const toBase64 = file => new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.readAsDataURL(file);
//     reader.onload = () => resolve(reader.result);
//     reader.onerror = error => reject(error);
// });
