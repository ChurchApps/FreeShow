// CROSSFADE

import { get } from "svelte/store"
import { customActionActivation } from "../components/actions/actions"
import { stopMetronome } from "../components/drawer/audio/metronome"
import { activePlaylist, audioPlaylists, isFadingOut, playingAudio, special } from "../stores"
import { AudioPlayer } from "./audioPlayer"
import { AudioPlaylist } from "./audioPlaylist"
import { AudioAnalyser } from "./audioAnalyser"

type AudioClearOptions = {
    clearPlaylist?: boolean
    clearMicrophones?: boolean
    playlistCrossfade?: boolean
    commonClear?: boolean
    clearTime?: number // effects
    isPlayingNew?: boolean
}

export const clearing: string[] = []
let forceClear = false
export function clearAudio(audioPath = "", options: AudioClearOptions = {}) {
    // turn off any playlist
    if (options.clearPlaylist && (!audioPath || AudioPlaylist.getPlayingKey() === audioPath)) activePlaylist.set(null)

    // stop playing metronome
    if (!options.isPlayingNew && options.clearPlaylist !== false && !audioPath) stopMetronome()

    if (clearing.includes(audioPath)) {
        if (!options.commonClear) return
        // force stop audio files (bypass timeout if already active)
        forceClear = true
        setTimeout(() => (forceClear = false), 100)
        return
    }
    if (!Object.keys(get(playingAudio)).length) {
        isFadingOut.set(false)
        return
    }

    const clearTime = options.playlistCrossfade ? 0 : (options.clearTime ?? get(special).audio_fade_duration ?? 1.5)
    let clearIds = audioPath ? [audioPath] : Object.keys(get(playingAudio))
    // don't clear microphones by default
    if (!audioPath && !options.clearMicrophones) {
        const allPlaying = get(playingAudio)
        clearIds = clearIds.filter((id) => !allPlaying[id]?.isMic)
    }
    clearIds.forEach(clear)

    async function clear(path: string) {
        if (clearing.includes(path)) return

        clearing.push(path)
        try {
            const audio = AudioPlayer.getAudio(path)
            if (!audio) return deleteAudio(path)

            const faded = await fadeAudio(path, audio, clearTime)
            if (faded) removeAudio(path)
            else deleteAudio(path)
        } catch {
            deleteAudio(path)
        } finally {
            const index = clearing.indexOf(path)
            if (index !== -1) clearing.splice(index, 1)
        }
    }

    function removeAudio(path: string) {
        const audio = AudioPlayer.getAudio(path)
        if (!audio) return deleteAudio(path)

        audio.pause()
        customActionActivation("audio_end")
        deleteAudio(path)
    }

    function deleteAudio(path: string) {
        isFadingOut.set(false)
        AudioPlayer.stop(path)

        const index = clearing.indexOf(path)
        if (index !== -1) clearing.splice(index, 1)

        if (!Object.keys(get(playingAudio)).length) {
            isAllAudioFading = false
        }
    }
}

const currentlyCrossfadingOut: string[] = []
export function fadeOutAudio(crossfade = 0) {
    stopFading()

    Object.entries(get(playingAudio)).forEach(async ([path, { audio }]) => {
        const type = AudioPlayer.getAudioType(path, audio.duration)
        if (type === "effect" || currentlyCrossfadingOut.includes(path) || clearing.includes(path)) return
        currentlyCrossfadingOut.push(path)

        const faded = await fadeAudio(path, audio, crossfade)

        currentlyCrossfadingOut.splice(currentlyCrossfadingOut.indexOf(path), 1)
        if (!faded) return

        customActionActivation("audio_end")
        AudioPlayer.stop(path)
    })
}
// if no "path" is provided it will fade out/clear all audio
const currentlyCrossfadingIn: string[] = []
export function fadeInAudio(path: string, crossfade: number, waitToPlay = false, fadeToVolume = 1) {
    if (!path || currentlyCrossfadingIn.includes(path) || currentlyCrossfadingOut.includes(path) || clearing.includes(path)) return

    currentlyCrossfadingIn.push(path)
    const waitTime = waitToPlay ? crossfade * 0.6 * 1000 : 0
    setTimeout(async () => {
        const playing = AudioPlayer.getPlaying(path)?.audio
        if (!playing || clearing.includes(path)) {
            currentlyCrossfadingIn.splice(currentlyCrossfadingIn.indexOf(path), 1)
            return
        }

        await fadeAudio(path, playing, waitToPlay ? crossfade * 0.4 : crossfade, true, fadeToVolume)
        currentlyCrossfadingIn.splice(currentlyCrossfadingIn.indexOf(path), 1)
    }, waitTime)
}

const speed = 0.01
const currentlyFading: { [key: string]: NodeJS.Timeout } = {}
const currentlyFadingTimeouts: { [key: string]: NodeJS.Timeout } = {}
const currentlyFadingResolvers: { [key: string]: (val: boolean) => void } = {}

async function fadeAudio(id: string, audio: HTMLAudioElement, duration = 1, increment = false, fadeToVolume = 1): Promise<boolean> {
    duration = Number(duration)
    const fadeId = (increment ? "in_" : "out_") + id
    const oppositeFadeId = (increment ? "out_" : "in_") + id

    if (!audio || !duration) return true
    if (currentlyFading[fadeId]) return true

    if (currentlyFading[oppositeFadeId]) {
        stopFade(oppositeFadeId, false)
    }

    // no need to fade out if paused
    if (!increment && audio.paused) return true

    let currentSpeed = speed
    if (duration < 1) currentSpeed *= 10

    const time = duration * 1000 * currentSpeed

    // get speed relative to current volume level
    if (increment) currentSpeed *= fadeToVolume / 1
    else currentSpeed *= audio.volume / 1

    // WIP non linear easing

    if (!increment) {
        isFadingOut.set(true)
    }

    return new Promise((resolve) => {
        currentlyFadingResolvers[fadeId] = resolve

        currentlyFading[fadeId] = setInterval(() => {
            if (forceClear || (increment && currentlyCrossfadingOut.includes(id))) return stopFade(fadeId, true)

            if (increment) {
                audio.volume = Math.min(fadeToVolume, Number((audio.volume + currentSpeed).toFixed(3)))
                AudioAnalyser.setSourceVolume(id, audio.volume)
                if (audio.volume >= fadeToVolume) stopFade(fadeId, true)
            } else {
                audio.volume = Math.max(0, Number((audio.volume - currentSpeed).toFixed(3)))
                AudioAnalyser.setSourceVolume(id, audio.volume)
                if (audio.volume <= 0) stopFade(fadeId, true)
            }
        }, time)

        currentlyFadingTimeouts[fadeId] = setTimeout(() => {
            stopFade(fadeId, true)
        }, duration * 1500)
    })
}

export function audioIsFading() {
    return !!Object.keys(currentlyFading).length
}

// fade out/in when video starts playing
export let isAllAudioFading = false
export function fadeoutAllPlayingAudio() {
    isAllAudioFading = true

    Object.entries(get(playingAudio)).forEach(([path, { audio }]) => {
        if (audio && !audio.paused && !clearing.includes(path)) {
            fadeoutAudio(path, audio)
        }
    })

    async function fadeoutAudio(path: string, audio: HTMLAudioElement) {
        const faded = await fadeAudio(path, audio, get(special).audio_fade_duration ?? 1.5)
        if (faded && !clearing.includes(path)) {
            audio.pause()
            // analyseAudio()
        }
    }
}
export function fadeinAllPlayingAudio() {
    if (!isAllAudioFading) return
    isFadingOut.set(false)

    let fadeToVolume = 1
    if (get(activePlaylist)?.id) {
        const playlist = get(audioPlaylists)[get(activePlaylist).id]
        fadeToVolume = (playlist?.volume ?? 1) * fadeToVolume
    }

    Object.entries(get(playingAudio)).forEach(([path, { audio, replayGainMultiplier }]) => {
        if (audio && !clearing.includes(path)) {
            fadeinAudio(path, audio, replayGainMultiplier || 1)
        }
    })

    isAllAudioFading = false

    async function fadeinAudio(path: string, audio: HTMLAudioElement, gainMultiplier = 1) {
        if (clearing.includes(path)) return
        audio.play().catch(() => {})
        await fadeAudio(path, audio, get(special).audio_fade_duration ?? 1.5, true, Math.min(1, fadeToVolume * gainMultiplier))
        // if (faded) analyseAudio()
    }
}

function stopFade(fadeId: string, result = true) {
    if (currentlyFading[fadeId]) {
        clearInterval(currentlyFading[fadeId])
        delete currentlyFading[fadeId]
    }
    if (currentlyFadingTimeouts[fadeId]) {
        clearTimeout(currentlyFadingTimeouts[fadeId])
        delete currentlyFadingTimeouts[fadeId]
    }
    if (currentlyFadingResolvers[fadeId]) {
        const resolve = currentlyFadingResolvers[fadeId]
        delete currentlyFadingResolvers[fadeId]
        setTimeout(() => resolve(result), 50)
    }

    if (!Object.keys(currentlyFading).some((a) => a.startsWith("out_"))) {
        isFadingOut.set(false)
    }
}

function stopFading(result = true) {
    Object.keys(currentlyFading).forEach((id) => stopFade(id, result))
    Object.keys(currentlyFadingTimeouts).forEach((id) => {
        clearTimeout(currentlyFadingTimeouts[id])
        delete currentlyFadingTimeouts[id]
    })
    Object.keys(currentlyFadingResolvers).forEach((id) => {
        const resolve = currentlyFadingResolvers[id]
        delete currentlyFadingResolvers[id]
        resolve(result)
    })
    isFadingOut.set(false)
}
