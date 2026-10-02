import { get } from "svelte/store"
import { OUTPUT } from "../../../types/Channels"
import type { Item } from "../../../types/Show"
import { outputs, overlays, showsCache, websiteReload, websiteSlideControl } from "../../stores"
import { send } from "../../utils/request"
import { _show } from "./shows"

type KeyCode = "Right" | "Left"

// Website items with "Send next/previous slide to website" (e.g. a Canva presentation)
// take next/previous slide (keyboard, clickers, remote, API) while they are live on an output.
// Returns true if a website took it.
export function sendSlideControlToWebsite(outputId: string, direction: "next" | "previous"): boolean {
    if (!outputId || !getLiveWebsites(outputId).some((website) => website.slideControls)) return false

    sendWebsiteKey(outputId, direction === "next" ? "Right" : "Left")
    return true
}

// the output window has the live website, but the main window previews should follow along too
export function sendWebsiteKey(outputId: string, keyCode: KeyCode, src = "") {
    const data = { outputId, keyCode, ...(src ? { src } : {}) }
    send(OUTPUT, ["WEBSITE_KEY"], data)
    websiteSlideControl.set({ ...data, time: Date.now() })
}

export function reloadWebsite(outputId: string, src: string) {
    send(OUTPUT, ["WEBSITE_RELOAD"], { outputId, src })
    websiteReload.set({ outputId, src, time: Date.now() })
}

// website items live on an output (current slide & overlays)
export function getLiveWebsites(outputId: string): { src: string; slideControls: boolean }[] {
    return getLiveItems(outputId)
        .filter((item) => item?.type === "web" && item.web?.src)
        .map((item) => ({ src: formatWebsiteUrl(item.web.src), slideControls: !!item.web.slideControls }))
}

function getLiveItems(outputId: string): Item[] {
    const out = get(outputs)[outputId]?.out
    if (!out) return []

    const items: Item[] = []

    const outSlide = out.slide
    if (outSlide?.tempItems) {
        items.push(...outSlide.tempItems)
    } else if (outSlide?.id && outSlide.layout && typeof outSlide.index === "number") {
        const ref = _show(outSlide.id).layouts([outSlide.layout]).ref()[0] || []
        const slideId = ref[outSlide.index]?.id
        items.push(...(get(showsCache)[outSlide.id]?.slides?.[slideId]?.items || []))
    }

    ;(out.overlays || []).forEach((overlayId) => items.push(...(get(overlays)[overlayId]?.items || [])))

    return items
}

// same formatting as the website item uses for its url
export function formatWebsiteUrl(src: string) {
    if (!src) return ""
    src = src.replaceAll("&amp;", "&").replaceAll("{", "%7B").replaceAll("}", "%7D")
    if (!src.includes("://")) src = "http://" + src
    return src
}
