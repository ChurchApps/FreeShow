import { get } from "svelte/store"
import type { AutoLyrics } from "../../../../types/Show"
import { activeAutoLyrics, autoLyricsRecording, outLocked, outputs } from "../../../stores"
import { getSlideText } from "../../edit/scripts/textStyle"
import { getActiveOutputs } from "../../helpers/output"
import { getLayoutRef } from "../../helpers/show"
import { _show } from "../../helpers/shows"

const silenceThreshold = 0.01 // RMS below this = silence
// const averagingWindowSeconds = 2
// const sampleRate = 60 // samples per second (using requestAnimationFrame is ~60fps)
// const bufferSize = averagingWindowSeconds * sampleRate

export function autoLyricsRecorder(showId: string) {
    autoLyricsRecording.set([])

    let layoutRef = getLayoutRef(showId)
    let firstOutputId = getActiveOutputs()[0]
    let lyricsPart = ""

    let outputListenerUnsubscribe = outputs.subscribe((a) => {
        let outSlide = a[firstOutputId]?.out?.slide
        if (outSlide?.index === undefined) return
        // clear output to stop recording
        // if (started && currentSequence.length && !outSlide) return stopRecording()
        // if (!outSlide || outSlide.layout !== activeLayout || outSlide.index === undefined) return

        let layoutSlide = layoutRef[outSlide.index]
        // let slideRef = { id: layoutSlide?.id, index: outSlide.index }
        // if (JSON.stringify(currentSequence[currentSequence.length - 1]?.slideRef || {}) === JSON.stringify(slideRef)) return

        let slide = _show(showId).get("slides")[layoutSlide?.id]
        // lyricsPart = slide.group // GET GROUP WITH CORRECT NUMBER...
        // const lyricsParts = ["Verse 1", "Chorus", "Verse 2", "Outro"]; // example
        lyricsPart = getSlideText(slide)
    })

    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser()
    let dataArray = new Float32Array(0)

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        const microphone = audioContext.createMediaStreamSource(stream)
        analyser.fftSize = 2048

        microphone.connect(analyser)

        dataArray = new Float32Array(analyser.fftSize)

        console.log("Recording started.")
        requestAnimationFrame(captureAudioFeatures)
    })

    return outputListenerUnsubscribe

    function captureAudioFeatures() {
        analyser.getFloatTimeDomainData(dataArray)

        const rms = Math.sqrt(dataArray.reduce((sum, val) => sum + val * val, 0) / dataArray.length)

        // skip if silent
        if (rms < silenceThreshold) {
            requestAnimationFrame(captureAudioFeatures)
            return
        }

        const frequencies = new Float32Array(analyser.frequencyBinCount)
        analyser.getFloatFrequencyData(frequencies)

        const avgFreq = frequencies.reduce((sum, val) => sum + val, 0) / frequencies.length

        let section: AutoLyrics = {
            part: lyricsPart,
            avgRms: rms,
            avgFreq,
            timestamp: Date.now(),
        }
        autoLyricsRecording.update((a) => {
            if (a === null) return [section]
            a.push(section)
            return a
        })

        // addToBuffer(rms, avgFreq)

        // // when buffer is filled up, average and store
        // if (rmsBuffer.length >= bufferSize) {
        //     const features = getAveragedFeatures()
        //     if (features && features.avgRms >= silenceThreshold) {
        //         let section: AutoLyrics = {
        //             part: lyricsPart,
        //             avgRms: features.avgRms,
        //             avgFreq: features.avgFreq,
        //             timestamp: Date.now(),
        //         }
        //         autoLyricsRecording.update((a) => {
        //             a.push(section)
        //             return a
        //         })
        //     }
        //     clearBuffers()
        // }

        if (get(autoLyricsRecording) === null) return
        requestAnimationFrame(captureAudioFeatures)
    }
}

// MATCHING

const recentMatches: { part: string; timestamp: number }[] = []
const matchWindowDuration = 3000 // 3 seconds
let lastDisplayedPart: string = ""

let animationFrame: number = 0
export function autoLyricsStartMatching(autoLyricsData: AutoLyrics[], { showId, layoutId }: { showId: string; layoutId: string }) {
    if (get(outLocked)) return
    // if (get(activeAutoLyrics)) clearTimeout(get(activeAutoLyrics).timeout)
    if (animationFrame) cancelAnimationFrame(animationFrame)

    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser()
    let dataArray = new Float32Array(0)

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        const microphone = audioContext.createMediaStreamSource(stream)
        analyser.fftSize = 2048

        microphone.connect(analyser)

        dataArray = new Float32Array(analyser.fftSize)

        console.log("Matching started.")
        animationFrame = requestAnimationFrame(compareAudioFeatures)
    })

    activeAutoLyrics.set({ ref: { showId, layoutId } })

    function compareAudioFeatures() {
        analyser.getFloatTimeDomainData(dataArray)

        const rms = Math.sqrt(dataArray.reduce((sum, val) => sum + val * val, 0) / dataArray.length)

        // skip if silent
        if (rms < silenceThreshold) {
            animationFrame = requestAnimationFrame(compareAudioFeatures)
            return
        }

        const frequencies = new Float32Array(analyser.frequencyBinCount)
        analyser.getFloatFrequencyData(frequencies)

        const avgFreq = frequencies.reduce((sum, val) => sum + val, 0) / frequencies.length

        // addToBuffer(rms, avgFreq)

        // // when buffer is filled up, average and store
        // if (rmsBuffer.length >= bufferSize) {
        //     const features = getAveragedFeatures()

        //     if (features && features.avgRms >= silenceThreshold) {
        //         let closestMatch: any = null // AutoLyrics | null = null;
        //         let smallestDiff = Infinity

        //         autoLyricsData.forEach((section) => {
        //             const diff = Math.abs(section.avgRms - features.avgRms) + Math.abs(section.avgFreq - features.avgFreq)
        //             if (diff < smallestDiff) {
        //                 smallestDiff = diff
        //                 closestMatch = section
        //             }
        //         })

        //         console.log(closestMatch.part)
        //     }

        //     clearBuffers()
        // }

        // find the closest match
        let closestMatch: any // AutoLyrics | null = null;
        let smallestDiff = Infinity

        autoLyricsData.forEach((section) => {
            const diff = Math.abs(section.avgRms - rms) + Math.abs(section.avgFreq - avgFreq)
            if (diff < smallestDiff) {
                smallestDiff = diff
                closestMatch = section
            }
        })

        if (closestMatch) {
            const now = Date.now()
            recentMatches.push({ part: closestMatch.part, timestamp: now })

            // remove old matches
            while (recentMatches.length > 0 && now - recentMatches[0].timestamp > matchWindowDuration) {
                recentMatches.shift()
            }

            // get most frequent part in the recent window
            const partCounts: { [key: string]: number } = {}
            recentMatches.forEach((match) => {
                partCounts[match.part] = (partCounts[match.part] || 0) + 1
            })

            // @ts-ignore
            const mostFrequentPart = Object.entries(partCounts).reduce((a, b) => (a[1] > b[1] ? a : b), [null, 0])[0]

            if (mostFrequentPart && mostFrequentPart !== lastDisplayedPart) {
                console.log(mostFrequentPart) // WIP
                lastDisplayedPart = mostFrequentPart
            }
        }

        animationFrame = requestAnimationFrame(compareAudioFeatures)
    }
}

export function stopAutoLyricsMatching() {
    if (!get(activeAutoLyrics)) return

    // clearTimeout(get(activeAutoLyrics).timeout)
    if (animationFrame) cancelAnimationFrame(animationFrame)
    activeAutoLyrics.set(null)

    // if (audioListener) audioListener()
    // audioListener = null
}

// BUFFER HELPER

// let rmsBuffer: number[] = []
// let avgFreqBuffer: number[] = []

// function addToBuffer(rms: number, avgFreq: number) {
//     if (rms >= silenceThreshold) {
//         rmsBuffer.push(rms)
//         avgFreqBuffer.push(avgFreq)
//     }

//     // keep buffer within size
//     if (rmsBuffer.length > bufferSize) {
//         rmsBuffer.shift()
//         avgFreqBuffer.shift()
//     }
// }

// function getAveragedFeatures() {
//     const rmsSum = rmsBuffer.reduce((sum, v) => sum + v, 0)
//     const freqSum = avgFreqBuffer.reduce((sum, v) => sum + v, 0)
//     const n = rmsBuffer.length

//     if (n === 0) return null

//     return {
//         avgRms: rmsSum / n,
//         avgFreq: freqSum / n,
//     }
// }

// function clearBuffers() {
//     rmsBuffer = []
//     avgFreqBuffer = []
// }
