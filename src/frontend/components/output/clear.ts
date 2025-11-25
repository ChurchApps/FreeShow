import { get } from "svelte/store"
import type { OutSlide } from "../../../types/Show"
import { clearAudio } from "../../audio/audioFading"
import { AudioPlayer } from "../../audio/audioPlayer"
import {
    activeEdit,
    activePage,
    activePopup,
    activeStage,
    contextActive,
    customMessageCredits,
    drawSettings,
    focusMode,
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
    videosTime
} from "../../stores"
import { customActionActivation } from "../actions/actions"
import { startMetronome } from "../drawer/audio/metronome"
import { clone } from "../helpers/array"
import { clearOverlayTimer, clearPlayingVideo, getAllActiveOutputs, isOutCleared, setOutput } from "../helpers/output"
import { _show } from "../helpers/shows"
import { stopSlideRecording } from "../helpers/slideRecording"

export function clearAll(button = false) {
    if (get(outLocked)) return
    if (!button && (get(activePopup) || (get(selected).id && get(selected).id !== "scripture") || (get(activePage) === "edit" && get(activeEdit).items.length) || get(activeStage).items.length || get(contextActive) || get(topContextActive))) return

    // reset slide cache on Escape
    outputSlideCache.set({})

    const audioCleared = !Object.keys(get(playingAudio)).length && !get(playingMetronome)
    const allCleared = isOutCleared(null) && audioCleared
    if (allCleared) return

    storeCache()

    const keepLastSlide = get(focusMode)
    clearBackground()
    clearSlide(!keepLastSlide)
    clearOverlays()
    clearAudio("", { clearPlaylist: true, commonClear: true })
    clearTimers()
}

function storeCache() {
    if (!get(outputCache)) outputCache.set({})

    const activeOutputs = getAllActiveOutputs()

    outputCache.update((a) => {
        // only store active outputs
        activeOutputs.forEach(({ id }) => {
            const out = get(outputs)[id]?.out
            if (out) a[id] = clone(out)
        })

        // audio
        a.playingAudioData = AudioPlayer.getAllPlaying().map((path) => {
            const playing = get(playingAudio)[path]
            return { path, metadata: { name: playing.name }, options: { startAt: playing.audio?.currentTime || 0 } }
        })
        a.playingMetronome = get(playingMetronome)

        return a
    })
}

export function restoreOutput() {
    if (get(outLocked) || !get(outputCache)) return

    const activeOutputIds = getAllActiveOutputs().map(({ id }) => id)

    outputs.update((a) => {
        Object.keys(get(outputCache)).forEach((id) => {
            if (id.includes("playing")) return
            // restore only selected outputs
            if (!activeOutputIds.includes(id) || !a[id]) return
            a[id].out = get(outputCache)[id]
        })

        return a
    })

    // audio
    if (get(outputCache).playingAudioData) {
        get(outputCache).playingAudioData.forEach((data) => {
            AudioPlayer.start(data.path, data.metadata, data.options)
        })
    }
    if (get(outputCache).playingMetronome) startMetronome()

    outputCache.set(null)
}

export function clearBackground(specificOutputId = "") {
    const outputIds = specificOutputId ? [specificOutputId] : getAllActiveOutputs().map(({ id }) => id)

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

// shouldClearAll = don't keep cached previous slide
export function clearSlide(shouldClearAll = false) {
    if (!shouldClearAll) {
        // store position
        const slideCache: { [key: string]: OutSlide } = {}
        const activeOutputs = getAllActiveOutputs()
        activeOutputs.forEach((output) => {
            const slide = output?.out?.slide || null
            if (!slide?.id || slide.index === undefined) return

            // only store if not last slide & not in focus mode
            const layoutRef = _show(slide.id).layouts([slide.layout]).ref()[0] || []
            if (!get(focusMode) && slide.index >= layoutRef.length - 1) return

            slideCache[output.id] = slide
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

export function clearOverlay(overlayId: string) {
    const activeOutputs = getAllActiveOutputs()

    activeOutputs.forEach((output) => {
        let outOverlays = output?.out?.overlays || []
        outOverlays = outOverlays.filter((id) => id !== overlayId)
        lockedOverlays.set(get(lockedOverlays).filter((id) => id !== overlayId))

        setOutput("overlays", outOverlays, false, output.id)

        // clear effects
        let outEffects: string[] = output?.out?.effects || []
        outEffects = outEffects.filter((id) => id !== overlayId)
        setOutput("effects", outEffects, false, output.id)
    })
}

export function clearOverlays(specificOutputId = "") {
    const outputIds = specificOutputId ? [specificOutputId] : getAllActiveOutputs().map(({ id }) => id)

    outputIds.forEach((outputId) => {
        let outOverlays = clone(get(outputs)[outputId]?.out?.overlays || [])
        outOverlays = outOverlays.filter((id) => get(overlays)[id]?.locked)
        setOutput("overlays", outOverlays, false, outputId)
        lockedOverlays.set(outOverlays)

        // effects
        // let outEffects: string[] = get(outputs)[outputId]?.out?.effects || []
        setOutput("effects", [], false, outputId)
    })
}

export function clearTimers(specificOutputId = "", clearOverlayTimers = true) {
    if (specificOutputId && !get(slideTimers)[specificOutputId] && !get(outputs)[specificOutputId]?.out?.transition) return

    // clear slide timers
    setOutput("transition", null, false, specificOutputId)

    const outputIds = specificOutputId ? [specificOutputId] : getAllActiveOutputs().map(({ id }) => id)
    Object.keys(get(slideTimers)).forEach((id) => {
        if (outputIds.includes(id)) get(slideTimers)[id].timer?.clear()
    })

    if (!clearOverlayTimers) return

    // clear overlay/effect timers
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
