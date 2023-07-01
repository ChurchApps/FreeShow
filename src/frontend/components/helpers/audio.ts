import { get } from "svelte/store"
import { audioChannels, playingAudio, playingVideos, volume } from "../../stores"
import { audioAnalyser } from "../output/audioAnalyser"
import { OUTPUT } from "../../../types/Channels"
import { send } from "../../utils/request"

export async function playAudio({ path, name = "" }: any, pauseIfPlaying: boolean = true, startAt: number = 0) {
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

    let audio = new Audio(path)
    let analyser: any = await getAnalyser(audio)
    playingAudio.update((a) => {
        if (!analyser) return a
        a[path] = {
            name: name.indexOf(".") > -1 ? name.slice(0, name.lastIndexOf(".")) : name,
            paused: false,
            analyser,
            audio,
        }
        return a
    })

    audio.volume = get(volume)
    if (startAt > 0) audio.currentTime = startAt
    audio.play()
    analyseAudio()
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
                    // check if finished
                    if (!audio.paused && audio.audio.currentTime >= audio.audio.duration) {
                        playingAudio.update((a: any) => {
                            // a[audio.id].paused = true
                            // TODO: check audio nextAfterMedia
                            delete a[audio.id]
                            return a
                        })
                        return false
                    }

                    return audio.paused === false && audio.audio.volume
                })

            // remove cleared videos
            let videos: any[] = get(playingVideos).filter((a) => document.contains(a.video))

            if (get(volume) && videos.length) {
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

export function clearAudio(path: string = "") {
    playingAudio.update((a) => {
        if (path) {
            a[path].audio.pause()
            delete a[path]
        } else {
            Object.keys(get(playingAudio)).forEach((currentPath: any) => {
                a[currentPath].audio.pause()
                delete a[currentPath]
            })
        }

        return a
    })
}

// https://stackoverflow.com/questions/20769261/how-to-get-video-elements-current-level-of-loudness
export async function getAnalyser(elem: any) {
    let ac = new AudioContext()
    let source

    try {
        source = ac.createMediaElementSource(elem)
    } catch (err) {
        console.error(err)

        return
    }

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
    // merger.connect(gain);
    merger.connect(ac.destination)

    console.log("ANALYZING VIDEO", elem)

    return { left: leftAnalyser, right: rightAnalyser }
}

export async function getAudioDuration(path: string) {
    return new Promise((resolve) => {
        let audio: any = new Audio(path)
        audio.addEventListener("canplaythrough", (_: any) => {
            resolve(audio.duration)
        })
    })
}
