import { get } from "svelte/store"
import { audioChannelsData, outputs, styles } from "../../stores"
import { getAllNormalOutputs } from "./output"

export function getFirstOutputIdWithBackground(outputIds: string[] = [], _updater: any = null) {
    if (!outputIds.length) outputIds = getAllNormalOutputs().map((a) => a.id)

    return (
        outputIds.find((id) => {
            const output = get(outputs)[id]
            if (!output || output.stageOutput) return false

            const style = get(styles)[output.style || ""]
            let layers = style?.layers
            if (!Array.isArray(layers)) layers = ["background"]

            return layers.includes("background")
        }) || null
    )
}

export function muteOutput(id: string) {
    setOutputMute(id, true)
}
export function unmuteOutput(id: string) {
    setOutputMute(id, false)
}

function setOutputMute(id: string, state: boolean) {
    if (!get(outputs)[id]) return

    audioChannelsData.update((data) => {
        if (!data[id]) data[id] = { volume: 1, isMuted: false }
        data[id].isMuted = state
        return data
    })
}
