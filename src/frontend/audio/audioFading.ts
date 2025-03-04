// CROSSFADE

import { get } from "svelte/store"
import { customActionActivation } from "../components/actions/actions"
import { stopMetronome } from "../components/drawer/audio/metronome"
import { activePlaylist, isFadingOut, playingAudio, special } from "../stores"
import { AudioPlayer } from "./audioPlayer"
import { AudioPlaylist } from "./audioPlaylist"

type AudioClearOptions = {
    clearPlaylist?: boolean
    playlistCrossfade?: boolean
    commonClear?: boolean
}

export let clearing: string[] = []
let forceClear: boolean = false
export function clearAudio(path: string = "", options: AudioClearOptions = {}) {
    // turn off any playlist
    if (options.clearPlaylist && (!path || AudioPlaylist.getPlayingPath() === path)) activePlaylist.set(null)

    // stop playing metronome
    if (options.clearPlaylist && !path) stopMetronome()

    if (clearing.includes(path)) {
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

    const clearTime = options.playlistCrossfade ? 0 : (get(special).audio_fade_duration ?? 1.5)
    const clearIds = path ? [path] : Object.keys(get(playingAudio))
    clearIds.forEach(clear)

    async function clear(path: string) {
        if (clearing.includes(path)) return

        clearing.push(path)
        const audio = AudioPlayer.getAudio(path)
        if (!audio) return deleteAudio(path)

        let faded = await fadeAudio(path, audio, clearTime)
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

let currentlyCrossfadingOut: string[] = []
export function fadeOutAudio(crossfade: number = 0) {
    Object.entries(get(playingAudio)).forEach(async ([path, { audio }]) => {
        if (currentlyCrossfadingOut.includes(path)) return
        currentlyCrossfadingOut.push(path)

        let faded = await fadeAudio(path, audio, crossfade)

        currentlyCrossfadingOut.splice(currentlyCrossfadingOut.indexOf(path), 1)
        if (!faded) return

        customActionActivation("audio_end")
        AudioPlayer.stop(path)
    })
}
// if no "path" is provided it will fade out/clear all audio
let currentlyCrossfadingIn: string[] = []
export function fadeInAudio(path: string, crossfade: number, waitToPlay: boolean = false) {
    if (!path || currentlyCrossfadingIn.includes(path) || currentlyCrossfadingOut.includes(path)) return

    currentlyCrossfadingIn.push(path)
    let waitTime = waitToPlay ? crossfade * 0.6 * 1000 : 0
    setTimeout(async () => {
        let playing = AudioPlayer.getPlaying(path)?.audio
        if (!playing) {
            currentlyCrossfadingIn.splice(currentlyCrossfadingIn.indexOf(path), 1)
            return
        }

        await fadeAudio(path, playing, waitToPlay ? crossfade * 0.4 : crossfade, true)
        currentlyCrossfadingIn.splice(currentlyCrossfadingIn.indexOf(path), 1)
    }, waitTime)
}

const speed = 0.01
let currentlyFading: any = {}
async function fadeAudio(id: string, audio: HTMLAudioElement, duration = 1, increment: boolean = false): Promise<boolean> {
    duration = Number(duration)
    let fadeId = (increment ? "in_" : "out_") + id
    if (!audio || !duration || currentlyFading[fadeId]) return true
    // no need to fade out if paused
    if (!increment && audio.paused) return true

    let currentSpeed = speed
    if (duration < 1) currentSpeed *= 10
    let time = duration * 1000 * currentSpeed

    // WIP non linear easing

    if (!increment) {
        isFadingOut.set(true)
    }

    return new Promise((resolve) => {
        currentlyFading[fadeId] = setInterval(() => {
            if (forceClear || (increment && currentlyCrossfadingOut.includes(id))) return finished()

            if (increment) {
                audio.volume = Math.min(1, Number((audio.volume + currentSpeed).toFixed(3)))
                if (audio.volume === 1) finished()
            } else {
                audio.volume = Math.max(0, Number((audio.volume - currentSpeed).toFixed(3)))
                if (audio.volume === 0) finished()
            }
        }, time)

        let timedout = setTimeout(() => {
            clearInterval(currentlyFading[fadeId])
            delete currentlyFading[fadeId]
            resolve(true)
        }, duration * 1500)

        function finished() {
            clearInterval(currentlyFading[fadeId])
            delete currentlyFading[fadeId]
            clearTimeout(timedout)
            setTimeout(() => resolve(true), 50)

            if (!increment && !Object.keys(currentlyFading).filter((a) => a.includes("out")).length) {
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
        let faded = await fadeAudio(audio.src, audio, get(special).audio_fade_duration ?? 1.5)
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

    Object.values(get(playingAudio)).forEach(({ audio }) => {
        fadeinAudio(audio)
    })

    isAllAudioFading = false

    async function fadeinAudio(audio) {
        audio.play()
        await fadeAudio(audio.src, audio, get(special).audio_fade_duration ?? 1.5, true)
        // if (faded) analyseAudio()
    }
}

function stopFading() {
    Object.values(currentlyFading).forEach((fadeInterval: any) => {
        clearInterval(fadeInterval)
        delete currentlyFading[fadeInterval]
    })
}
