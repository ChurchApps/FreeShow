import { get } from "svelte/store"
import { activeShow, activeSlideRecording, outLocked, outputs, playingAudio } from "../../stores"
import type { Recording } from "../../../types/Show"
import { _show } from "./shows"
import { updateOut } from "./showActions"
import { getActiveOutputs, setOutput } from "./output"

///// SLIDE RECORDING /////

export function playRecording(recording: Recording, { showId, layoutId }, startIndex: number = 0, subtractTime: number = 0) {
    if (get(outLocked)) return

    // WIP play multiple recordings at the same time in different outputs...
    if (get(activeSlideRecording)) clearTimeout(get(activeSlideRecording).timeout)

    let layoutRef = _show(showId).layouts([layoutId]).ref()[0]

    let layoutData = layoutRef[recording.sequence?.[0]?.slideRef?.index]?.data || {}
    let audio = layoutData.audio?.[0]
    if (audio || audioListener) {
        let showMedia = _show(showId).get("media")
        audio = showMedia[audio]?.path
        startAudioListener(audio)
    }

    let rootTime = Date.now()
    let totalTime = recording.sequence.slice(0, startIndex).reduce((time, value) => (time += value.time), 0)
    if (startIndex > 0) rootTime -= totalTime

    playSequence(startIndex)
    function playSequence(index: number) {
        let sequence = recording.sequence[index]

        if (audio && get(playingAudio)[audio]?.audio?.paused) return

        let outputId = getActiveOutputs()[0]
        let outSlide = get(outputs)[outputId]?.out?.slide
        if (outSlide?.id !== showId || outSlide?.layout !== layoutId || outSlide?.index !== index) {
            updateOut("active", index, layoutRef)
            let slideIndex = sequence.slideRef.index
            // WIP check that slide is the correct ID ??
            setOutput("slide", { id: showId, layout: layoutId, index: slideIndex, line: 0 })
        }

        // next
        let nextIndex = index + 1
        if (!recording.sequence[nextIndex]) {
            activeSlideRecording.set(null)
            return
        }

        let timeToNext = recording.sequence[index].time - (index === startIndex ? subtractTime : 0)
        // calculate precise time
        totalTime += timeToNext
        let newTime = totalTime - (Date.now() - rootTime)
        timeToNext = Math.max(0, newTime)

        activeSlideRecording.set({ ref: { showId, layoutId }, index, timeToNext, audio, sequence: recording.sequence, timeout: setTimeout(() => playSequence(nextIndex), timeToNext) })
    }
}

let audioListener: any = null
let audioPathListener: string = ""
function startAudioListener(path: string) {
    audioPathListener = path
    if (audioListener) return

    audioListener = playingAudio.subscribe((a) => {
        let audio = a[audioPathListener]?.audio
        if (!audio || !get(activeSlideRecording)) return

        let currentTime = audio.currentTime * 1000

        // find closest sequence
        let addedTime: number = 0
        let sequenceIndex = get(activeSlideRecording).sequence.findIndex((sequence) => {
            addedTime += sequence.time
            return addedTime > currentTime
        })
        if (sequenceIndex < 0) return

        let sequenceStartTime = addedTime - get(activeSlideRecording).sequence[sequenceIndex].time
        let difference = currentTime - sequenceStartTime

        let margin = 500
        if (difference < margin) return

        let ref = get(activeSlideRecording).ref
        let recording: Recording = _show(ref.showId).layouts([ref.layoutId]).get("recording")[0]?.[0]

        // change recording time if audio time changes!
        playRecording(recording, ref, sequenceIndex, difference)
    })
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
    let activeRec = get(activeSlideRecording)
    if (!activeRec || activeRec.ref.showId !== ref.showId || activeRec.ref.layoutId !== ref.layoutId) return

    let closest = getClosestIndexes(activeRec.index, activeRec.sequence.length)

    let findFirstWithSameSlideIndex = closest.find((index) => activeRec.sequence[index].slideRef.index === slideIndex)
    if (!findFirstWithSameSlideIndex) return

    let recording: Recording = _show(ref.showId).layouts([ref.layoutId]).get("recording")[0]?.[0]
    if (!recording) return

    let index = findFirstWithSameSlideIndex
    playRecording(recording, activeRec.ref, index)

    // change time of playing audio
    let audioPath = get(activeSlideRecording).audio
    if (audioPath) playAudioTrack(audioPath, index, recording)

    // e.g: index=2, [0, 1, 2, 3, 4, 5, 6] = [2, 1, 3, 0, 4, 5, 6]
    function getClosestIndexes(index: number, length: number) {
        const arr = Array.from({ length }, (_, i) => i)
        return arr.sort((a, b) => Math.abs(a - index) - Math.abs(b - index))
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

    let ref = get(activeSlideRecording).ref
    let recording: Recording = _show(ref.showId).layouts([ref.layoutId]).get("recording")[0]?.[0]
    if (!recording) return

    let index = get(activeSlideRecording).index
    if (state === "next") index++
    else if (state === "previous") index--

    playRecording(recording, ref, Math.min(recording.sequence.length - 1, Math.max(0, index)))

    // change time of playing audio
    let audioPath = get(activeSlideRecording).audio
    if (audioPath) playAudioTrack(audioPath, index, recording)
}

function playAudioTrack(path: string, index: number, recording: Recording) {
    let playing = get(playingAudio)[path]?.audio
    if (!playing) return

    let recordingTime: number = recording.sequence.slice(0, index).reduce((time, value) => (time += value.time), 0)
    playingAudio.update((a) => {
        let newTime = recordingTime / 1000
        if (newTime > a[path].audio.duration) return a

        a[path].audio.currentTime = newTime
        return a
    })
}

export function playSlideRecording() {
    let showId = get(activeShow)?.id
    let activeLayout = _show(showId).get("settings.activeLayout")
    let recording: Recording | null = _show(showId).layouts([activeLayout]).get("recording")[0]?.[0]
    if (!recording) return

    playRecording(recording, { showId, layoutId: activeLayout })
}
