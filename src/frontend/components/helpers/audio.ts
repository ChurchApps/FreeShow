import { get } from "svelte/store"
import { MAIN, OUTPUT } from "../../../types/Channels"
import { audioChannels, gain, playingAudio, playingVideos, volume } from "../../stores"
import { send } from "../../utils/request"
import { audioAnalyser } from "../output/audioAnalyser"
import { checkNextAfterMedia } from "./showActions"

export async function playAudio({ path, name = "", audio = null, stream = null }: any, pauseIfPlaying: boolean = true, startAt: number = 0) {
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

    audio = audio || new Audio(path)
    let analyser: any = await getAnalyser(audio, stream)

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

    if (analyser.gainNode) analyser.gainNode.gain.value = get(volume) * (get(gain) || 1)
    else audio.volume = get(volume)

    if (startAt > 0) audio.currentTime = startAt
    audio.play()

    analyseAudio()
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
let interval: any = null
export function analyseAudio() {
    if (interval) return

    let allAudio: any[] = []

    // let allAudio: any[] = Object.values(get(playingAudio)).filter((a) => a.paused === false && a.audio.volume)
    // if (get(volume) && get(playingVideos).length) get(playingVideos).map((a) => allAudio.push({ ...a }))

    let updateAudio: number = 10
    interval = setInterval(() => {
        // get new audio
        updateAudio++
        if (updateAudio >= 10) {
            updateAudio = 0
            allAudio = Object.entries(get(playingAudio))
                .map(([id, a]: any) => ({ id, ...a }))
                .filter((audio) => {
                    let audioPath = audio.id
                    if (!audio.audio) return false

                    // check if finished
                    if (!audio.paused && audio.audio.currentTime >= audio.audio.duration) {
                        if (get(playingAudio)[audioPath].loop) {
                            get(playingAudio)[audioPath].audio.currentTime = 0
                            get(playingAudio)[audioPath].audio.play()
                        } else {
                            playingAudio.update((a: any) => {
                                // a[audioPath].paused = true
                                delete a[audioPath]
                                return a
                            })

                            if (!Object.keys(get(playingAudio)).length) checkNextAfterMedia(audioPath, "audio")
                            return false
                        }
                    }

                    return audio.paused === false && audio.audio.volume
                })

            // remove cleared videos
            let videos: any[] = get(playingVideos).filter((a) => document.contains(a.video))

            if (videos.length) {
                videos.map((a) => {
                    if (!a.paused) allAudio.push({ ...a })
                })
            }
        }

        if (!allAudio.length) {
            audioChannels.set({ left: 0, right: 0 })
            clearInterval(interval)
            interval = null

            send(OUTPUT, ["AUDIO_MAIN"], { channels: { left: 0, right: 0 } })
            return
        }

        // merge audio
        let allLefts: number[] = []
        let allRights: number[] = []
        allAudio.forEach((a: any) => {
            let aa: any
            if (a.channels !== undefined) aa = a.channels
            else aa = { left: audioAnalyser(a.analyser.left), right: audioAnalyser(a.analyser.right) }
            if (aa.left > 0 || aa.right > 0) {
                allLefts.push(aa.left)
                allRights.push(aa.right)
            }
        })
        let merged = { left: 0, right: 0 }
        if (allLefts.length || allRights.length) merged = { left: getHighestNumber(allLefts), right: getHighestNumber(allRights) }
        audioChannels.set(merged)
    }, audioUpdateInterval)
}

// function getAverageNumber(numbers: number[]): number {
//   let total: number = numbers.reduce((count: number, num: number): number => count + num)
//   return total / numbers.length
// }

function getHighestNumber(numbers: number[]): number {
    return Math.max(...numbers)
}

let clearing = false
export function clearAudio(path: string = "") {
    // let clearTime = get(transitionData).audio.duration
    // TODO: starting audio before previous clear is finished will not start/clear audio
    const clearTime = 2

    if (clearing) return // setTimeout(() => clearAudio(path), clearTime * 1000 + 200)
    if (!Object.keys(get(playingAudio)).length) return
    clearing = true

    let newPlaying: any = get(playingAudio)
    playingAudio.update((a) => {
        if (path) clearAudio(path)
        else Object.keys(get(playingAudio)).forEach(clearAudio)

        return a

        function clearAudio(path) {
            if (!a[path].audio) {
                delete a[path]
                newPlaying = a
                return
            }

            // fade out
            fadeAudio(a[path].audio, clearTime)

            setTimeout(() => {
                a[path].audio.pause()
                delete a[path]
                newPlaying = a
            }, clearTime * 1000 * 1.3)
        }
    })

    setTimeout(() => {
        playingAudio.set(newPlaying)
        clearAudioStreams()
        clearing = false
    }, clearTime * 1000 * 1.5)
}

function fadeAudio(audio, duration = 1) {
    let speed = 0.01
    let time = (duration * 1000) / (audio.volume / speed)

    let fadeAudio = setInterval(() => {
        audio.volume = Math.max(0, Number((audio.volume - speed).toFixed(3)))

        if (audio.volume === 0) clearInterval(fadeAudio)
    }, time)
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

    // custom audio output
    // let audioDest = ac.createMediaStreamDestination()
    // source.connect(audioDest)
    // let newAudio: any = new Audio()
    // newAudio.srcObject = audioDest.stream
    // WIP this works in Chrome 110: (Electron needs to be updated!)
    // https://developer.chrome.com/blog/audiocontext-setsinkid/
    // if (get(special).audioOutput) {
    //     try {
    //         await (ac as any).setSinkId(get(special).audioOutput)
    //     } catch (err) {
    //         console.error(err)
    //     }
    // }

    return { left: leftAnalyser, right: rightAnalyser, gainNode }
}

export async function getAudioDuration(path: string): Promise<number> {
    return new Promise((resolve) => {
        let audio: any = new Audio(path)
        audio.addEventListener("canplaythrough", (_: any) => {
            resolve(audio.duration)
        })
    })
}
