import { get } from "svelte/store"
import type { Show } from "../../../types/Show"
import type { ShowObj } from "../../classes/Show"
import { fixShowIssues } from "../../converters/importHelpers"
import { destroyMain, receiveMain, sendMain } from "../../IPC/main"
import { cachedShowsData, categories, notFound, saved, shows, showsCache, showsPath, textCache } from "../../stores"
import { Main } from "./../../../types/IPC/Main"
import { getShowCacheId, updateCachedShow } from "./show"

// Cache management constants
const MAX_SHOWS_CACHE_SIZE = 100
const MAX_TEXT_CACHE_SIZE = 500
const CACHE_CLEANUP_THRESHOLD = 120

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
                quickAccess: value.quickAccess,
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
    const savedWhenLoading: boolean = !deleting && get(saved)

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
                sendMain(Main.SHOW, { path: get(showsPath), name: get(shows)[id].name, id })
            } else count++
            // } else resolve("already_loaded")
        })
        // if (s.length - count) console.info(`LOADING ${s.length - count} SHOW(S)`)

        // RECEIVE
        const listenerId = receiveMain(Main.SHOW, (data) => {
            console.log(data)

            if (!s.includes(data.id)) return
            count++

            // prevent receiving multiple times
            if (count >= s.length + 1) return

            if (data.error || !data.content) {
                notFound.update((a) => {
                    a.show.push(data.id)
                    return a
                })
                // resolve("not_found")
            } else if (!get(showsCache)[data.id]) {
                if (get(notFound).show.includes(data.id)) {
                    notFound.update((a) => {
                        a.show.splice(a.show.indexOf(data.id), 1)
                        return a
                    })
                }

                // might have been save wrongly
                if (typeof data.content[1] === "string") {
                    try {
                        data.content[1] = JSON.parse(data.content[1])
                        if (data.content[1]?.[1]?.name) data.content[1] = data.content[1][1]
                    } catch (err) {
                        if (count >= s.length) finished()
                        return
                    }
                }

                const show = fixShowIssues(data.content[1])
                setShow(data.id || data.content[0], show)
            }

            if (count >= s.length) setTimeout(finished, 50)
        })
        if (count >= s.length) finished()

        function finished() {
            if (savedWhenLoading) {
                setTimeout(() => {
                    saved.set(true)
                }, 100)
            }

            destroyMain(listenerId)
            resolve("loaded")
        }
    })
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
        const currentCache = get(textCache)
        const newCache = { ...currentCache, ...tempCache }
        
        // Cleanup text cache if it gets too large
        cleanupTextCache(newCache)
        
        textCache.set(newCache)
        tempCache = {}
    }, 1000)
}

// Cache cleanup functions
function cleanupTextCache(cache: { [key: string]: string }) {
    const entries = Object.entries(cache)
    if (entries.length > CACHE_CLEANUP_THRESHOLD) {
        // Keep only the most recent entries
        const sortedEntries = entries.slice(-MAX_TEXT_CACHE_SIZE)
        textCache.set(Object.fromEntries(sortedEntries))
    }
}

export function cleanupShowsCache() {
    const currentCache = get(showsCache)
    const cacheSize = Object.keys(currentCache).length
    
    if (cacheSize > CACHE_CLEANUP_THRESHOLD) {
        // Get active shows to preserve
        const activeShowIds = Object.keys(get(shows))
        const preservedShows: { [key: string]: Show } = {}
        
        // Keep active shows and recent shows up to MAX_SHOWS_CACHE_SIZE
        let count = 0
        for (const id of activeShowIds) {
            if (currentCache[id] && count < MAX_SHOWS_CACHE_SIZE) {
                preservedShows[id] = currentCache[id]
                count++
            }
        }
        
        showsCache.set(preservedShows)
        
        // Also cleanup cached shows data
        const currentCachedData = get(cachedShowsData)
        const newCachedData: { [key: string]: any } = {}
        
        Object.keys(preservedShows).forEach(id => {
            Object.keys(currentCachedData).forEach(cacheKey => {
                if (cacheKey.startsWith(id + "_")) {
                    newCachedData[cacheKey] = currentCachedData[cacheKey]
                }
            })
        })
        
        cachedShowsData.set(newCachedData)
    }
}

export function setQuickAccessMetadata(show: ShowObj, key: string, value: string) {
    if (!value) return show

    if (!show.quickAccess) show.quickAccess = {}
    if (!show.quickAccess.metadata) show.quickAccess.metadata = {}
    show.quickAccess.metadata[key] = value

    return show
}
