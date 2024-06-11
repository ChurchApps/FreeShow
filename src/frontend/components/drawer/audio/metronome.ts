import { get } from "svelte/store"
import { gain, metronome, volume } from "../../../stores"
import { clone } from "../../helpers/array"

const audioContext = new AudioContext()

const defaultMetronomeValues = {
    // context: null,
    timeout: null as any,
    tempo: 120, // BPM
    beats: 4,
    volume: 1,
    // notesPerBeat: 1
}
let metronomeValues: any = {}

function initializeValues() {
    metronomeValues = clone(defaultMetronomeValues)
    metronome.set(metronomeValues)
}

export function toggleMetronome() {
    if (metronomeValues.timeout) stopMetronome()
    else startMetronome()
}

export function startMetronome(values = {}) {
    if (get(metronome)?.context) metronomeValues = get(metronome)
    if (!metronomeValues.tempo) initializeValues()
    if (metronomeValues.timeout) stopMetronome()
    if (Object.keys(values).length) updateMetronome(values, true)

    initializeMetronome()
}

export function updateMetronome(values, starting: boolean = false) {
    if (!values.tempo) values.tempo = metronomeValues.tempo
    if (!starting && values.tempo !== metronomeValues.tempo) return startMetronome(values)

    metronomeValues.tempo = values.tempo
    if (values.beats) metronomeValues.beats = values.beats
    if (values.volume) metronomeValues.volume = values.volume

    metronome.set(metronomeValues)
}

export function stopMetronome() {
    clearTimeout(metronomeValues.timeout)
    metronomeValues.timeout = null
    metronome.set(metronomeValues)

    startTime = 0
    beatsPlayed = 0
}

const audioFiles = ["beat-hi", "beat-lo"]
let audioBuffers: any = {}
async function setAudioBuffers() {
    if (audioBuffers.hi) return

    await Promise.all(
        audioFiles.map(async (fileName) => {
            let path = `../assets/${fileName}.mp3`
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

    let beatsPerSecond = 60 / metronomeValues.tempo
    timeBetweenEachBeat = beatsPerSecond

    scheduleNextNote()
}

const preScheduleTime = 0.1
function scheduleNextNote(time = 0, beat = 1) {
    if (!startTime) {
        startTime = audioContext.currentTime
        scheduleNote(beat)
        return
    }

    if (beat > metronomeValues.beats) beat = 1

    metronomeValues.timeout = setTimeout(() => {
        scheduleNote(beat)
    }, (time + timeBetweenEachBeat - preScheduleTime) * 1000)
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

function playNote(time: number, first: boolean = false) {
    const source = audioContext.createBufferSource()
    const audioBuffer = audioBuffers[first ? "hi" : "lo"]
    source.buffer = audioBuffer

    // volume control
    let gainNode = audioContext.createGain()
    source.connect(gainNode)
    gainNode.connect(audioContext.destination)

    gainNode.gain.value = getVolume(first ? accentVolume : secondaryVolume)

    source.start(audioContext.currentTime + time)
}

let accentVolume = 2
let secondaryVolume = 1.75
function getVolume(beatVolume) {
    return beatVolume * metronomeValues.volume * get(volume) * get(gain)
}

// const beepLength: number = 0.05
// function scheduleNoteOsc(beatNumber, time) {
//     // audio creator
//     let osc = audioContext.createOscillator()
//     // volume control
//     let gainNode = audioContext.createGain()

//     osc.connect(gainNode)
//     gainNode.connect(audioContext.destination)

//     let mainVolume = getVolume(secondaryVolume)

//     if (beatNumber === twelvelet && accentVolume > 0.25) {
//         osc.frequency.value = 880.0
//         gainNode.gain.value = getVolume(accentVolume)
//     } else if (beatNumber % twelvelet === 0) {
//         // quarter notes = medium pitch
//         osc.frequency.value = 440.0
//         gainNode.gain.value = mainVolume
//         // } else if (beatNumber % 6 === 0) {
//         //     // eighth notes
//         //     osc.frequency.value = 440.0
//         //     gainNode.gain.value = notesPerBeat > 1 ? mainVolume : 0
//         // } else if (beatNumber % 4 === 0) {
//         //     // triplet notes
//         //     osc.frequency.value = 300.0
//         //     gainNode.gain.value = notesPerBeat > 2 ? mainVolume : 0
//         // } else if (beatNumber % 3 === 0) {
//         //     // sixteenth notes = low pitch
//         //     osc.frequency.value = 220.0
//         //     gainNode.gain.value = notesPerBeat > 3 ? mainVolume : 0
//     } else {
//         // don't play the remaining twelvelet notes
//         gainNode.gain.value = 0
//     }

//     osc.start(time)
//     osc.stop(time + beepLength)
// }
