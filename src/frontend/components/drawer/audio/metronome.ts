import { get } from "svelte/store"
import { gain, metronome, playingMetronome, special, volume } from "../../../stores"
import { clone } from "../../helpers/array"
import type { API_metronome } from "../../actions/api"

const audioContext = new AudioContext()

const defaultMetronomeValues = {
    tempo: 120, // BPM
    beats: 4,
    volume: 1,
    // notesPerBeat: 1
    // audioOutput: ""
}
let metronomeValues: API_metronome = {}

function initializeValues() {
    metronomeValues = clone(defaultMetronomeValues)
    metronome.set(metronomeValues)
}

export function toggleMetronome() {
    if (get(playingMetronome)) stopMetronome()
    else startMetronome()
}

export function startMetronome(values: API_metronome = {}) {
    if (get(metronome)?.tempo) metronomeValues = get(metronome)
    if (Object.keys(values).length) {
        let oldValues = clone(metronomeValues)
        delete oldValues.volume

        updateMetronome(values, true)

        // return if playing and values are the same
        let newValues = clone(values)
        delete newValues.volume
        if (get(playingMetronome) && JSON.stringify(newValues) === JSON.stringify(oldValues)) return
    }

    if (!metronomeValues.tempo) initializeValues()
    if (get(playingMetronome)) stopMetronome()

    initializeMetronome()
}

export function updateMetronome(values: API_metronome, starting: boolean = false) {
    if (!values.tempo) values.tempo = metronomeValues.tempo || defaultMetronomeValues.tempo
    if (!starting && get(playingMetronome) && values.tempo !== metronomeValues.tempo) return startMetronome(values)

    metronomeValues.tempo = values.tempo
    if (values.beats) metronomeValues.beats = values.beats
    if (values.volume) metronomeValues.volume = values.volume
    if (values.audioOutput !== undefined) metronomeValues.audioOutput = values.audioOutput

    metronome.set(metronomeValues)
}

export function stopMetronome() {
    clearTimeout(scheduleTimeout)
    scheduleTimeout = null
    playingMetronome.set(false)

    startTime = 0
    beatsPlayed = 0
}

const audioFiles = ["beat-hi", "beat-lo"]
let audioBuffers: any = {}
async function setAudioBuffers() {
    if (audioBuffers.hi) return

    await Promise.all(
        audioFiles.map(async (fileName) => {
            let path = `./assets/${fileName}.mp3`
            let id = fileName.slice(fileName.indexOf("-") + 1)

            const audioBuffer = await fetch(path)
                .then((res) => res.arrayBuffer())
                .then((ArrayBuffer) => audioContext.decodeAudioData(ArrayBuffer))

            audioBuffers[id] = audioBuffer
        })
    )
}

////////////////////

// time values are in seconds
let timeBetweenEachBeat = 0
let startTime = 0
async function initializeMetronome() {
    await setAudioBuffers()

    let beatsPerSecond = 60 / (metronomeValues.tempo || defaultMetronomeValues.tempo)
    timeBetweenEachBeat = beatsPerSecond

    scheduleNextNote()
}

const preScheduleTime = 0.1
let scheduleTimeout: any = null
function scheduleNextNote(time = 0, beat = 1) {
    // changing tempo when active could cause many to play at once without this check
    if (scheduleTimeout) return

    if (!startTime) {
        startTime = audioContext.currentTime
        scheduleNote(beat)
        return
    }

    if (beat > (metronomeValues.beats || defaultMetronomeValues.beats)) beat = 1

    scheduleTimeout = setTimeout(
        () => {
            scheduleTimeout = null
            scheduleNote(beat)
        },
        (time + timeBetweenEachBeat - preScheduleTime) * 1000
    )
    playingMetronome.set(true)
}

let beatsPlayed = 0
function scheduleNote(beat: number) {
    beatsPlayed++
    let timeUntilNextNote = getTimeToNextNote()

    playNote(timeUntilNextNote, beat === 1)
    scheduleNextNote(timeUntilNextNote, beat + 1)
}

function getTimeToNextNote() {
    let contextTime = audioContext.currentTime

    let nextPlayTime = timeBetweenEachBeat * beatsPlayed
    let timePassed = contextTime - startTime

    return nextPlayTime - timePassed
}

async function playNote(time: number, first: boolean = false) {
    const source = audioContext.createBufferSource()
    const audioBuffer = audioBuffers[first ? "hi" : "lo"]
    source.buffer = audioBuffer

    // volume control
    let gainNode = audioContext.createGain()
    source.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // WIP connect getAnalyser()

    // custom audio output
    if (metronomeValues.audioOutput !== undefined) {
        try {
            await (audioContext as any).setSinkId(metronomeValues.audioOutput)
        } catch (err) {
            console.error(err)
        }
    }

    gainNode.gain.value = getVolume(first ? accentVolume : secondaryVolume)

    source.start(audioContext.currentTime + time)
}

let accentVolume = 2
let secondaryVolume = 1.75
function getVolume(beatVolume) {
    return beatVolume * (metronomeValues.volume || 1) * get(volume) * (get(special).allowGaining ? get(gain) || 1 : 1)
}
