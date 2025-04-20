import { get } from "svelte/store"
import type { OutSlide } from "../../../types/Show"
import { clearAudio } from "../../audio/audioFading"
import {
    activeEdit,
    activePage,
    activePopup,
    activeStage,
    contextActive,
    customMessageCredits,
    drawSettings,
    lockedOverlays,
    outLocked,
    outputCache,
    outputs,
    outputSlideCache,
    overlays,
    overlayTimers,
    playingAudio,
    playingMetronome,
    selected,
    slideTimers,
    topContextActive,
    videosData,
    videosTime,
} from "../../stores"
import { customActionActivation } from "../actions/actions"
import { clone } from "../helpers/array"
import { clearOverlayTimer, clearPlayingVideo, getActiveOutputs, isOutCleared, setOutput } from "../helpers/output"
import { _show } from "../helpers/shows"
import { stopSlideRecording } from "../helpers/slideRecording"

export function clearAll(button: boolean = false) {
    if (get(outLocked)) return
    if (!button && (get(activePopup) || (get(selected).id && get(selected).id !== "scripture") || (get(activePage) === "edit" && get(activeEdit).items.length) || get(activeStage).items.length || get(contextActive) || get(topContextActive))) return

    // reset slide cache on Escape
    outputSlideCache.set({})

    let audioCleared = !Object.keys(get(playingAudio)).length && !get(playingMetronome)
    let allCleared = isOutCleared(null) && audioCleared
    if (allCleared) return

    storeCache()

    clearBackground()
    clearSlide(true)
    clearOverlays()
    clearAudio("", { clearPlaylist: true, commonClear: true })
    clearTimers()
}

function storeCache() {
    if (!get(outputCache)) outputCache.set({})

    let activeOutputs = getActiveOutputs()

    outputCache.update((a) => {
        // only store active outputs
        activeOutputs.forEach((id: any) => {
            let out = get(outputs)[id]?.out
            if (out) a[id] = clone(out)
        })
        return a
    })
}

export function restoreOutput() {
    if (get(outLocked) || !get(outputCache)) return

    let activeOutputs = getActiveOutputs()

    outputs.update((a) => {
        Object.keys(get(outputCache)).forEach((id) => {
            // restore only selected outputs
            if (!activeOutputs.includes(id) || !a[id]) return
            a[id].out = get(outputCache)[id]
        })

        return a
    })

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

export function clearSlide(clearAll: boolean = false) {
    if (!clearAll) {
        // store position
        let slideCache: { [key: string]: OutSlide } = {}
        let outputIds: string[] = getActiveOutputs()
        outputIds.forEach((outputId) => {
            let slide = get(outputs)[outputId]?.out?.slide || null
            if (!slide?.id || slide.index === undefined) return

            // only store if not last slide
            let layoutRef = _show(slide.id).layouts([slide.layout]).ref()[0] || []
            if (slide.index >= layoutRef.length - 1) return

            slideCache[outputId] = slide
        })
        if (Object.keys(slideCache).length) {
            outputSlideCache.set(clone(slideCache))
        }

        // slide gets outlined if not blurred
        ; (document.activeElement as any)?.blur()
    }

    setOutput("slide", null)
    stopSlideRecording()
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
    // clear slide timers
    setOutput("transition", null, false, outputId)

    let outputIds: string[] = outputId ? [outputId] : getActiveOutputs()
    Object.keys(get(slideTimers)).forEach((id) => {
        if (outputIds.includes(id)) get(slideTimers)[id].timer?.clear()
    })

    // clear overlay timers
    outputIds.forEach((outputId) => {
        Object.values(get(overlayTimers)).forEach((a) => {
            if (a.outputId === outputId) {
                clearTimeout(a.timer)
                clearOverlayTimer(a.outputId, a.overlayId)
            }
        })
    })
}

export function clearDrawing() {
    drawSettings.update((a) => {
        if (!a.paint) return a
        a.paint.clear = true
        return a
    })
}
