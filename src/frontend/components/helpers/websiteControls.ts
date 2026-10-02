import { get } from "svelte/store"
import { OUTPUT } from "../../../types/Channels"
import type { Item } from "../../../types/Show"
import { outputs, overlays, showsCache, websiteSlideControl } from "../../stores"
import { send } from "../../utils/request"
import { _show } from "./shows"

// Website items with "Send next/previous slide to website" (e.g. a Canva presentation)
// take next/previous slide (keyboard, clickers, remote, API) while they are live on an output.
// Returns true if a website took it.
export function sendSlideControlToWebsite(outputId: string, direction: "next" | "previous"): boolean {
    if (!outputId || !hasSlideControlsWebsite(getLiveItems(outputId))) return false

    const keyCode = direction === "next" ? "Right" : "Left"
    // the output window has the live website, but the main window previews should follow along too
    send(OUTPUT, ["WEBSITE_KEY"], { outputId, keyCode })
    websiteSlideControl.set({ outputId, keyCode, time: Date.now() })
    return true
}

export function hasSlideControlsWebsite(items: Item[]) {
    return items.some((item) => item?.type === "web" && item.web?.slideControls && item.web?.src)
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
