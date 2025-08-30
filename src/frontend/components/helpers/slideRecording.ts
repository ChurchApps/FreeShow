import type { Unsubscriber } from "svelte/store"
import { get } from "svelte/store"
import type { Recording } from "../../../types/Show"
import { activeShow, activeSlideRecording, outLocked, outputs, playingAudio, videosData, videosTime } from "../../stores"
import { getActiveOutputs, setOutput } from "./output"
import { updateOut, checkSectionFirstSlideAction } from "./showActions"
import { _show } from "./shows"
import { updateVideoData, updateVideoTime } from "./video"

/// // SLIDE RECORDING /////

export function playRecording(recording: Recording, { showId, layoutId }, startIndex = 0, subtractTime = 0) {
    if (get(outLocked)) return

    // WIP play multiple recordings at the same time in different outputs...
    if (get(activeSlideRecording)) clearTimeout(get(activeSlideRecording).timeout)

    const layoutRef = _show(showId).layouts([layoutId]).ref()[0]

    const layoutData = layoutRef[recording.sequence?.[0]?.slideRef?.index]?.data || {}
    const showMedia = _show(showId).get("media")
    const audioPath = showMedia[layoutData.audio?.[0] || ""]?.path || ""
    const backgroundPath = layoutData.background && showMedia[layoutData.background]?.muted === false ? showMedia[layoutData.background]?.path : ""
    if (audioPath || audioListener) {
        // WIP pause / change audio duration!!

        // reset playing audio
        if (startIndex === 0) {
            const playing = get(playingAudio)[audioPath]?.audio
            if (playing) {
                playingAudio.update((a) => {
                    a[audioPath].audio.currentTime = 0
                    a[audioPath].paused = false
                    return a
                })
            }
        }

        startAudioListener(audioPath)
    } else if (backgroundPath || backgroundListener) {
        // reset playing video
        if (startIndex === 0) {
            const data = get(videosData)[backgroundPath]
            if (data) {
                updateVideoTime(0)
                updateVideoData({ ...data, paused: false })
            }
        }

        startBackgroundListener()
    }

    let rootTime = Date.now()
    let totalTime = recording.sequence.slice(0, startIndex).reduce((time, value) => (time += value.time), 0)
    if (startIndex > 0) rootTime -= totalTime

    playSequence(startIndex)
    function playSequence(index: number) {
        const sequence = recording.sequence[index]

        if (audioPath && get(playingAudio)[audioPath]?.audio?.paused) return

        const outputId = getActiveOutputs()[0]
        const outSlide = get(outputs)[outputId]?.out?.slide
        if (outSlide?.id !== showId || outSlide?.layout !== layoutId || outSlide?.index !== index) {
            updateOut("active", index, layoutRef)
            const slideIndex = sequence.slideRef.index
            // WIP check that slide is the correct ID ??
            setOutput("slide", { id: showId, layout: layoutId, index: slideIndex, line: 0 })
            checkSectionFirstSlideAction(showId, slideIndex)
        }

        // next
        let nextIndex = index + 1
        while (recording.sequence[nextIndex] && recording.sequence[nextIndex]?.time === 0 && nextIndex < recording.sequence.length - 1) nextIndex++
        if (!recording.sequence[nextIndex]) {
            activeSlideRecording.set(null)
            return
        }

        let timeToNext = recording.sequence[index].time - (index === startIndex ? subtractTime : 0)
        // calculate precise time
        totalTime += timeToNext
        const newTime = totalTime - (Date.now() - rootTime)
        timeToNext = Math.max(0, newTime)

        activeSlideRecording.set({ ref: { showId, layoutId }, index, timeToNext, audioPath, backgroundPath, sequence: recording.sequence, timeout: setTimeout(() => playSequence(nextIndex), timeToNext) })
    }
}

let audioListener: Unsubscriber | null = null
let audioPathListener = ""
function startAudioListener(path: string) {
    audioPathListener = path
    if (audioListener) return

    audioListener = playingAudio.subscribe((a) => {
        const audio = a[audioPathListener]?.audio
        // let audio = a[get(activeSlideRecording)?.audioPath]?.audio
        if (!audio || !get(activeSlideRecording)) return

        checkTimeDifference(audio.currentTime * 1000)
    })
}

let backgroundListener: Unsubscriber | null = null
function startBackgroundListener() {
    if (backgroundListener) return

    // this might not get correct output if background is not playing in first output..
    const activeOutputId = getActiveOutputs(get(outputs), true, true, true)[0]

    backgroundListener = videosTime.subscribe((a) => {
        const time = a[activeOutputId]
        if (!time || !get(activeSlideRecording)) return

        checkTimeDifference(time * 1000)
    })
}

function checkTimeDifference(currentTime: number) {
    // find closest sequence
    let addedTime = 0
    const sequenceIndex = get(activeSlideRecording).sequence.findIndex((sequence) => {
        addedTime += sequence.time
        return addedTime > currentTime
    })
    if (sequenceIndex < 0) return

    const sequenceStartTime = addedTime - get(activeSlideRecording).sequence[sequenceIndex].time
    const difference = currentTime - sequenceStartTime

    const margin = 500
    if (difference < margin) return

    const ref = get(activeSlideRecording).ref
    const recording: Recording = _show(ref.showId).layouts([ref.layoutId]).get("recording")[0]?.[0]

    // change recording time if audio time changes!
    playRecording(recording, ref, sequenceIndex, difference)
}

export function stopSlideRecording() {
    if (!get(activeSlideRecording)) return

    clearTimeout(get(activeSlideRecording).timeout)
    activeSlideRecording.set(null)

    if (audioListener) audioListener()
    audioListener = null
}

// slide click update recording to closest same slide
export function getClosestRecordingSlide(ref, slideIndex: number) {
    const activeRec = get(activeSlideRecording)
    if (!activeRec || activeRec.ref.showId !== ref.showId || activeRec.ref.layoutId !== ref.layoutId) return

    const closest = getClosestIndexes(activeRec.index, activeRec.sequence.length)

    const findFirstWithSameSlideIndex = closest.find((i) => activeRec.sequence[i].slideRef.index === slideIndex)
    if (!findFirstWithSameSlideIndex) return

    const recording: Recording = _show(ref.showId).layouts([ref.layoutId]).get("recording")[0]?.[0]
    if (!recording) return

    const index = findFirstWithSameSlideIndex
    playRecording(recording, activeRec.ref, index)

    // change time of playing audio
    const audioPath = get(activeSlideRecording).audioPath
    if (audioPath) playAudioTrack(audioPath, index, recording)
    // change time of playing background
    const backgroundPath = get(activeSlideRecording).backgroundPath
    if (backgroundPath) playVideo(backgroundPath, index, recording)

    // e.g: index=2, [0, 1, 2, 3, 4, 5, 6] = [2, 1, 3, 0, 4, 5, 6]
    function getClosestIndexes(activeIndex: number, length: number) {
        const arr = Array.from({ length }, (_, i) => i)
        return arr.sort((a, b) => Math.abs(a - activeIndex) - Math.abs(b - activeIndex))
        // prefer right values?
        // e.g: index=2, [0, 1, 2, 3, 4, 5, 6] = [2, 3, 1, 4, 0, 5, 6]
        // arr.sort((a, b) => {
        //     const diff = Math.abs(a - index) - Math.abs(b - index);
        //     return diff === 0 ? a - b : diff;
        // })
    }
}

export function updateSlideRecording(state: "next" | "previous") {
    if (get(outLocked)) return

    const ref = get(activeSlideRecording).ref
    const recording: Recording = _show(ref.showId).layouts([ref.layoutId]).get("recording")[0]?.[0]
    if (!recording) return

    let index = get(activeSlideRecording).index
    let increment = 0
    if (state === "next") increment = 1
    else if (state === "previous") increment = -1

    index += increment
    while (recording.sequence[index] && recording.sequence[index]?.time === 0) index += increment

    playRecording(recording, ref, Math.min(recording.sequence.length - 1, Math.max(0, index)))

    // change time of playing audio
    const audioPath = get(activeSlideRecording).audioPath
    if (audioPath) playAudioTrack(audioPath, index, recording)
    // change time of playing background
    const backgroundPath = get(activeSlideRecording).backgroundPath
    if (backgroundPath) playVideo(backgroundPath, index, recording)
}

function playAudioTrack(path: string, index: number, recording: Recording) {
    const playing = get(playingAudio)[path]?.audio
    if (!playing) return

    const recordingTime: number = recording.sequence.slice(0, index).reduce((time, value) => (time += value.time), 0)
    playingAudio.update((a) => {
        const newTime = recordingTime / 1000
        if (newTime > a[path].audio.duration) return a

        a[path].audio.currentTime = newTime
        return a
    })
}

function playVideo(path: string, index: number, recording: Recording) {
    const data = get(videosData)[path] || {}
    if (!data) return

    const recordingTime: number = recording.sequence.slice(0, index).reduce((time, value) => (time += value.time), 0)
    const newTime = recordingTime / 1000
    if (newTime > data.duration) return

    updateVideoTime(newTime)
}

export function playSlideRecording() {
    const showId = get(activeShow)?.id
    const activeLayout = _show(showId).get("settings.activeLayout")
    const recording: Recording | null = _show(showId).layouts([activeLayout]).get("recording")[0]?.[0]
    if (!recording) return

    playRecording(recording, { showId, layoutId: activeLayout })
}
