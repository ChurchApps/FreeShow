import { get } from "svelte/store"
import type { Show } from "../../../types/Show"
import type { ShowObj } from "../../classes/Show"
import { fixShowIssues } from "../../converters/importHelpers"
import { requestMain } from "../../IPC/main"
import { cachedShowsData, categories, notFound, saved, shows, showsCache, textCache } from "../../stores"
import { Main } from "./../../../types/IPC/Main"
import { getShowCacheId, updateCachedShow } from "./show"

export function setShow(id: string, value: "delete" | Show): Show {
    let previousValue: Show

    // update cache data if loading from shows list
    if (value !== "delete" && !get(showsCache)[id]) {
        const showRef = get(shows)[id]
        if (showRef && value) {
            value.name = showRef.name
            value.category = showRef.category || null
            value.timestamps = showRef.timestamps || {}
            value.quickAccess = showRef.quickAccess || {}
            if (showRef.origin) value.origin = showRef.origin
            if (showRef.private) value.private = true
            if (showRef.locked) value.locked = true

            // fix "broken" shows:
            if (!value.settings) value.settings = { activeLayout: "", template: null }
            if (!value.meta) value.meta = {}
            if (!value.slides) value.slides = {}
            if (!value.layouts) value.layouts = {}
            if (!value.media) value.media = {}

            // set metadata (CCLI) in quickAccess
            if (value.meta.CCLI && !value.quickAccess?.metadata?.CCLI) {
                if (!value.quickAccess?.metadata) value.quickAccess.metadata = {}
                value.quickAccess.metadata.CCLI = value.meta.CCLI
            }
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
                quickAccess: value.quickAccess || {},
            }

            if (value.origin) a[id].origin = value.origin
            if (value.private) a[id].private = true
            if (value.locked) a[id].locked = true
        }

        return a
    })

    console.info("SHOW UPDATED: ", id, value)

    if (value && value !== "delete") {
        cachedShowsData.update((a) => {
            const customId = getShowCacheId(id, get(showsCache)[id])
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

export async function loadShows(s: string[], deleting = false) {
    const savedBeforeLoading: boolean = !deleting && get(saved)

    const notLoaded: string[] = []
    s.forEach((id) => {
        if (!get(shows)[id]) {
            notFound.update((a) => {
                a.show.push(id)
                return a
            })
        } else if (!get(showsCache)[id]) {
            notLoaded.push(id)
        }
    })

    if (!notLoaded.length) return

    await Promise.all(notLoaded.map(async showId => {
        await requestMain(Main.SHOW, { name: get(shows)[showId].name, id: showId }, (data) => {
            if (data.error || !data.content) {
                notFound.update((a) => {
                    a.show.push(data.id)
                    return a
                })
                return
            }

            // has been loaded in the meantime
            if (get(showsCache)[data.id]) return

            // remove from not found
            if (get(notFound).show.includes(data.id)) {
                notFound.update((a) => {
                    a.show.splice(a.show.indexOf(data.id), 1)
                    return a
                })
            }

            // might have been saved wrongly
            if (typeof data.content[1] === "string") {
                try {
                    data.content[1] = JSON.parse(data.content[1])
                    if (data.content[1]?.[1]?.name) data.content[1] = data.content[1][1]
                } catch (err) {
                    return
                }
            }

            const show = fixShowIssues(data.content[1])
            setShow(data.id || data.content[0], show)
        })
    }))

    if (savedBeforeLoading) {
        setTimeout(() => saved.set(true), 100)
    }
}

let updateTimeout: NodeJS.Timeout | null = null
let tempCache: { [key: string]: string } = {}
export function saveTextCache(id: string, show: Show) {
    // don't cache scripture/calendar shows text or archived categories
    if (!show?.slides || show?.reference?.type || get(categories)[show.category || ""]?.isArchive) return

    const txt = Object.values(show.slides)
        .flatMap((slide) => slide?.items)
        .flatMap((item) => item?.lines || [])
        .flatMap((line) => line?.text || [])
        .map((text) => text?.value)
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

export function setQuickAccessMetadata(show: ShowObj, key: string, value: string) {
    if (!value) return show

    if (!show.quickAccess) show.quickAccess = {}
    if (!show.quickAccess.metadata) show.quickAccess.metadata = {}
    show.quickAccess.metadata[key] = value

    return show
}
