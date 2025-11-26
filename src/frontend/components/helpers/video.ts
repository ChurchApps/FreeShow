import { get } from "svelte/store"
import { OUTPUT } from "../../../types/Channels"
import { outputs, styles } from "../../stores"
import { send } from "../../utils/request"
import { getAllNormalOutputs } from "./output"

export function updateVideoTime(time: number) {
    const activeOutputIds = getAllNormalOutputs().map((a) => a.id)

    const timeValues: { [key: string]: number } = {}
    activeOutputIds.forEach((id) => {
        timeValues[id] = time
    })

    send(OUTPUT, ["TIME"], timeValues)
}

export function updateVideoData(data: any) {
    const activeOutputIds = getAllNormalOutputs().map((a) => a.id)
    const backgroundOutputId = activeOutputIds.find((id) => getLayersFromId(id).includes("background")) || activeOutputIds[0]

    const dataValues: any = {}
    activeOutputIds.forEach((id) => {
        dataValues[id] = { ...data, muted: id !== backgroundOutputId ? true : data.muted }
    })

    send(OUTPUT, ["DATA"], dataValues)
}

function getLayersFromId(id: string) {
    const layers = get(styles)[get(outputs)[id]?.style || ""]?.layers
    if (Array.isArray(layers)) return layers
    return ["background"]
}

export function getFirstOutputIdWithAudableBackground(outputIds: string[] = [], _updater: any = null) {
    if (!outputIds.length) outputIds = getAllNormalOutputs().map((a) => a.id)

    return outputIds.find(id => {
        const output = get(outputs)[id]
        if (!output || output.stageOutput) return false

        const style = get(styles)[output.style || ""]
        let layers = style?.layers
        if (!Array.isArray(layers)) layers = ["background"]

        return layers.includes("background") && style?.volume !== 0
    }) || null
}
