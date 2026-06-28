import { get } from "svelte/store"
import { uid } from "uid"
import type { Show, TimelineAction } from "../../../types/Show"
import { AudioPlayer } from "../../audio/audioPlayer"
import type { ShowObj } from "../../classes/Show"
import { fixShowIssues } from "../../converters/importHelpers"
import { requestMain } from "../../IPC/main"
import { cachedShowsData, categories, notFound, saved, shows, showsCache, textCache } from "../../stores"
import { invalidateSearchIndex } from "../../utils/searchFast"
import { Main } from "./../../../types/IPC/Main"
import { getFileName } from "./media"
import { getShowCacheId, updateCachedShow } from "./show"

export async function setShow(id: string, value: "delete" | Show): Promise<Show> {
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

            value = await convertOldShowValues(value)
        }
    }

    // remove from not found list
    if (value !== "delete" && get(notFound).show.includes(id)) {
        notFound.update((a) => {
            a.show = a.show.filter((x) => x !== id)
            return a
        })
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
                quickAccess: value.quickAccess || {}
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

export async function convertOldShowValues(show: Show): Promise<Show> {
    // convert Recording to timeline (pre 1.5.7)
    await Promise.all(
        Object.values(show.layouts).map(async (layout) => {
            const rec = layout.recording?.[0]
            if (!rec) return

            let actions: TimelineAction[] = []
            // let maxTime: number = 0

            // get any audio on first slide
            const audioIds = layout.slides[0]?.audio || []
            const audioPaths = audioIds.map((id) => show.media[id]?.path || "").filter(Boolean)
            await Promise.all(
                audioPaths.map(async (path) => {
                    const duration = await AudioPlayer.getDuration(path)
                    // if (duration > maxTime) maxTime = duration

                    actions.push({
                        id: uid(6),
                        time: 0,
                        duration,
                        name: getFileName(path),
                        type: "audio",
                        data: { path }
                    })
                })
            )
            if (audioIds.length) delete layout.slides[0].audio

            let currentTime = 0
            actions.push(
                ...rec.sequence.map((seq) => {
                    let slideId = seq.slideRef?.id
                    // look for a parent slide
                    if (!show.slides[slideId]?.group) {
                        slideId = Object.keys(show.slides).find((id) => show.slides[id]?.children?.includes(slideId)) || ""
                    }
                    const slideGroup = show.slides[slideId]?.group || ""

                    const time = currentTime
                    currentTime += seq.time

                    return {
                        id: uid(6),
                        time,
                        name: slideGroup,
                        type: "slide",
                        data: seq.slideRef
                    }
                })
            )

            layout.timeline = { actions }
            // if (maxTime) layout.timeline.maxTime = maxTime

            // remove start recording action
            const startRecordingAction = (layout.slides[0]?.actions?.slideActions || []).findIndex((a) => a.triggers?.includes("start_slide_recording"))
            if (startRecordingAction > -1) {
                layout.slides[0].actions!.slideActions!.splice(startRecordingAction, 1)
            }

            delete layout.recording
        })
    )

    return show
}

const currentlyLoading = new Map<string, Promise<void>>()
const lastFailed = new Map<string, number>()

async function loadSingleShow(id: string) {
    let promise = currentlyLoading.get(id)
    if (promise) return promise

    const isNotFound = get(notFound).show.includes(id)
    if (isNotFound && Date.now() - (lastFailed.get(id) || 0) < 5000) return

    if (isNotFound) lastFailed.set(id, Date.now())

    promise = (async () => {
        try {
            const data = await requestMain(Main.SHOW, { name: get(shows)[id]?.name, id })
            if (!data || data.error || !data.content) {
                const targetId = data?.id || id
                notFound.update((a) => {
                    if (!a.show.includes(targetId)) a.show.push(targetId)
                    return a
                })
                lastFailed.set(targetId, Date.now())
                return
            }

            if (get(showsCache)[data.id]) return

            let content = data.content[1]
            if (typeof content === "string") {
                content = JSON.parse(content)
                if (!content?.[1]?.name) return
                content = content[1]
            }

            notFound.update((a) => {
                const index = a.show.indexOf(data.id)
                if (index > -1) a.show.splice(index, 1)
                return a
            })
            lastFailed.delete(data.id)

            const show = fixShowIssues(content)
            if (!show) return

            await setShow(data.id || data.content[0], show)
        } catch (err) {
            console.error("Error loading show:", id, err)
            lastFailed.set(id, Date.now())
        } finally {
            currentlyLoading.delete(id)
        }
    })()

    currentlyLoading.set(id, promise)
    return promise
}

export async function loadShows(s: string[], deleting = false) {
    const savedBeforeLoading = !deleting && get(saved)

    const promises: Promise<void>[] = []
    s.forEach((id) => {
        if (!get(shows)[id]) {
            notFound.update((a) => {
                if (!a.show.includes(id)) a.show.push(id)
                return a
            })
        } else if (!get(showsCache)[id]) {
            const promise = loadSingleShow(id)
            if (promise) promises.push(promise)
        }
    })

    if (promises.length) {
        await Promise.all(promises)
        if (savedBeforeLoading) setTimeout(() => saved.set(true), 200)
    }
}

let updateTimeout: NodeJS.Timeout | null = null
let tempCache: { [key: string]: string } = {}
export function saveTextCache(id: string, show: Show) {
    // don't cache scripture/calendar shows text or archived categories
    if (!show?.slides || show?.reference?.type || get(categories)[show.category || ""]?.isArchive) return

    const txt = getTextCacheString(show)
    tempCache[id] = txt

    // prevent rapid updates
    if (updateTimeout) clearTimeout(updateTimeout)
    updateTimeout = setTimeout(() => {
        textCache.set({ ...get(textCache), ...tempCache })
        tempCache = {}
        invalidateSearchIndex()
    }, 1000)
}
function getTextCacheString(show: Show) {
    return Object.values(show.slides)
        .flatMap((slide) => slide?.items)
        .flatMap((item) => item?.lines || [])
        .flatMap((line) => line?.text || [])
        .map((text) => text?.value || "")
        .join(" ")
        .toLowerCase()
    // .replace(/[^a-z0-9 ]+/g, "")

    // encode
    // txt = window.btoa(txt)
    // txt = Buffer.from(txt).toString("base64")
    // Buffer.from(encode, 'base64').toString('utf-8')
    // window.atob(encode)
}

export function setQuickAccessMetadata(show: ShowObj, key: string, value: string) {
    if (!value) return show

    if (!show.quickAccess) show.quickAccess = {}
    if (!show.quickAccess.metadata) show.quickAccess.metadata = {}
    show.quickAccess.metadata[key] = value

    return show
}
