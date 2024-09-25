import { get } from "svelte/store"
import { SHOW } from "../../../types/Channels"
import type { Show } from "../../../types/Show"
import { cachedShowsData, notFound, saved, shows, showsCache, showsPath, textCache } from "../../stores"
import { getShowCacheId, updateCachedShow } from "./show"
import { uid } from "uid"
import { destroy } from "../../utils/request"
import { fixShowIssues } from "../../converters/importHelpers"

export function setShow(id: string, value: "delete" | Show): Show {
    let previousValue: Show

    // update cache data if loading from shows list
    if (value !== "delete" && !get(showsCache)[id]) {
        let showRef = get(shows)[id]
        if (showRef && value) {
            value.name = showRef.name
            value.category = showRef.category || null
            value.timestamps = showRef.timestamps || {}
            value.quickAccess = showRef.quickAccess || {}
            if (showRef.private) value.private = true
            if (showRef.locked) value.locked = true

            // fix "broken" shows:
            if (!value.settings) value.settings = { activeLayout: "", template: null }
            if (!value.meta) value.meta = {}
            if (!value.slides) value.slides = {}
            if (!value.layouts) value.layouts = {}
            if (!value.media) value.media = {}
        }
    }

    showsCache.update((a) => {
        previousValue = a[id]
        if (value === "delete") delete a[id]
        else if (value) {
            saveTextCache(id, value)
            a[id] = value
        }
        // send(OUTPUT, ["SHOWS"], a)

        return a
    })

    shows.update((a) => {
        if (value === "delete") delete a[id]
        else if (!a[id] && value) {
            a[id] = {
                name: value.name,
                category: value.category,
                timestamps: value.timestamps,
                quickAccess: value.quickAccess,
            }

            if (value.private) a[id].private = true
            if (value.locked) a[id].locked = true
        }

        return a
    })

    console.info("SHOW UPDATED: ", id, value)

    if (value && value !== "delete") {
        cachedShowsData.update((a) => {
            let customId = getShowCacheId(id, get(showsCache)[id])
            a[customId] = updateCachedShow(id, value)
            return a
        })
    }

    // add to shows index
    // if (update) {
    //   console.log("UPDATE SHOW")
    //   window.api.send(STORE, { channel: "SHOW", data: { id, value: get(shows)[id] } })
    // }

    return previousValue!
}

export async function loadShows(s: string[]) {
    let savedWhenLoading: boolean = get(saved)

    return new Promise((resolve) => {
        let count = 0

        s.forEach((id) => {
            if (!get(shows)[id]) {
                count++
                notFound.update((a) => {
                    a.show.push(id)
                    return a
                })
                // resolve("not_found")
            } else if (!get(showsCache)[id]) {
                window.api.send(SHOW, { path: get(showsPath), name: get(shows)[id].name, id })
            } else count++
            // } else resolve("already_loaded")
        })
        if (s.length - count) console.info(`LOADING ${s.length - count} SHOW(S)`)

        // RECEIVE
        let listenerId = uid()
        window.api.receive(SHOW, receiveShow, listenerId)
        function receiveShow(msg: any) {
            if (!s.includes(msg.id)) return
            count++

            // prevent receiving multiple times
            if (count >= s.length + 1) return

            if (msg.error) {
                notFound.update((a) => {
                    a.show.push(msg.id)
                    return a
                })
                // resolve("not_found")
            } else if (!get(showsCache)[msg.id]) {
                if (get(notFound).show.includes(msg.id)) {
                    notFound.update((a) => {
                        a.show.splice(a.show.indexOf(msg.id), 1)
                        return a
                    })
                }

                let show = fixShowIssues(msg.content[1])
                setShow(msg.id || msg.content[0], show)
            }

            if (count >= s.length) setTimeout(finished, 50)
        }
        if (count >= s.length) finished()

        function finished() {
            if (savedWhenLoading) {
                setTimeout(() => {
                    saved.set(true)
                }, 100)
            }

            destroy(SHOW, listenerId)
            resolve("loaded")
        }
    })
}

let updateTimeout: any = null
let tempCache: any = {}
export function saveTextCache(id: string, show: Show) {
    if (!show?.slides) return

    const txt = Object.values(show.slides)
        .flatMap((slide) => slide.items)
        .flatMap((item) => item.lines || [])
        .flatMap((line) => line.text || [])
        .map((text) => text.value)
        .join(" ")
        .toLowerCase()
    // .replace(/[^a-z0-9 ]+/g, "")

    // encode
    // txt = window.btoa(txt)
    // txt = Buffer.from(txt).toString("base64")
    // Buffer.from(encode, 'base64').toString('utf-8')
    // window.atob(encode)

    tempCache[id] = txt

    // prevent rapid updates
    if (updateTimeout) clearTimeout(updateTimeout)
    updateTimeout = setTimeout(() => {
        textCache.set({ ...get(textCache), ...tempCache })
        tempCache = {}
    }, 1000)
}
