import { get } from "svelte/store"
import { outLocked, slideTimers } from "../../stores"
import { getActiveOutputs, setOutput } from "../helpers/output"
import { clearOverlays } from "../helpers/showActions"
import { clearAudio } from "../helpers/audio"

export const clearAll = () => {
    if (get(outLocked)) return

    // clear video in "preview"
    setOutput("background", null)
    setOutput("slide", null)
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
