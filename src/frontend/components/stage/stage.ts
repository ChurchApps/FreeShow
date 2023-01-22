import { STAGE } from "./../../../types/Channels"
import { connections, stageShows } from "./../../stores"
import { get } from "svelte/store"
import { arrayToObject, filterObjectArray } from "../../utils/sendData"

export function updateStageShow() {
    Object.entries(get(connections).STAGE || {}).forEach(([id, stage]: any) => {
        let show = arrayToObject(filterObjectArray([get(stageShows)[stage.active]], ["disabled", "name", "settings", "items"]))[0]
        if (!show.disabled) window.api.send(STAGE, { channel: "SHOW", id, data: show })
    })
}
