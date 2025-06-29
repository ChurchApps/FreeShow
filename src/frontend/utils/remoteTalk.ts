import { get } from "svelte/store"
import { uid } from "uid"
import { Main } from "../../types/IPC/Main"
import type { Show } from "../../types/Show"
import type { ClientMessage } from "../../types/Socket"
import { loadBible, receiveBibleContent } from "../components/drawer/bible/scripture"
import { clone, keysToID, removeDeleted } from "../components/helpers/array"
import { getBase64Path, getThumbnailPath, mediaSize } from "../components/helpers/media"
import { getActiveOutputs, setOutput } from "../components/helpers/output"
import { loadShows } from "../components/helpers/setShow"
import { getLayoutRef } from "../components/helpers/show"
import { updateOut } from "../components/helpers/showActions"
import { _show } from "../components/helpers/shows"
import { clearAll } from "../components/output/clear"
import { destroyMain, receiveMain } from "../IPC/main"
import { REMOTE } from "./../../types/Channels"
import { activeProject, dictionary, driveData, folders, language, openedFolders, outLocked, outputs, overlays, projects, remotePassword, scriptures, scripturesCache, shows, showsCache, styles } from "./../stores"
import { waitUntilValueIsDefined } from "./common"
import { send } from "./request"
import { sendData, setConnectedState } from "./sendData"

// REMOTE

let currentOut = ""
let loadingShow = ""
export const receiveREMOTE: any = {
    PASSWORD: (msg: any) => {
        msg.data = {
            dictionary: get(dictionary),
            password: !!get(remotePassword).length
        }
        if (msg.data.password) return msg

        setConnectedState("REMOTE", msg.id, "entered", true)

        // msg = { id: msg.id, channel: "SHOWS_CACHE", data: filterObjectArray(get(showsCache), ["name", "private", "category", "timestamps"]) }
        msg = { id: msg.id, channel: "SHOWS", data: get(shows) }
        initializeRemote()

        return msg
    },
    ACCESS: (msg: any) => {
        if (get(remotePassword).length && msg.data !== get(remotePassword)) return { id: msg.id, channel: "ERROR", data: "wrongPass" }

        send(REMOTE, ["LANGUAGE"], { lang: get(language), strings: get(dictionary) })

        setConnectedState("REMOTE", msg.id, "entered", true)

        // msg = { id: msg.id, channel: "SHOWS_CACHE", data: filterObjectArray(get(showsCache), ["name", "private", "category", "timestamps"]) }
        msg = { id: msg.id, channel: "SHOWS", data: get(shows) }
        initializeRemote()

        return msg
    },
    // SHOWS: (msg: any) => {
    //   msg.data = filterObjectArray(get(shows), ["name"])
    //   return msg
    // },
    SHOW: async (msg: any) => {
        // msg.data = filterObjectArray(get(shows)[msg.data], [""])
        const showID: string = msg.data

        if (msg.id) {
            setConnectedState("REMOTE", msg.id, "active", showID)
        }

        loadingShow = showID
        await loadShows([showID])

        // send before any backgrounds has loaded
        msg.data = clone({ ...(await convertBackgrounds(get(showsCache)[showID], true)), id: showID })
        if (loadingShow !== showID) return
        window.api.send(REMOTE, msg)

        msg.data = clone({ ...(await convertBackgrounds(get(showsCache)[showID])), id: showID })
        // send(REMOTE, ["MEDIA"], { media: msg.data.media })

        if (loadingShow !== showID) return

        return msg
    },
    OUT: async (msg: any) => {
        if (get(outLocked)) return
        // set id because convertBackgrounds might use a long time
        const currentId = uid(5)
        currentOut = currentId

        const currentOutput: any = get(outputs)[getActiveOutputs()[0]]
        const out: any = currentOutput?.out?.slide || null
        let id = ""

        if (msg.data === "clear") {
            clearAll()
            return
        } else if (msg.data?.id) {
            id = msg.data.id
            await loadShows([id])

            const layout = getLayoutRef(id)
            if (msg.data.index < layout.length && msg.data.index >= 0) {
                if (!msg.data.layout) msg.data.layout = _show(id).get("settings.activeLayout")
                updateOut(msg.data.id, msg.data.index, _show(msg.data.id).layouts([msg.data.layout]).ref()[0])
                setOutput("slide", msg.data)
            }

            return
        } else if (msg.data !== null && msg.data !== undefined && out) {
            id = out.id

            const layout = getLayoutRef(id)
            if (msg.data < layout.length && msg.data >= 0) {
                const newOutSlide: any = { ...out, index: msg.data }
                setOutput("slide", newOutSlide)
            }
            msg.data = null
        } else if (out?.id === "temp") {
            msg.data = out
        } else {
            const styleRes = currentOutput?.style ? get(styles)[currentOutput?.style]?.aspectRatio || get(styles)[currentOutput?.style]?.resolution : null
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
            setConnectedState("REMOTE", msg.id, "active", id)
        }

        return msg
    },
    OUT_DATA: (msg: any) => {
        const currentOutput = get(outputs)[getActiveOutputs()[0]]
        const out = currentOutput?.out || {}
        msg.data = out

        return msg
    },
    PROJECTS: (msg: any) => {
        msg.data = removeDeleted(keysToID(clone(get(projects))))

        // get names
        msg.data.forEach((project) => {
            project.shows.forEach((show) => {
                if (show.type === "overlay") show.name = get(overlays)[show.id]?.name || get(dictionary).main?.unnamed
            })

            return project
        })

        return msg
    },
    GET_SCRIPTURE: async (msg: ClientMessage) => {
        const id = msg.data?.id
        if (!id) return

        // if (get(scriptures)[id]?.collection) id = get(scriptures)[id].collection!.versions[0]

        const listenerId = receiveMain(Main.BIBLE, receiveBibleContent)
        loadBible(id, 0, clone(get(scriptures)[id] || {}))
        const bible = await waitUntilValueIsDefined(() => get(scripturesCache)[id])
        destroyMain(listenerId)

        msg.data.bible = bible
        return msg
    }
}

let oldOutSlide = ""
export function initializeRemote() {
    send(REMOTE, ["ACCESS"])

    sendData(REMOTE, { channel: "PROJECTS", data: removeDeleted(keysToID(get(projects))) })
    send(REMOTE, ["FOLDERS"], { folders: get(folders), opened: get(openedFolders) })
    send(REMOTE, ["PROJECT"], get(activeProject))

    const currentOutput: any = get(outputs)[getActiveOutputs()[0]]
    // this is actually aspect ratio
    const styleRes = currentOutput?.style ? get(styles)[currentOutput?.style]?.aspectRatio || get(styles)[currentOutput?.style]?.resolution : null

    const outSlide = currentOutput?.out?.slide
    const out: any = { slide: outSlide ? outSlide.index : null, layout: outSlide?.layout || null, styleRes }
    if (out.slide !== null && outSlide?.id) {
        oldOutSlide = outSlide.id
        out.show = get(showsCache)[oldOutSlide] || {}
        out.show.id = oldOutSlide
    }
    send(REMOTE, ["OUT"], out)

    send(REMOTE, ["OVERLAYS"], get(overlays))
    send(REMOTE, ["SCRIPTURE"], get(scriptures))
}

export async function convertBackgrounds(show: Show, noLoad = false) {
    if (!show?.media) return {}

    show = clone(show)
    const mediaIds = show.layouts[show.settings?.activeLayout]?.slides.map((a) => a.background || "").filter(Boolean)

    await Promise.all(
        mediaIds.map(async (id) => {
            let path = show.media[id]?.path || show.media[id]?.id || ""
            const cloudId = get(driveData).mediaId
            if (cloudId && cloudId !== "default") path = show.media[id]?.cloud?.[cloudId] || path
            if (!path) return

            if (noLoad) {
                show.media[id].path = getThumbnailPath(path, mediaSize.slideSize)
                return
            }

            const base64Path: string = await getBase64Path(path, mediaSize.slideSize)
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
