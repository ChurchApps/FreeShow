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

export function clearTimers() {
    setOutput("transition", null)
    let outs = getActiveOutputs()
    Object.keys(get(slideTimers)).forEach((id) => {
        if (outs.includes(id)) get(slideTimers)[id].timer?.clear()
    })
}
