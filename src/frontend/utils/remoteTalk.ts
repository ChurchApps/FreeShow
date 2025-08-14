import { get } from "svelte/store"
import { uid } from "uid"
import { Main } from "../../types/IPC/Main"
import type { Show } from "../../types/Show"
import type { ClientMessage } from "../../types/Socket"
import { fetchBible, loadBible, receiveBibleContent } from "../components/drawer/bible/scripture"
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
        initializeRemote(msg.id)

        return msg
    },
    ACCESS: (msg: any) => {
        if (get(remotePassword).length && msg.data !== get(remotePassword)) return { id: msg.id, channel: "ERROR", data: "wrongPass" }

        send(REMOTE, ["LANGUAGE"], { lang: get(language), strings: get(dictionary) })

        setConnectedState("REMOTE", msg.id, "entered", true)

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
        const { id, bookKey, chapterKey, bookIndex, chapterIndex } = msg.data || {}
        if (!id) return

        const scriptureEntry: any = get(scriptures)[id]
        const isApi = scriptureEntry?.api === true

        if (isApi) {
            const apiId = scriptureEntry?.id || id
            
            if (bookKey && !chapterKey) {
                // Fetch chapters only (mirror drawer behavior: some APIs include a 0 entry)
                let chapters: any[] = await fetchBible("chapters", apiId, { 
                    bookId: bookKey, 
                    versesList: [], 
                    chapterId: `${bookKey}.1` 
                })
                if (chapters?.[0] && Number.parseInt(chapters[0].number, 10) === 0) {
                    chapters = chapters.slice(1)
                }
                const mapped = (chapters || []).map((c: any, i: number) => ({
                    number: Number.isFinite(Number.parseInt(c.number, 10)) ? Number.parseInt(c.number, 10) : i + 1,
                    keyName: c.keyName,
                }))
                msg.data.bibleUpdate = { kind: "chapters", id, bookIndex, chapters: mapped }
                return msg
            }
            
            if (bookKey && chapterKey) {
                // Fetch verses only
                const versesMeta: any[] = await fetchBible("verses", apiId, { 
                    bookId: bookKey, 
                    chapterId: chapterKey, 
                    versesList: [] 
                })
                const versesTextResp: any[] = await fetchBible("versesText", apiId, { 
                    bookId: bookKey, 
                    chapterId: chapterKey, 
                    versesList: versesMeta 
                })
                // Build the verses consistent with drawer's convertVerses (index-based mapping)
                const mappedVerses = (versesTextResp || []).map((d: any, i: number) => ({
                    number: (versesMeta?.[i]?.number) || i + 1,
                    text: d?.content || d?.text || "",
                }))
                msg.data.bibleUpdate = { kind: "verses", id, bookIndex, chapterIndex, verses: mappedVerses }
                return msg
            }
            
            // Initial: prefer cached books2 from scriptures store; fallback to fetch
            const objectId = Object.entries(get(scriptures)).find(([_id, a]: any) => a?.id === id)?.[0] || id
            const cachedBooks: any[] = (get(scriptures) as any)[objectId]?.books2 || []
            const books: any[] = cachedBooks.length
                ? cachedBooks
                : await fetchBible("books", apiId, { versesList: [], bookId: "GEN", chapterId: "GEN.1" })
            const mappedBooks = (books || []).map((b: any, i: number) => ({
                name: b.name,
                number: b.number || i + 1,
                keyName: b.keyName,
                chapters: [],
            }))
            msg.data.bible = { books: mappedBooks }
            return msg
        }

        const listenerId = receiveMain(Main.BIBLE, receiveBibleContent)
        loadBible(id, 0, clone(get(scriptures)[id] || {}))
        const bible = await waitUntilValueIsDefined(() => get(scripturesCache)[id])
        destroyMain(listenerId)

        msg.data.bible = bible
        return msg
    }
}

let oldOutSlide = ""

export async function initializeRemote(id: string) {
    // Send access confirmation to remote client
    window.api.send(REMOTE, { id, channel: "ACCESS", data: null })

    // Send initial data to remote client
    sendData(REMOTE, { channel: "PROJECTS", data: removeDeleted(keysToID(get(projects))) })
    send(REMOTE, ["FOLDERS"], { folders: get(folders), opened: get(openedFolders) })
    send(REMOTE, ["PROJECT"], get(activeProject))

    // Get current output state
    const currentOutput: any = get(outputs)[getActiveOutputs()[0]]
    const styleRes = currentOutput?.style ? 
        get(styles)[currentOutput?.style]?.aspectRatio || get(styles)[currentOutput?.style]?.resolution : 
        null

    const outSlide = currentOutput?.out?.slide
    const out: any = { 
        slide: outSlide ? outSlide.index : null, 
        layout: outSlide?.layout || null, 
        styleRes 
    }
    
    if (out.slide !== null && outSlide?.id && outSlide?.id !== "temp") {
        oldOutSlide = outSlide.id
        // Output & thumbnail
        out.show = await convertBackgrounds(get(showsCache)[oldOutSlide] || {})
        out.show.id = oldOutSlide

        // Send slide thumbnails asynchronously
        setTimeout(async () => {
            window.api.send(REMOTE, await receiveREMOTE.SHOW({ channel: "SHOW", id, data: oldOutSlide }))
        })
    }
    
    // Send targeted initial state to this connection
    // Use sendData so the proper OUT payload is constructed (handles scripture 'temp' etc.)
    sendData(REMOTE, { id, channel: "OUT" })
    sendData(REMOTE, { id, channel: "OUT_DATA" })

    // Send additional data
    send(REMOTE, ["OVERLAYS"], get(overlays))
    send(REMOTE, ["SCRIPTURE"], get(scriptures))
}

export async function convertBackgrounds(show: Show, noLoad = false) {
    if (!show?.media) return {}

    show = clone(show)
    let mediaIds: string[] = []
    show.layouts[show.settings?.activeLayout]?.slides.forEach((a) => {
        if (a.background) mediaIds.push(a.background)
        Object.values(a.children || {}).forEach((child) => {
            if (child.background) mediaIds.push(child.background)
        })
    })

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
