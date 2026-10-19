import { get } from "svelte/store"
import { OUTPUT } from "../../../../types/Channels"
import { Main } from "../../../../types/IPC/Main"
import { sendMain } from "../../../IPC/main"
import { activeRecording, currentRecordingStream, outputs, special } from "../../../stores"
import { newToast } from "../../../utils/common"
import { send } from "../../../utils/request"

let mediaRecorder: MediaRecorder | null = null
let recordedChunks: Blob[] = []
let activeCleanup: (() => void) | null = null
let activeLabel = ""
let stopResolver: (() => void) | null = null

// An output is recorded by its hardware encoder in the capture worker (see OutputRecording.ts): this
// window only says where. A pause closes the current file and the recording continues in a new part.
let outputRecording: { outputId: string; label: string; part: number; paused: boolean } | null = null

function recordOutput(state: boolean) {
    if (!outputRecording) return
    const { outputId, label, part } = outputRecording
    const name = getRecordingFileName(part > 1 ? `${label}_part${part}` : label, "mp4")
    send(OUTPUT, ["RECORD_OUTPUT"], { id: outputId, state, name, path: get(special)?.audioRecordingsPath })
    send(OUTPUT, ["CAPTURE"], { id: outputId, captures: { recorder: state } })
}

const getMimeType = () => (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm; codecs=vp9,opus") ? "video/webm; codecs=vp9,opus" : "video/webm")

export function createMediaRecorder(stream: MediaStream, options?: { onCleanup?: () => void; label?: string }) {
    activeCleanup = options?.onCleanup || null
    activeLabel = options?.label || ""
    recordedChunks = []

    activeRecording.update((a) => (a ? { ...a, startedAt: a.startedAt || Date.now() } : { startedAt: Date.now() }))

    newToast("toast.recording_started")
    mediaRecorder = new MediaRecorder(stream, { mimeType: getMimeType() })
    mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
            recordedChunks.push(e.data)
        }
    }
    mediaRecorder.onstop = handleStop
    mediaRecorder.start(1000)
}

export const mediaRecorderIsPaused = () => (outputRecording ? outputRecording.paused : !mediaRecorder || mediaRecorder.state === "paused")

export function toggleMediaRecorder(): boolean {
    if (outputRecording) {
        outputRecording.paused = !outputRecording.paused
        if (!outputRecording.paused) outputRecording.part++
        recordOutput(!outputRecording.paused)
        return outputRecording.paused
    }
    if (!mediaRecorder) return false
    if (mediaRecorder.state === "paused") {
        mediaRecorder.resume()
        return false
    }
    mediaRecorder.pause()
    return true
}

export function stopMediaRecorder(): Promise<void> {
    if (outputRecording) {
        if (!outputRecording.paused) recordOutput(false)
        outputRecording = null
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
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop()
        } else {
            handleStop()
        }
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
    if (get(activeRecording)) {
        await stopMediaRecorder()
        return
    }

    const output = get(outputs)[outputId]
    if (!output) {
        newToast("toast.error_media")
        return
    }

    outputRecording = { outputId, label: output.name || "Output", part: 1, paused: false }
    recordOutput(true)
    currentRecordingStream.set(null)
    activeRecording.set({ outputId, isOutput: true, type: "output" })
    newToast("toast.recording_started")
}
