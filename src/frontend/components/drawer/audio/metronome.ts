import { get } from "svelte/store"
import { AudioPlayer } from "../../../audio/audioPlayer"
import { customMetadata, metronome, metronomeTimer, playingMetronome, special, volume } from "../../../stores"
import type { API_metronome } from "../../actions/api"
import { clone } from "../../helpers/array"
import { _show } from "../../helpers/shows"

const audioContext = new AudioContext()

const defaultMetronomeValues = {
    tempo: 120, // BPM
    beats: 4,
    volume: 1
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
    if (values.metadataBPM) values.tempo = getShowBPM()
    if (Object.keys(values).length) {
        const oldValues = clone(metronomeValues)
        delete oldValues.volume

        updateMetronome(values, true)

        // return if playing and values are the same
        const newValues = clone(values)
        delete newValues.volume
        if (get(playingMetronome) && JSON.stringify(newValues) === JSON.stringify(oldValues)) return
    }

    if (!metronomeValues.tempo) initializeValues()
    if (get(playingMetronome)) stopMetronome()

    initializeMetronome()
}

export function getShowBPM() {
    const showMetadata = _show().get("meta")
    const customKey = get(customMetadata).custom.find((a) => a.toLowerCase().includes("bpm")) || "BPM"
    return Math.floor(parseFloat(showMetadata[customKey] || 0)) || 120
}

export function updateMetronome(values: API_metronome, starting = false) {
    if (!values.tempo) values.tempo = metronomeValues.tempo || defaultMetronomeValues.tempo
    if (!starting && get(playingMetronome) && values.tempo !== metronomeValues.tempo) return startMetronome(values)

    metronomeValues.tempo = values.tempo
    if (values.beats) metronomeValues.beats = values.beats
    if (values.volume) metronomeValues.volume = values.volume
    if (values.audioOutput !== undefined) metronomeValues.audioOutput = values.audioOutput

    metronome.set(metronomeValues)
}

export function stopMetronome() {
    if (scheduleTimeout) clearTimeout(scheduleTimeout)
    scheduleTimeout = null
    playingMetronome.set(false)
    metronomeTimer.set({ beat: 0, timeToNext: 0 })

    startTime = 0
    beatsPlayed = 0
}

const clickFiles = {
    // soft: ["beat-soft-hi.webm", "beat-soft-lo.webm"],
    metal: ["beat-metal-hi.webm", "beat-metal-lo.webm"],
    wood: ["beat-wood-hi.webm", "beat-wood-lo.webm"]
}
const audioBuffers: { [key: string]: { hi: AudioBuffer; lo: AudioBuffer } } = {}
async function setAudioBuffers() {
    const clickSound = get(special)?.clickSound || "metal"
    const bufferId = clickSound === "custom" ? get(special)?.clickSound_hi + get(special)?.clickSound_lo : clickSound
    if (!bufferId || audioBuffers[bufferId]) return

    const clickSounds = clickSound === "custom" ? [get(special)?.clickSound_hi, get(special)?.clickSound_lo] : clickFiles[clickSound]

    await Promise.all(
        clickSounds.map(async (fileName, index) => {
            if (!fileName) return

            const path = clickSound === "custom" ? `file://${fileName}` : `./assets/metronome/${fileName}`

            const audioBuffer = await fetch(path)
                .then((res) => res.arrayBuffer())
                .then((ArrayBuffer) => audioContext.decodeAudioData(ArrayBuffer))

            const id = index === 0 ? "hi" : "lo"
            audioBuffers[bufferId] = { ...audioBuffers[bufferId], [id]: audioBuffer }
        })
    )
}

/// /////////////////

// time values are in seconds
let timeBetweenEachBeat = 0
let startTime = 0
async function initializeMetronome() {
    await setAudioBuffers()

    const beatsPerSecond = 60 / (metronomeValues.tempo || defaultMetronomeValues.tempo)
    timeBetweenEachBeat = beatsPerSecond

    scheduleNextNote()
}

const preScheduleTime = 0.1
let scheduleTimeout: NodeJS.Timeout | null = null
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
    const timeUntilNextNote = getTimeToNextNote()

    metronomeTimer.set({ beat, timeToNext: timeUntilNextNote })

    playNote(timeUntilNextNote, beat === 1)
    scheduleNextNote(timeUntilNextNote, beat + 1)
}

function getTimeToNextNote() {
    const contextTime = audioContext.currentTime

    const nextPlayTime = timeBetweenEachBeat * beatsPlayed
    const timePassed = contextTime - startTime

    return nextPlayTime - timePassed
}

async function playNote(time: number, first = false) {
    const source = audioContext.createBufferSource()
    const clickSound = get(special)?.clickSound || "metal"
    const bufferId = clickSound === "custom" ? get(special)?.clickSound_hi + get(special)?.clickSound_lo : clickSound
    const audioBuffer = audioBuffers[bufferId]?.[first ? "hi" : "lo"]
    if (!audioBuffer) return

    source.buffer = audioBuffer

    // volume control
    const gainNode = audioContext.createGain()
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

const accentVolume = 2
const secondaryVolume = 1.75
function getVolume(beatVolume) {
    return beatVolume * (metronomeValues.volume || 1) * get(volume) * AudioPlayer.getGain()
}
