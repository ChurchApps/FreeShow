import { get } from "svelte/store"
import { getActiveOutputs } from "./output"
import { outputs, styles } from "../../stores"
import { send } from "../../utils/request"
import { OUTPUT } from "../../../types/Channels"

export function updateVideoTime(time: number) {
    const activeOutputIds = getActiveOutputs(get(outputs), true, true, true)

    let timeValues: { [key: string]: number } = {}
    activeOutputIds.forEach((id: any) => {
        timeValues[id] = time
    })

    send(OUTPUT, ["TIME"], timeValues)
}

export function updateVideoData(data: any) {
    const activeOutputIds = getActiveOutputs(get(outputs), true, true, true)
    const backgroundOutputId = activeOutputIds.find((id: any) => getLayersFromId(id).includes("background")) || activeOutputIds[0]

    let dataValues: any = {}
    activeOutputIds.forEach((id: any) => {
        dataValues[id] = { ...data, muted: id !== backgroundOutputId ? true : data.muted }
    })

    send(OUTPUT, ["DATA"], dataValues)
}

function getLayersFromId(id: string) {
    const layers = get(styles)[get(outputs)[id]?.style || ""]?.layers
    if (Array.isArray(layers)) return layers
    return ["background"]
}
