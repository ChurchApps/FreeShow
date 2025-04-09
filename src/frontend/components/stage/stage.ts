import { get } from "svelte/store"
import type { Item } from "../../../types/Show"
import type { StageItem } from "../../../types/Stage"
import { translate } from "../../utils/language"
import { arrayToObject, filterObjectArray } from "../../utils/sendData"
import { STAGE } from "./../../../types/Channels"
import { connections, stageShows, timers, variables } from "./../../stores"

export function updateStageShow() {
    Object.entries(get(connections).STAGE || {}).forEach(([id, stage]) => {
        let show = arrayToObject(filterObjectArray([get(stageShows)[stage.active || ""]], ["disabled", "name", "settings", "items"]))[0]
        if (!show.disabled) window.api.send(STAGE, { channel: "LAYOUT", id, data: show })
    })
}

export function getCustomStageLabel(itemId: string, item: StageItem, _updater: any = null): string {
    if (!itemId.includes("#")) {
        let name = ""

        if (itemId === "variable") name = get(variables)[item.variable?.id!]?.name
        else if (itemId === "timer") name = get(timers)[item.timer?.id]?.name

        name = name || translate(`items.${itemId}`)

        const slideOffset = Number(item.slideOffset || 0)
        if (itemId === "slide_text" && slideOffset === 0) name = translate("stage.current_slide_text") || name
        else if (itemId === "slide_text" && slideOffset === 1) name = translate("stage.next_slide_text") || name + " +1"
        else if ((itemId === "slide_text" || itemId === "slide_notes") && slideOffset) name += ` ${slideOffset > 0 ? "+" : ""}${slideOffset}`

        return name
    }

    // < 1.4.0
    if (itemId.includes("global_timers") && !itemId.includes("first_active_timer")) return get(timers)[getStageItemId(itemId)]?.name || ""
    if (itemId.includes("variables")) return get(variables)[getStageItemId(itemId)]?.name || ""

    return translate(`stage.${itemId.split("#")[1]}`)
}

export function getStageItemId(itemId: string) {
    return itemId.split("#")[1]
}

export function stageItemToItem(item: StageItem) {
    let newItem: Item = {
        style: item?.style || "",
    }
    if (!item) return newItem

    // type, align, auto, src, timer, clock, tracker, variable, etc.
    if (item.chords) newItem.chords = typeof item.chords === "boolean" ? { enabled: item.chords, ...((item as any).chordsData || {}) } : item.chords
    // if (item.clock) newItem.clock = { seconds: true, ...item.clock }

    return { ...item, ...newItem } as Item
}
