import { get } from "svelte/store"
import { OUTPUT } from "../../../types/Channels"
import { outputs, showsCache, websiteAction } from "../../stores"
import { send } from "../../utils/request"
import { clone } from "./array"
import { getAllActiveOutputIds } from "./output"
import { _show } from "./shows"

export type WebsiteAction = { src: string; type: "key"; keyCode: string } | { src: string; type: "reload" }

export function triggerWebsiteAction(action: WebsiteAction) {
    send(OUTPUT, ["WEBSITE_ACTION"], action)
    websiteAction.set(action)
}
export function sendWebsiteKey(src: string, keyCode: string) {
    triggerWebsiteAction({ src, type: "key", keyCode })
}

export function getOutputtedWebsites(_updater: any = null): { src: string }[] {
    const activeOutputIds = getAllActiveOutputIds()
    const items = activeOutputIds.flatMap((id) => {
        const out = get(outputs)[id]?.out
        if (!out) return []

        const outSlide = out.slide
        if (!outSlide?.id || !outSlide.layout || outSlide.index === undefined) return []

        const ref = _show(outSlide.id).layouts([outSlide.layout]).ref()[0]
        const slideId = ref?.[outSlide.index]?.id
        const slideItems = get(showsCache)[outSlide.id]?.slides?.[slideId]?.items || []

        // const overlayItems = (out.overlays || []).flatMap((overlayId) => get(overlays)[overlayId]?.items || [])
        return slideItems
    })

    const foundUrls = new Set<string>()
    return clone(items)
        .filter((item) => item?.type === "web" && item.web?.src)
        .map((item) => ({ src: item.web.src }))
        .filter((item) => {
            if (foundUrls.has(item.src)) return false
            foundUrls.add(item.src)
            return true
        })
}
