import { get } from "svelte/store"
import { uid } from "uid"
import { MAIN, OUTPUT } from "../../../types/Channels"
import { activePlaylist, audioChannels, audioPlaylists, gain, media, outLocked, playingAudio, playingVideos, special } from "../../stores"
import { send } from "../../utils/request"
import { customActionActivation } from "../actions/actions"
import { stopMetronome } from "../drawer/audio/metronome"
import { audioAnalyser } from "../output/audioAnalyser"
import { volume } from "./../../stores"
import { clone, shuffleArray } from "./array"
import { encodeFilePath } from "./media"
import { checkNextAfterMedia } from "./showActions"

// WIP use get(special).audio_fade_duration ?? 1.5 to fade in when starting song ?? (currently just when fading out)

export async function playAudio({ path, name = "", audio = null, stream = null }: any, pauseIfPlaying: boolean = true, startAt: number = 0, playMultiple: boolean = false, crossfade: number = 0) {
    let existing: any = get(playingAudio)[path]
    if (existing) {
        if (!pauseIfPlaying) {
            get(playingAudio)[path].audio.currentTime = 0
            return
        }

        playingAudio.update((a) => {
            let isPaused: boolean = a[path].paused
            a[path].paused = !isPaused
            if (isPaused) {
                a[path].audio.play()
                analyseAudio()
            } else a[path].audio.pause()
            return a
        })

        return
    }

    let audioPlaying = Object.keys(get(playingAudio)).length
    if (crossfade) crossfadeAudio(crossfade)
    else if (!playMultiple) clearAudio("", false)

    let encodedPath = encodeFilePath(path)
    audio = audio || new Audio(encodedPath)

    // LISTENERS

    audio.addEventListener("error", (err) => {
        console.error("Could not get audio:", err)

        playingAudio.update((a) => {
            delete a[path]
            return a
        })
    })

    let readyToPlay: boolean = false
    audio.addEventListener("canplay", () => {
        readyToPlay = true
        if (get(playingAudio)[path]?.audio) initAudio()
    })

    /////

    let analyser: any = await getAnalyser(audio, stream)

    // another audio might have been started while awaiting (if played rapidly)
    if (get(playingAudio)[path]) return

    playingAudio.update((a) => {
        if (!analyser) return a

        a[path] = {
            name: name.indexOf(".") > -1 ? name.slice(0, name.lastIndexOf(".")) : name,
            paused: false,
            mic: !!stream,
            analyser,
            audio,
        }

        return a
    })

    let localVolume: number = get(volume) * (get(media)[path]?.volume || 1)
    if (analyser.gainNode) analyser.gainNode.gain.value = localVolume * (get(gain) || 1)
    else audio.volume = localVolume

    let waitToPlay = 0
    if (audioPlaying && crossfade) {
        audio.volume = 0
        waitToPlay = crossfade * 0.6
        crossfadeAudio(crossfade, path, !!waitToPlay)
    }

    if (startAt > 0) audio.currentTime = startAt

    if (readyToPlay) initAudio()
    function initAudio() {
        setTimeout(() => {
            // audio might have been cleared
            if (!get(playingAudio)[path]?.audio) return

            get(playingAudio)[path].audio.play()
            customActionActivation("audio_start")
            analyseAudio()
        }, waitToPlay * 1000)
    }
}

let currentlyCrossfading: string[] = []
// if no "path" is provided it will fade out/clear all audio
async function crossfadeAudio(crossfade: number = 0, path: string = "", waitToPlay: boolean = false) {
    if (currentlyCrossfading[path]) return
    if (path) currentlyCrossfading.push(path)

    // fade in
    if (path) {
        let playing = get(playingAudio)[path]?.audio
        if (!playing) return

        setTimeout(() => fadeAudio(playing, waitToPlay ? crossfade * 0.4 : crossfade, true), waitToPlay ? crossfade * 0.6 * 1000 : 0)
        currentlyCrossfading.splice(currentlyCrossfading.indexOf(path), 1)
        return
    }

    // fade out
    Object.entries(get(playingAudio)).forEach(([path, { audio }]) => {
        fadeoutAudio(audio, path)
    })

    async function fadeoutAudio(audio, path) {
        let faded = await fadeAudio(audio, crossfade)
        if (faded) deleteAudio(path)
    }

    function deleteAudio(path) {
        playingAudio.update((a) => {
            a[path]?.audio?.pause()
            customActionActivation("audio_end")
            delete a[path]

            return a
        })

        currentlyCrossfading.splice(currentlyCrossfading.indexOf(path), 1)
    }
}

let unmutedValue = 1
export function updateVolume(value: number | undefined | "local", changeGain: boolean = false) {
    if (value !== "local") {
        // api mute(unmute)
        if (value === undefined) {
            value = get(volume) ? 0 : unmutedValue
            if (!value) unmutedValue = get(volume)
        }

        if (changeGain) gain.set(Number(Number(value).toFixed(2)))
        else volume.set(Number(Number(value).toFixed(2)))
    }

    // update volume on playing audio
    playingAudio.update((a) => {
        Object.keys(a).forEach((id) => {
            let localVolume: number = get(volume) * (get(media)[id]?.volume || 1)

            if (a[id].analyser.gainNode) {
                let gainedValue = localVolume * (get(gain) || 1)
                a[id].analyser.gainNode.gain.value = gainedValue
            } else a[id].audio.volume = localVolume
        })

        return a
    })

    if (get(volume)) analyseAudio()
}

// PLAYLIST

export function startPlaylist(id, specificSong: string = "", pauseIfPlaying: boolean = false) {
    if (!id) return

    // pause if already playing
    if (pauseIfPlaying && specificSong && get(activePlaylist)?.id === id && get(playingAudio)[specificSong]) {
        playAudio({ path: specificSong }, true)
        return
    }

    activePlaylist.set({ id })

    let playlist = get(audioPlaylists)[id] || {}
    let crossfade = Number(playlist.crossfade) || 0

    // if (crossfade) isCrossfading = true
    playlistNext("", specificSong, crossfade)
}

export function stopPlaylist() {
    let activeAudio = get(activePlaylist).active
    clearAudio(activeAudio)
}

export function updatePlaylist(id: string, key: string, value: any) {
    if (!get(audioPlaylists)[id]) return

    audioPlaylists.update((a) => {
        a[id][key] = value
        return a
    })
}

export function audioPlaylistNext() {
    if (get(outLocked) || !get(activePlaylist)?.id) return

    let playlistId = get(activePlaylist).id || ""
    let playlist = get(audioPlaylists)[playlistId] || {}
    let crossfade = Number(playlist.crossfade) || 0

    let activePath = get(activePlaylist).active
    playlistNext(activePath, "", crossfade, playlist.loop !== false)
}

export function playlistNext(previous: string = "", specificSong: string = "", crossfade: number = 0, loop: boolean = true) {
    let id = get(activePlaylist)?.id

    if (!id) return

    let songs = getSongs()
    if (!songs.length) return

    let currentSongIndex = songs.findIndex((a) => a === (specificSong || previous))
    let nextSong = songs[currentSongIndex + (specificSong ? 0 : 1)]

    if (!nextSong && loop) nextSong = songs[0]
    if (!nextSong) {
        if (!loop && !Object.keys(currentlyFading).length) {
            if (crossfade) crossfadeAudio(crossfade)
            else clearAudio("", false, true)

            setTimeout(() => {
                if (!get(playingAudio)[previous]) customActionActivation("audio_playlist_ended")
            }, 100)
        }
        return
    }

    // prevent playing the same song twice (while it's fading) to stop duplicate audio
    if (Object.keys(playingAudio).includes(nextSong)) return

    activePlaylist.update((a) => {
        a.active = nextSong
        return a
    })

    // if (crossfade) isCrossfading = true
    playAudio({ path: nextSong }, false, 0, false, crossfade)

    function getSongs(): string[] {
        if (previous && get(activePlaylist)?.songs) return get(activePlaylist).songs

        // generate list
        let playlist = clone(get(audioPlaylists)[id])
        if (!playlist) return []
        let songs = playlist.songs

        let mode = playlist.mode
        if (mode === "shuffle") songs = shuffleArray(songs)

        activePlaylist.update((a) => {
            a.songs = songs
            return a
        })

        return songs
    }
}

let audioStreams: any = {}
export function startMicrophone(mic) {
    navigator.mediaDevices
        .getUserMedia({
            audio: {
                deviceId: { exact: mic.id },
            },
        })
        .then((stream: any) => {
            audioStreams[mic.id] = stream

            let audio = new Audio()
            audio.srcObject = stream
            audio.volume = 0

            playAudio({ path: mic.id, name: mic.name, audio, stream }, false)
        })
        .catch((err) => {
            console.log(err)
            if (err.name === "NotReadableError") {
                window.api.send(MAIN, { channel: "ACCESS_MICROPHONE_PERMISSION" })
            }
        })
}

export function clearAudioStreams(id: string = "") {
    let ids = id ? [id] : Object.keys(audioStreams)

    ids.forEach((streamId) => {
        let stream = audioStreams[streamId]
        stream?.getAudioTracks().forEach((track: any) => track.stop())
    })
}

// const audioUpdateInterval: number = 100 // ms
const audioUpdateInterval: number = 50 // ms
let analyseTimeout: any = null
let isCrossfading: boolean = false
export function analyseAudio() {
    if (analyseTimeout) return

    let allAudio: any[] = []

    // let allAudio: any[] = Object.values(get(playingAudio)).filter((a) => a.paused === false && a.audio.volume)
    // if (get(volume) && get(playingVideos).length) get(playingVideos).map((a) => allAudio.push({ ...a }))

    let updateAudio: number = 10
    let previousUpdate = 0
    timeoutRun()
    function timeoutRun() {
        analyseTimeout = setTimeout(() => {
            let timeSinceLast = Date.now() - previousUpdate
            if (timeSinceLast > 100 && timeSinceLast < 200) {
                // skip if overloaded
                analyseTimeout = setTimeout(timeoutRun, audioUpdateInterval)
                return
            }

            // get new audio

            let playlistPath: string = get(activePlaylist)?.active || ""
            if (!isfading && playlistPath && !get(media)[playlistPath]?.loop) {
                if (isCrossfading) {
                    // analyseTimeout = setTimeout(timeoutRun, audioUpdateInterval)
                    return
                }

                let crossfadeDuration = checkCrossfade()
                if (crossfadeDuration) {
                    isCrossfading = true
                    setTimeout(() => {
                        isCrossfading = false
                        timeoutRun()
                    }, crossfadeDuration)
                    return
                }
            } else {
                isCrossfading = false
            }

            updateAudio++
            if (updateAudio >= 10) {
                updateAudio = 0
                allAudio = getPlayingAudio()
                allAudio.push(...getPlayingVideos()) // only used in output window I guess
            }

            allAudio = getPlayingOutputVideos(allAudio) // only used in main window

            if (!allAudio.length) {
                audioChannels.set({})
                clearTimeout(analyseTimeout)
                analyseTimeout = null

                send(OUTPUT, ["AUDIO_MAIN"], { channels: {} })
                return
            }

            mergeAudio(allAudio)
            timeoutRun()
        }, audioUpdateInterval)
    }
}

let previousMerge = 0
function mergeAudio(allAudio) {
    let timeSinceLast = Date.now() - previousMerge
    if (timeSinceLast > 100 && timeSinceLast < 200) return // skip if overloaded

    let allLefts: number[] = []
    let allRights: number[] = []
    let allLeftsDB: number[] = []
    let allRightsDB: number[] = []
    let min: number = -100
    let max: number = -30 // -10

    allAudio.forEach((a: any) => {
        let channels: any

        if (a.channels?.volume?.left !== undefined) {
            channels = { left: { volume: a.channels.volume.left, dB: { ...a.channels.dB, value: a.channels.dB.value.left } }, right: { volume: a.channels.volume.right, dB: { ...a.channels.dB, value: a.channels.dB.value.right } } }
        } else if (a.analyser) {
            channels = { left: audioAnalyser(a.analyser.left), right: audioAnalyser(a.analyser.right) }
        } else return

        if (channels.left.volume > 0 || channels.right.volume > 0) {
            allLefts.push(channels.left.volume)
            allRights.push(channels.right.volume)
        }

        if (typeof channels.left.dB?.value === "number" && typeof channels.right.dB?.value === "number") {
            allLeftsDB.push(channels.left.dB.value)
            allRightsDB.push(channels.right.dB.value)

            if (channels.left.dB.min < min) min = channels.left.dB.min
            if (channels.left.dB.max > max) max = channels.left.dB.max
        }
    })

    let merged = { left: 0, right: 0 }
    if (allLefts.length || allRights.length) merged = { left: getHighestNumber(allLefts), right: getHighestNumber(allRights) }

    let mergedDB = { left: min, right: min }
    if (allLeftsDB.length || allRightsDB.length) mergedDB = { left: mergeDB(allLeftsDB), right: mergeDB(allRightsDB) }

    audioChannels.set({ volume: merged, dB: { value: mergedDB, min, max } })
    previousMerge = Date.now()
}

function mergeDB(array: number[]) {
    // https://stackoverflow.com/a/22613964
    let sum = array.reduce((value, number) => (value += Math.pow(10, number / 20)), 0)

    if (!get(special).preFaderVolumeMeter) {
        // add gain & volume
        sum *= get(volume) * get(gain)
    }

    return (Math.log(sum) / Math.LN10) * 20
}

const extraMargin = 0.1 // s
function checkCrossfade(): number {
    let playlistId = get(activePlaylist)?.id || ""
    let playlist = get(audioPlaylists)[playlistId] || {}
    let crossfade = Number(playlist.crossfade) || 0
    let activePath = get(activePlaylist)?.active || ""
    if (!crossfade || !activePath) return 0

    let playing = get(playingAudio)[activePath]?.audio
    if (!playing) return 0

    let customCrossfade = crossfade > 3 ? crossfade * 0.6 : crossfade
    let reachedEnding = playing.currentTime + customCrossfade + extraMargin >= playing.duration
    if (!reachedEnding) return 0

    playlistNext(activePath, "", customCrossfade, playlist.loop !== false)
    return crossfade
}

function getPlayingAudio() {
    return Object.entries(get(playingAudio))
        .map(([id, a]: any) => ({ id, ...a }))
        .filter((audio) => {
            let audioPath = audio.id
            if (!audio.audio) return false

            // check if finished
            if (!audio.paused && audio.audio.currentTime >= audio.audio.duration) {
                if (get(media)[audioPath]?.loop) {
                    get(playingAudio)[audioPath].audio.currentTime = 0
                    get(playingAudio)[audioPath].audio.play()
                } else if (get(activePlaylist)?.active === audioPath) {
                    let playlist = get(audioPlaylists)[audioPath] || {}

                    playingAudio.update((a: any) => {
                        a[audioPath]?.audio?.pause()
                        delete a[audioPath]
                        return a
                    })

                    playlistNext(audioPath, "", 0, playlist.loop !== false)
                    return false
                } else {
                    playingAudio.update((a: any) => {
                        if (get(special).clearMediaOnFinish === false) {
                            // a[audioPath].audio?.pause()
                            a[audioPath].paused = true
                        } else {
                            a[audioPath]?.audio?.pause()
                            delete a[audioPath]
                        }

                        return a
                    })

                    let stillPlaying = Object.values(get(playingAudio)).filter((a) => !a.audio?.paused)
                    if (!stillPlaying.length) checkNextAfterMedia(audioPath, "audio")
                    return false
                }
            }

            return audio.paused === false && audio.audio.volume
        })
}

function getPlayingVideos() {
    // remove cleared videos
    let videos: any[] = get(playingVideos).filter((a) => document.contains(a.video))
    if (!videos.length) return []

    let allAudio: any[] = []

    videos.map((a) => {
        // set volume (video in output window)
        let newVolume = get(volume)
        if (a.analyser.gainNode) {
            let gainedValue = newVolume * (get(gain) || 1)
            a.analyser.gainNode.gain.value = gainedValue
        } else a.video.volume = newVolume

        // don't think a.paused it used
        if (a.paused || a.video.muted) allAudio.push({})
        else allAudio.push(a)
    })

    return allAudio
}

function getPlayingOutputVideos(allAudio) {
    let outputVideos: any[] = get(playingVideos).filter((a) => a.location === "output")
    if (!outputVideos.length) return allAudio

    outputVideos.map((v) => {
        let existing = allAudio.findIndex((a) => a.id === v.id && a.location === "output")
        if (existing > -1) {
            if (v.paused || v.muted) {
                allAudio.splice(existing, 1)
                return
            }

            allAudio[existing].channels = v.channels
            // allAudio[existing].channels = { left: audioAnalyser(v.analyser.left), right: audioAnalyser(v.analyser.right) }
            return
        }

        // v.paused & v.muted probably not in use
        if (v.paused || v.muted) return

        // console.log(v.channels, v.analyser)
        // let channels = { left: audioAnalyser(v.analyser.left), right: audioAnalyser(v.analyser.right) }
        // v.channels = channels

        // fix dB volume not minimum when muted
        if (v.channels?.volume?.left === 0 && v.channels?.volume?.right === 0 && v.channels?.dB?.value) {
            v.channels.dB.value = { left: -100, right: -100 }
        }

        allAudio.push(v)
    })

    return allAudio
}

// function getAverageNumber(numbers: number[]): number {
//   let total: number = numbers.reduce((count: number, num: number): number => count + num)
//   return total / numbers.length
// }

function getHighestNumber(numbers: number[]): number {
    return Math.max(...numbers)
}

let clearing = false
let forceClear: boolean = false
export function clearAudio(path: string = "", clearPlaylist: boolean = true, playlistCrossfade: boolean = false) {
    // turn off any playlist
    if (clearPlaylist && (!path || get(activePlaylist)?.active === path)) activePlaylist.set(null)

    // stop playing metronome
    if (clearPlaylist && !path) stopMetronome()

    const clearTime = playlistCrossfade ? 0 : (get(special).audio_fade_duration ?? 1.5)

    if (clearing) {
        // force stop audio files (bypass timeout if already active)
        forceClear = true
        setTimeout(() => (forceClear = false), 100)
        return
    }
    if (!Object.keys(get(playingAudio)).length) return
    clearing = true

    let newPlaying: any = get(playingAudio)
    playingAudio.update((a) => {
        if (path) clearAudio(path)
        else Object.keys(get(playingAudio)).forEach(clearAudio)

        return a

        async function clearAudio(path) {
            if (!a[path]?.audio) return deleteAudio(path)

            let faded = await fadeAudio(a[path].audio, clearTime)
            if (faded) removeAudio(path)
        }

        function removeAudio(path) {
            if (!a[path]?.audio) return deleteAudio(path)

            a[path].audio.pause()
            customActionActivation("audio_end")
            deleteAudio(path)
        }

        function deleteAudio(path) {
            delete a[path]
            newPlaying = a

            startUpdate()
        }
    })

    let updating = false
    function startUpdate() {
        if (updating) return
        updating = true

        setTimeout(() => {
            playingAudio.set(newPlaying)
            clearAudioStreams()
            clearing = false
        }, 200)
    }
}

// fade out/in when video starts playing
let isfading = false
export function fadeoutAllPlayingAudio() {
    stopFading()
    isfading = true

    Object.values(get(playingAudio)).forEach(({ audio }) => {
        fadeoutAudio(audio)
    })

    async function fadeoutAudio(audio) {
        let faded = await fadeAudio(audio, get(special).audio_fade_duration ?? 1.5)
        if (faded) {
            audio.pause()
            // analyseAudio()
        }
    }
}
export function fadeinAllPlayingAudio() {
    if (!isfading) return
    stopFading()

    Object.values(get(playingAudio)).forEach(({ audio }) => {
        fadeinAudio(audio)
    })

    isfading = false

    async function fadeinAudio(audio) {
        audio.play()
        await fadeAudio(audio, get(special).audio_fade_duration ?? 1.5, true)
        // if (faded) analyseAudio()
    }
}

function stopFading() {
    Object.values(currentlyFading).forEach((fadeInterval: any) => {
        clearInterval(fadeInterval)
        delete currentlyFading[fadeInterval]
    })
}

const speed = 0.01
let currentlyFading: any = {}
async function fadeAudio(audio, duration = 1, increment: boolean = false): Promise<boolean> {
    duration = Number(duration)
    if (!audio || !duration) return true

    let currentSpeed = speed
    if (duration < 1) currentSpeed *= 10
    let time = duration * 1000 * currentSpeed

    // WIP non linear easing

    let fadeId = uid()
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
        }
    })
}

// https://stackoverflow.com/questions/20769261/how-to-get-video-elements-current-level-of-loudness
export async function getAnalyser(elem: any, stream: any = null) {
    let ac = new AudioContext()
    let source

    try {
        if (stream) source = ac.createMediaStreamSource(stream)
        else source = ac.createMediaElementSource(elem)
    } catch (err) {
        console.error(err)

        return
    }

    // if (stream) {
    //     let audioDestination = ac.createMediaStreamDestination()

    //     let analyser = ac.createAnalyser()
    //     analyser.smoothingTimeConstant = 0.9
    //     analyser.fftSize = 256

    //     let gainNode = ac.createGain()
    //     source.connect(gainNode)

    //     gainNode.connect(analyser)
    //     gainNode.connect(audioDestination)

    //     return { left: analyser, right: analyser, gainNode }
    // }

    // let analyser = ac.createAnalyser()
    // analyser.smoothingTimeConstant = 0.9
    // // analyser.fftSize = 512 // the total samples are half the fft size
    // analyser.fftSize = 256 // the total samples are half the fft size

    // source.connect(analyser)
    // analyser.connect(ac.destination)

    // split channels
    // https://stackoverflow.com/questions/48930799/connecting-nodes-with-each-other-with-the-web-audio-api
    let splitter = ac.createChannelSplitter(2)
    let merger = ac.createChannelMerger(2)
    source.connect(splitter)

    let leftAnalyser = ac.createAnalyser()
    let rightAnalyser = ac.createAnalyser()
    leftAnalyser.smoothingTimeConstant = 0.9
    rightAnalyser.smoothingTimeConstant = 0.9
    leftAnalyser.fftSize = 256
    rightAnalyser.fftSize = 256
    splitter.connect(leftAnalyser, 0) // left analyzer
    splitter.connect(rightAnalyser, 1) // right analyzer

    splitter.connect(merger, 0, 0) // left audio
    splitter.connect(merger, 1, 1) // right audio

    // gain (volume)
    // https://stackoverflow.com/questions/43698961/how-to-set-volumes-in-webrtc
    let gainNode = ac.createGain()
    source.connect(gainNode)
    gainNode.connect(ac.destination)

    console.log("ANALYZING AUDIO", elem)

    // custom audio output (supported in Chrome 110+)
    // https://developer.chrome.com/blog/audiocontext-setsinkid/
    // this applies to both audio & video
    if (get(special).audioOutput) {
        let audioDest = ac.createMediaStreamDestination()
        source.connect(audioDest)
        let newAudio: any = new Audio()
        newAudio.srcObject = audioDest.stream

        try {
            await (ac as any).setSinkId(get(special).audioOutput)
        } catch (err) {
            console.error(err)
        }
    }

    return { left: leftAnalyser, right: rightAnalyser, gainNode }
}

export async function getAudioDuration(path: string): Promise<number> {
    return new Promise((resolve) => {
        let audio: any = new Audio(encodeFilePath(path))
        audio.addEventListener("canplaythrough", (_: any) => {
            // audio streams does not end
            if (audio.duration === Infinity) resolve(0)
            else resolve(audio.duration || 0)
        })
    })
}

// export function decodeURI(path: string) {
//     const cleanedURI = cleanURI(path)

//     try {
//         return decodeURIComponent(cleanedURI)
//     } catch (e) {
//         console.error("URI malformed: ", path)
//         // newToast("$error.uri")
//         return path
//     }
// }
// function cleanURI(uri) {
//     // only keep valid URI characters (and spaces)
//     const invalidChars = /[^ A-Za-z0-9\-_.!~*'()%;:@&=+$,/?#[\]]/g
//     return uri.replace(invalidChars, "")
// }
