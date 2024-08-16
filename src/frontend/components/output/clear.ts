import { get } from "svelte/store"
import { activeEdit, activePopup, customMessageCredits, lockedOverlays, outLocked, outputCache, outputs, overlays, playingAudio, playingMetronome, selected, slideTimers, videosData, videosTime } from "../../stores"
import { clearPlayingVideo, getActiveOutputs, isOutCleared, setOutput } from "../helpers/output"
import { clearAudio } from "../helpers/audio"
import { clone } from "../helpers/array"
import { customActionActivation } from "../actions/actions"

export function clearAll(button: boolean = false) {
    if (get(outLocked)) return
    if (!button && (get(activePopup) || get(selected).id || get(activeEdit).items.length)) return

    let audioCleared = !Object.keys(get(playingAudio)).length && !get(playingMetronome)
    let allCleared = isOutCleared(null) && audioCleared
    if (allCleared) return

    if (!get(outputCache)) outputCache.set(clone(get(outputs)))

    clearBackground()
    clearSlide()
    clearOverlays()
    clearAudio()
    clearTimers()
}

// WIP restore only selected outputs
export function restoreOutput() {
    if (get(outLocked) || !get(outputCache)) return

    outputs.set(get(outputCache))
    outputCache.set(null)
}

export function clearBackground(outputId: string = "") {
    let outputIds: string[] = outputId ? [outputId] : getActiveOutputs()

    outputIds.forEach((outputId) => {
        // clearVideo()
        setOutput("background", null, false, outputId)
        clearPlayingVideo(outputId)

        // WIP this does not clear time properly
        videosData.update((a) => {
            delete a[outputId]
            return a
        })
        videosTime.update((a) => {
            delete a[outputId]
            return a
        })
    })

    customMessageCredits.set("") // unsplash
    customActionActivation("background_cleared")
}

export function clearSlide() {
    setOutput("slide", null)
    customActionActivation("slide_cleared")
}

export function clearOverlays(outputId: string = "") {
    let outputIds: string[] = outputId ? [outputId] : getActiveOutputs()

    outputIds.forEach((outputId) => {
        let outOverlays: string[] = get(outputs)[outputId]?.out?.overlays || []
        outOverlays = outOverlays.filter((id) => get(overlays)[id]?.locked)
        setOutput("overlays", outOverlays, false, outputId)
    })

    lockedOverlays.set([])
}

export function clearTimers(outputId: string = "") {
    setOutput("transition", null, false, outputId)

    let outputIds: string[] = outputId ? [outputId] : getActiveOutputs()
    Object.keys(get(slideTimers)).forEach((id) => {
        if (outputIds.includes(id)) get(slideTimers)[id].timer?.clear()
    })
}
