// CROSSFADE

import { get } from "svelte/store"
import { uid } from "uid"
import { customActionActivation } from "../components/actions/actions"
import { stopMetronome } from "../components/drawer/audio/metronome"
import { activePlaylist, audioStreams, isFadingOut, playingAudio, special } from "../stores"
import { AudioPlayer } from "./audioPlayer"

let clearing: string[] = []
let forceClear: boolean = false
export function clearAudio(path: string = "", clearPlaylist: boolean = true, playlistCrossfade: boolean = false, commonClear: boolean = false) {
    // turn off any playlist
    if (clearPlaylist && (!path || get(activePlaylist)?.active === path)) activePlaylist.set(null)

    // stop playing metronome
    if (clearPlaylist && !path) stopMetronome()

    const clearTime = playlistCrossfade ? 0 : (get(special).audio_fade_duration ?? 1.5)

    if (clearing.includes(path)) {
        if (!commonClear) return
        // force stop audio files (bypass timeout if already active)
        forceClear = true
        setTimeout(() => (forceClear = false), 100)
        return
    }
    if (!Object.keys(get(playingAudio)).length) {
        isFadingOut.set(false)
        return
    }

    const clearIds = path ? [path] : Object.keys(get(playingAudio))
    clearIds.forEach(clearAudio)

    async function clearAudio(path: string) {
        clearing.push(path)
        const audio = AudioPlayer.getAudio(path)
        if (!audio) return deleteAudio(path)

        let faded = await fadeAudio(audio, clearTime)
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
        playingAudio.update((a) => {
            delete a[path]
            return a
        })

        // startUpdate()
        clearAudioStreams()
    }

    // let updating = false
    // function startUpdate() {
    //     if (updating) return
    //     updating = true

    //     setTimeout(() => {
    //         playingAudio.set(newPlaying)
    //         clearAudioStreams()
    //         clearing.splice(clearing.indexOf(path), 1)
    //     }, 200)
    // }
}

let currentlyCrossfading: string[] = []
export function fadeOutAudio(crossfade: number = 0) {
    Object.entries(get(playingAudio)).forEach(async ([path, { audio }]) => {
        if (currentlyCrossfading.includes(path)) return

        currentlyCrossfading.push(path)
        let faded = await fadeAudio(audio, crossfade)
        currentlyCrossfading.splice(currentlyCrossfading.indexOf(path), 1)
        if (!faded) return

        customActionActivation("audio_end")
        AudioPlayer.stop(path)
    })
}
// if no "path" is provided it will fade out/clear all audio
export function fadeInAudio(path: string, crossfade: number, waitToPlay: boolean = false) {
    if (!path || currentlyCrossfading[path]) return

    let playing = AudioPlayer.getPlaying(path)?.audio
    if (!playing) return

    currentlyCrossfading.push(path)
    let waitTime = waitToPlay ? crossfade * 0.6 * 1000 : 0
    setTimeout(async () => {
        await fadeAudio(playing, waitToPlay ? crossfade * 0.4 : crossfade, true)
        currentlyCrossfading.splice(currentlyCrossfading.indexOf(path), 1)
    }, waitTime)
}

const speed = 0.01
let currentlyFading: any = {}
async function fadeAudio(audio, duration = 1, increment: boolean = false): Promise<boolean> {
    duration = Number(duration)
    if (!audio || !duration) return true
    // no need to fade out if paused
    if (!increment && audio.paused) return true

    let currentSpeed = speed
    if (duration < 1) currentSpeed *= 10
    let time = duration * 1000 * currentSpeed

    // WIP non linear easing

    if (!increment) {
        isFadingOut.set(true)
    }

    let fadeId = (increment ? "in_" : "out_") + uid()
    return new Promise((resolve) => {
        currentlyFading[fadeId] = setInterval(() => {
            if (forceClear) return finished()

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

export function clearAudioStreams(id: string = "") {
    let ids = id ? [id] : Object.keys(audioStreams)

    ids.forEach((streamId) => {
        let stream = audioStreams[streamId]
        stream?.getAudioTracks().forEach((track: any) => track.stop())
    })
}
