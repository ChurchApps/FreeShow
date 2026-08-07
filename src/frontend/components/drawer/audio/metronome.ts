import { get } from "svelte/store"
import { AudioAnalyser } from "../../../audio/audioAnalyser"
import { AudioRoutingManager } from "../../../audio/routing/audioRoutingManager"
import { customMetadata, metronome, metronomeTimer, playingMetronome, special } from "../../../stores"
import type { MetronomeSettings } from "../../../types/Audio"
import type { API_metronome } from "../../actions/api"
import { clone } from "../../helpers/array"
import { _show } from "../../helpers/shows"

function getAudioContext() {
    return AudioAnalyser.getAudioContext()
}

const defaultMetronomeValues: MetronomeSettings = {
    tempo: 120, // BPM
    beats: 4,
    accentVolume: 2,
    secondaryVolume: 1.75
}
let metronomeValues: MetronomeSettings = {}

function initializeValues() {
    metronomeValues = clone(defaultMetronomeValues)
    metronome.set(metronomeValues)
}

export function toggleMetronome() {
    if (get(playingMetronome)) stopMetronome()
    else startMetronome()
}

export function startMetronome(values: API_metronome | MetronomeSettings = {}) {
    if (get(metronome)?.tempo) metronomeValues = get(metronome)
    if ("metadataBPM" in values && values.metadataBPM) values.tempo = getShowBPM()
    if (Object.keys(values).length) {
        const oldValues = clone(metronomeValues)

        updateMetronome(values, true)

        // return if playing and values are the same
        const newValues = clone(values)
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

export function updateMetronome(values: API_metronome | MetronomeSettings, starting = false) {
    if (!values.tempo) values.tempo = metronomeValues.tempo || defaultMetronomeValues.tempo
    if (!starting && get(playingMetronome) && values.tempo !== metronomeValues.tempo) return startMetronome(values)

    metronomeValues.tempo = values.tempo
    if (values.beats) metronomeValues.beats = values.beats
    if ("accentVolume" in values && values.accentVolume !== undefined) metronomeValues.accentVolume = values.accentVolume
    if ("secondaryVolume" in values && values.secondaryVolume !== undefined) metronomeValues.secondaryVolume = values.secondaryVolume

    metronome.set(metronomeValues)
}

export function stopMetronome() {
    if (timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
    }

    for (const source of scheduledSources) {
        try {
            source.stop()
            source.disconnect()
        } catch {}
    }
    scheduledSources = []

    for (const timer of activeTimeouts) {
        clearTimeout(timer)
    }
    activeTimeouts = []

    playingMetronome.set(false)
    metronomeTimer.set({ beat: 0, timeToNext: 0 })
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
                .then((ArrayBuffer) => getAudioContext().decodeAudioData(ArrayBuffer))

            const id = index === 0 ? "hi" : "lo"
            audioBuffers[bufferId] = { ...audioBuffers[bufferId], [id]: audioBuffer }
        })
    )
}

/// /////////////////

let timerInterval: NodeJS.Timeout | null = null
let nextNoteTime = 0
let currentBeat = 1

const lookahead = 1.5 // 1.5 seconds lookahead buffer in Web Audio time to withstand UI thread freezes
let scheduledSources: AudioBufferSourceNode[] = []
let activeTimeouts: NodeJS.Timeout[] = []

async function initializeMetronome() {
    await setAudioBuffers()

    currentBeat = 1
    nextNoteTime = getAudioContext().currentTime

    playingMetronome.set(true)

    if (timerInterval) clearInterval(timerInterval)
    timerInterval = setInterval(() => scheduler(), 25)

    scheduler()
}

function scheduler() {
    if (!get(playingMetronome)) return

    const audioContext = getAudioContext()
    if (!audioContext) return

    const totalBeats = metronomeValues.beats || defaultMetronomeValues.beats
    const tempo = metronomeValues.tempo || defaultMetronomeValues.tempo
    const secondsPerBeat = 60 / tempo

    const currentTime = audioContext.currentTime

    // prevent stacking up beats
    if (nextNoteTime < currentTime - 0.05) {
        const timeLag = currentTime - nextNoteTime

        // skip missed beats and catch up currentBeat index
        if (timeLag > secondsPerBeat) {
            const missedBeats = Math.floor(timeLag / secondsPerBeat)
            currentBeat = ((currentBeat - 1 + missedBeats) % totalBeats) + 1
            nextNoteTime += missedBeats * secondsPerBeat
        }

        // don't play missed beats from the past
        if (nextNoteTime < currentTime) nextNoteTime = currentTime
    }

    while (nextNoteTime < currentTime + lookahead) {
        scheduleNote(currentBeat, nextNoteTime)
        nextNoteTime += secondsPerBeat
        currentBeat = (currentBeat % totalBeats) + 1
    }
}

function scheduleNote(beat: number, noteTime: number) {
    const contextTime = getAudioContext().currentTime
    const delayMs = Math.max(0, (noteTime - contextTime) * 1000)

    const timer = setTimeout(() => {
        if (get(playingMetronome)) metronomeTimer.set({ beat, timeToNext: 0 })
    }, delayMs)
    activeTimeouts.push(timer)

    playNoteAtTime(noteTime, beat === 1)
}

async function playNoteAtTime(time: number, first = false) {
    const audioContext = getAudioContext()
    const source = audioContext.createBufferSource()
    const clickSound = get(special)?.clickSound || "metal"
    const bufferId = clickSound === "custom" ? get(special)?.clickSound_hi + get(special)?.clickSound_lo : clickSound
    const audioBuffer = audioBuffers[bufferId]?.[first ? "hi" : "lo"]
    if (!audioBuffer) return
    source.buffer = audioBuffer

    const gainNode = audioContext.createGain()
    source.connect(gainNode)

    // Connect to AudioRoutingManager (this also handles capture/visualizer)
    AudioRoutingManager.getInstance().registerInputNode("metronome", gainNode)
    AudioRoutingManager.getInstance().updateRoutingNodes()

    scheduledSources.push(source)

    source.onended = () => {
        AudioRoutingManager.getInstance().unregisterInputNode("metronome", gainNode)
        const idx = scheduledSources.indexOf(source)
        if (idx !== -1) scheduledSources.splice(idx, 1)
    }

    const volume = first ? (metronomeValues.accentVolume ?? defaultMetronomeValues.accentVolume) : (metronomeValues.secondaryVolume ?? defaultMetronomeValues.secondaryVolume)
    gainNode.gain.value = volume

    source.start(Math.max(audioContext.currentTime, time))
}
