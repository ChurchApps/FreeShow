import { get } from "svelte/store"
import { OUTPUT } from "../../../../types/Channels"
import { Main } from "../../../../types/IPC/Main"
import { AudioAnalyser } from "../../../audio/audioAnalyser"
import { sendMain } from "../../../IPC/main"
import { activeRecording, currentRecordingStream, outputs, special } from "../../../stores"
import { newToast } from "../../../utils/common"
import { send } from "../../../utils/request"
import { checkFFmpeg } from "../../helpers/output"

let mediaRecorder: MediaRecorder | null = null
let recordedChunks: Blob[] = []
let activeCleanup: (() => void) | null = null
let activeLabel = ""
let stopResolver: (() => void) | null = null

// Output recordings encoded in capture worker (keyed by outputId)
const outputRecordings = new Map<string, { outputId: string; label: string; part: number; paused: boolean; startedAt: number }>()

function recordOutput(rec: { outputId: string; label: string; part: number; paused: boolean }, state: boolean) {
    const { outputId, label, part } = rec
    const name = getRecordingFileName(part > 1 ? `${label}_part${part}` : label, "mp4")
    send(OUTPUT, ["RECORD_OUTPUT"], { id: outputId, state, name, path: get(special)?.audioRecordingsPath })
    send(OUTPUT, ["CAPTURE"], { id: outputId, captures: { recorder: state } })
}

function updateActiveRecordingStore() {
    if (!outputRecordings.size && !mediaRecorder) {
        activeRecording.set(null)
        return
    }

    const outputsObj: Record<string, any> = {}
    let first: any = null

    outputRecordings.forEach((rec, outId) => {
        const item = { outputId: outId, isOutput: true, type: "output", startedAt: rec.startedAt }
        outputsObj[outId] = item
        if (!first) first = item
    })

    if (first) {
        activeRecording.set({ ...first, outputs: outputsObj, count: outputRecordings.size })
    }
}

export function isOutputRecording(outputId?: string): boolean {
    const active = get(activeRecording)
    if (outputId) {
        return !!active?.outputs?.[outputId] || outputRecordings.has(outputId)
    }
    return !!active?.isOutput || outputRecordings.size > 0
}

const getMimeType = () => (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm; codecs=vp9,opus") ? "video/webm; codecs=vp9,opus" : "video/webm")

export function createMediaRecorder(stream: MediaStream, options?: { onCleanup?: () => void; label?: string }) {
    activeCleanup = options?.onCleanup || null
    activeLabel = options?.label || ""
    recordedChunks = []

    updateActiveRecordingStore()
    newToast("toast.recording_started")

    mediaRecorder = new MediaRecorder(stream, { mimeType: getMimeType() })
    mediaRecorder.ondataavailable = (e) => e.data?.size && recordedChunks.push(e.data)
    mediaRecorder.onstop = handleStop
    mediaRecorder.start(1000)
}

export function mediaRecorderIsPaused(outputId?: string): boolean {
    const rec = outputId ? outputRecordings.get(outputId) : outputRecordings.values().next().value
    return rec ? rec.paused : !mediaRecorder || mediaRecorder.state === "paused"
}

export function toggleMediaRecorder(outputId?: string): boolean {
    const rec = outputId ? outputRecordings.get(outputId) : outputRecordings.values().next().value
    if (rec) {
        rec.paused = !rec.paused
        if (!rec.paused) rec.part++
        recordOutput(rec, !rec.paused)
        return rec.paused
    }
    if (!mediaRecorder) return false
    if (mediaRecorder.state === "paused") {
        mediaRecorder.resume()
        return false
    }
    if (mediaRecorder.state === "recording") {
        mediaRecorder.pause()
        return true
    }
    return false
}

export function stopOutputRecording(outputId: string): void {
    const rec = outputRecordings.get(outputId)
    if (!rec) return

    if (!rec.paused) recordOutput(rec, false)
    outputRecordings.delete(outputId)
    if (!outputRecordings.size) AudioAnalyser.recorderDeactivate()

    newToast("toast.recording_stopped")
    updateActiveRecordingStore()
}

export function stopMediaRecorder(outputId?: string): Promise<void> {
    if (outputId && outputRecordings.has(outputId)) {
        stopOutputRecording(outputId)
        return Promise.resolve()
    }

    if (outputRecordings.size) {
        outputRecordings.forEach((rec) => !rec.paused && recordOutput(rec, false))
        outputRecordings.clear()
        AudioAnalyser.recorderDeactivate()
        newToast("toast.recording_stopped")
        currentRecordingStream.set(null)
        activeRecording.set(null)
        return Promise.resolve()
    }

    if (!get(activeRecording) || !mediaRecorder) {
        activeCleanup?.()
        activeCleanup = null
        currentRecordingStream.set(null)
        activeRecording.set(null)
        return Promise.resolve()
    }

    return new Promise((resolve) => {
        stopResolver = resolve
        if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop()
        else handleStop()
    })
}

export function getRecordingFileName(label = "", extension = "webm"): string {
    const formattedLabel = label ? `${label.replace(/[\\/:*?"<>|]/g, "_")}_` : ""
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
    return `FreeShow_${formattedLabel}${timestamp}.${extension}`
}

async function handleStop() {
    newToast("toast.recording_stopped")

    const blob = new Blob(recordedChunks, { type: getMimeType() })
    const arraybuffer = await blob.arrayBuffer()
    const name = getRecordingFileName(activeLabel)

    if (arraybuffer.byteLength > 0) {
        sendMain(Main.RECORDER, { blob: arraybuffer, name, path: get(special)?.audioRecordingsPath })
    }

    activeCleanup?.()
    activeCleanup = null
    activeLabel = ""
    currentRecordingStream.set(null)
    activeRecording.set(null)
    recordedChunks = []
    mediaRecorder = null

    stopResolver?.()
    stopResolver = null
}

export async function startOutputRecording(outputId: string): Promise<void> {
    if (outputRecordings.has(outputId)) {
        stopOutputRecording(outputId)
        return
    }

    if (!(await checkFFmpeg())) return

    const output = get(outputs)[outputId]
    if (!output) {
        newToast("toast.error_media")
        return
    }

    const rec = { outputId, label: output.name || "Output", part: 1, paused: false, startedAt: Date.now() }
    outputRecordings.set(outputId, rec)
    recordOutput(rec, true)
    currentRecordingStream.set(null)
    updateActiveRecordingStore()

    AudioAnalyser.recorderActivate()
    newToast("toast.recording_started")
}
