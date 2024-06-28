import { get } from "svelte/store"
import { outLocked, slideTimers } from "../../stores"
import { getActiveOutputs, setOutput } from "../helpers/output"
import { clearBackground, clearOverlays, clearSlide } from "../helpers/showActions"
import { clearAudio } from "../helpers/audio"

export const clearAll = () => {
    if (get(outLocked)) return

    // clear video in "preview"
    clearBackground()
    clearSlide()
    clearOverlays()
    clearAudio()
    clearTimers()
}

export function clearTimers(outputId: string = "") {
    setOutput("transition", null, false, outputId)

    let outputIds: string[] = outputId ? [outputId] : getActiveOutputs()
    Object.keys(get(slideTimers)).forEach((id) => {
        if (outputIds.includes(id)) get(slideTimers)[id].timer?.clear()
    })
}
