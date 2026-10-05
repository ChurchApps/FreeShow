import { get } from "svelte/store"
import { OUTPUT } from "../../../types/Channels"
import { outputs, overlays, showsCache, websiteAction } from "../../stores"
import { send } from "../../utils/request"
import { getAllActiveOutputIds } from "./output"
import { _show } from "./shows"

export type WebsiteAction = { type: "key"; keyCode: "Right" | "Left"; src?: string } | { type: "reload"; src?: string }

let websiteEventId = 0
export function nextWebsiteEventId() {
    return ++websiteEventId
}

function triggerWebsiteAction(action: WebsiteAction) {
    send(OUTPUT, ["WEBSITE_ACTION"], action)
    websiteAction.set({ ...action, time: nextWebsiteEventId() })
}

export function sendWebsiteKey(keyCode: "Right" | "Left", src = "") {
    triggerWebsiteAction({ type: "key", keyCode, ...(src ? { src } : {}) })
}

export function reloadWebsite(src = "") {
    triggerWebsiteAction({ type: "reload", ...(src ? { src } : {}) })
}

// website urls live on active outputs (current slides & overlays)
export function getLiveWebsites(outputIds = getAllActiveOutputIds()): { src: string }[] {
    const allOuts = get(outputs)
    const items = outputIds.flatMap((id) => {
        const out = allOuts[id]?.out
        if (!out) return []
        const outSlide = out.slide
        const slideItems = outSlide?.tempItems ? outSlide.tempItems : outSlide?.id && outSlide.layout && typeof outSlide.index === "number" ? get(showsCache)[outSlide.id]?.slides?.[_show(outSlide.id).layouts([outSlide.layout]).ref()[0]?.[outSlide.index]?.id]?.items || [] : []
        const overlayItems = (out.overlays || []).flatMap((overlayId) => get(overlays)[overlayId]?.items || [])
        return [...slideItems, ...overlayItems]
    })

    const urls = new Set<string>()
    return items
        .filter((item) => item?.type === "web" && item.web?.src)
        .map((item) => ({ src: formatWebsiteUrl(item.web.src) }))
        .filter((site) => {
            if (!site.src || urls.has(site.src)) return false
            urls.add(site.src)
            return true
        })
}

export function formatWebsiteUrl(src: string) {
    if (!src) return ""
    src = src.replaceAll("&amp;", "&").replaceAll("{", "%7B").replaceAll("}", "%7D")
    return src.includes("://") ? src : "http://" + src
}
