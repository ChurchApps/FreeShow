import { STAGE } from "./../../../types/Channels"
import { connections, stageShows, timers, variables } from "./../../stores"
import { get } from "svelte/store"
import { arrayToObject, filterObjectArray } from "../../utils/sendData"
import { translate } from "../../utils/language"

export function updateStageShow() {
    Object.entries(get(connections).STAGE || {}).forEach(([id, stage]: any) => {
        let show = arrayToObject(filterObjectArray([get(stageShows)[stage.active]], ["disabled", "name", "settings", "items"]))[0]
        if (!show.disabled) window.api.send(STAGE, { channel: "SHOW", id, data: show })
    })
}

export function getCustomStageLabel(itemId: string): string {
    if (itemId.includes("global_timers")) return get(timers)[getStageItemId(itemId)]?.name || ""
    if (itemId.includes("variables")) return get(variables)[getStageItemId(itemId)]?.name || ""

    return translate(`stage.${itemId.split("#")[1]}`)
}

export function getStageItemId(itemId: string) {
    return itemId.split("#")[1]
}
