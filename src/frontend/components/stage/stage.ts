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
        if (!show.disabled) window.api.send(STAGE, { channel: "SHOW", id, data: show })
    })
}

export function getCustomStageLabel(itemId: string, _updater: any = null): string {
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

    newItem = {
        ...newItem,
        align: item.align,
        auto: item.auto,
        chords: { enabled: item.chords, ...item.chordsData },
    }

    if (item.timer) newItem.timer = item.timer
    if (item.clock) newItem.clock = item.clock
    if (item.tracker) newItem.tracker = item.tracker

    return newItem
}
