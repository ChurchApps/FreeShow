// CROSSFADE

import { get } from "svelte/store"
import { customActionActivation } from "../components/actions/actions"
import { stopMetronome } from "../components/drawer/audio/metronome"
import { activePlaylist, audioPlaylists, isFadingOut, playingAudio, special } from "../stores"
import { AudioPlayer } from "./audioPlayer"
import { AudioPlaylist } from "./audioPlaylist"

type AudioClearOptions = {
    clearPlaylist?: boolean
    playlistCrossfade?: boolean
    commonClear?: boolean
    clearTime?: number // effects
    isPlayingNew?: boolean
}

export const clearing: string[] = []
let forceClear = false
export function clearAudio(audioPath = "", options: AudioClearOptions = {}) {
    // turn off any playlist
    if (options.clearPlaylist && (!audioPath || AudioPlaylist.getPlayingPath() === audioPath)) activePlaylist.set(null)

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
    const clearIds = audioPath ? [audioPath] : Object.keys(get(playingAudio))
    clearIds.forEach(clear)

    async function clear(path: string) {
        if (clearing.includes(path)) return

        clearing.push(path)
        const audio = AudioPlayer.getAudio(path)
        if (!audio) return deleteAudio(path)

        const faded = await fadeAudio(path, audio, clearTime)
        if (faded) removeAudio(path)
    }

    function removeAudio(path) {
        const audio = AudioPlayer.getAudio(path)
        if (!audio) return deleteAudio(path)

        audio.pause()
        customActionActivation("audio_end")
        deleteAudio(path)
    }

    function deleteAudio(path) {
        isFadingOut.set(false)
        AudioPlayer.stop(path)

        clearing.splice(clearing.indexOf(path), 1)
    }
}

const currentlyCrossfadingOut: string[] = []
export function fadeOutAudio(crossfade = 0) {
    Object.entries(get(playingAudio)).forEach(async ([path, { audio }]) => {
        const type = AudioPlayer.getAudioType(path, audio.duration)
        if (type === "effect" || currentlyCrossfadingOut.includes(path)) return
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
    if (!path || currentlyCrossfadingIn.includes(path) || currentlyCrossfadingOut.includes(path)) return

    currentlyCrossfadingIn.push(path)
    const waitTime = waitToPlay ? crossfade * 0.6 * 1000 : 0
    setTimeout(async () => {
        const playing = AudioPlayer.getPlaying(path)?.audio
        if (!playing) {
            currentlyCrossfadingIn.splice(currentlyCrossfadingIn.indexOf(path), 1)
            return
        }

        await fadeAudio(path, playing, waitToPlay ? crossfade * 0.4 : crossfade, true, fadeToVolume)
        currentlyCrossfadingIn.splice(currentlyCrossfadingIn.indexOf(path), 1)
    }, waitTime)
}

const speed = 0.01
const currentlyFading: { [key: string]: NodeJS.Timeout } = {}
async function fadeAudio(id: string, audio: HTMLAudioElement, duration = 1, increment = false, fadeToVolume = 1): Promise<boolean> {
    duration = Number(duration)
    const fadeId = (increment ? "in_" : "out_") + id
    if (!audio || !duration || currentlyFading[fadeId]) return true
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

    return new Promise(resolve => {
        currentlyFading[fadeId] = setInterval(() => {
            if (forceClear || (increment && currentlyCrossfadingOut.includes(id))) return finished()

            if (increment) {
                audio.volume = Math.min(fadeToVolume, Number((audio.volume + currentSpeed).toFixed(3)))
                if (audio.volume >= fadeToVolume) finished()
            } else {
                audio.volume = Math.max(0, Number((audio.volume - currentSpeed).toFixed(3)))
                if (audio.volume <= 0) finished()
            }
        }, time)

        const timedout = setTimeout(() => {
            clearInterval(currentlyFading[fadeId])
            delete currentlyFading[fadeId]
            resolve(true)
        }, duration * 1500)

        function finished() {
            clearInterval(currentlyFading[fadeId])
            delete currentlyFading[fadeId]
            clearTimeout(timedout)
            setTimeout(() => resolve(true), 50)

            if (!increment && !Object.keys(currentlyFading).filter(a => a.includes("out")).length) {
                isFadingOut.set(false)
            }
        }
    })
}

export function audioIsFading() {
    return !!Object.keys(currentlyFading).length
}

// fade out/in when video starts playing
export let isAllAudioFading = false
export function fadeoutAllPlayingAudio() {
    stopFading()
    isAllAudioFading = true

    Object.values(get(playingAudio)).forEach(({ audio }) => {
        fadeoutAudio(audio)
    })

    async function fadeoutAudio(audio) {
        const faded = await fadeAudio(audio.src, audio, get(special).audio_fade_duration ?? 1.5)
        if (faded) {
            audio.pause()
            // analyseAudio()
        }
    }
}
export function fadeinAllPlayingAudio() {
    if (!isAllAudioFading) return
    isFadingOut.set(false)
    stopFading()

    let fadeToVolume = 1
    if (get(activePlaylist)?.id) {
        const playlist = get(audioPlaylists)[get(activePlaylist).id]
        fadeToVolume = playlist?.volume ?? 1
    }

    Object.values(get(playingAudio)).forEach(({ audio }) => {
        fadeinAudio(audio)
    })

    isAllAudioFading = false

    async function fadeinAudio(audio) {
        audio.play()
        await fadeAudio(audio.src, audio, get(special).audio_fade_duration ?? 1.5, true, fadeToVolume)
        // if (faded) analyseAudio()
    }
}

function stopFading() {
    Object.keys(currentlyFading).forEach(id => {
        clearInterval(currentlyFading[id])
        delete currentlyFading[id]
    })
}
