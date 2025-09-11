import { get } from "svelte/store"
import { RECORDER } from "../../../../types/Channels"
import { activeRecording, currentRecordingStream, dataPath } from "../../../stores"
import { newToast } from "../../../utils/common"

let mediaRecorder
let recordedChunks: any[] = []
const options: any = { mimeType: "video/webm; codecs=vp9" }
export function createMediaRecorder(stream) {
    newToast("toast.recording_started")
    mediaRecorder = new MediaRecorder(stream, options)
    mediaRecorder.start()

    mediaRecorder.ondataavailable = handleDataAvailable
    mediaRecorder.onstop = handleStop
}

export function mediaRecorderIsPaused() {
    return mediaRecorder?.state === "paused"
}

export function toggleMediaRecorder() {
    if (mediaRecorder.state === "paused") {
        mediaRecorder.resume()
        return false
    }

    mediaRecorder.pause()
    return true
}

export function stopMediaRecorder() {
    mediaRecorder.stop()
}

function handleDataAvailable(e: any) {
    recordedChunks.push(e.data)
}

async function handleStop() {
    newToast("toast.recording_stopped")

    const blob = new Blob(recordedChunks, options)
    const arraybuffer = await blob.arrayBuffer()

    const name = `FreeShow_${formatTime()}.webm`
    window.api.send(RECORDER, { blob: arraybuffer, path: get(dataPath), name })

    currentRecordingStream.set(null)
    activeRecording.set(null)
    recordedChunks = []
    mediaRecorder = null
}

function formatTime() {
    const today = new Date()
    const s = String(today.getSeconds()).padStart(2, "0")
    const m = String(today.getMinutes()).padStart(2, "0")
    const h = String(today.getHours()).padStart(2, "0")
    const dd = String(today.getDate()).padStart(2, "0")
    const mm = String(today.getMonth() + 1).padStart(2, "0")
    const yyyy = today.getFullYear()

    return mm + "-" + dd + "-" + yyyy + "_" + h + "-" + m + "-" + s
}
