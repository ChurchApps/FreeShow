import { get } from "svelte/store"
import { RECORDER } from "../../../../types/Channels"
import { activeRecording, currentRecordingStream, recordingPath } from "../../../stores"
import { newToast } from "../../../utils/messages"

let mediaRecorder
let recordedChunks: any[] = []
const options: any = { mimeType: "video/webm; codecs=vp9" }
export function createMediaRecorder(stream) {
    newToast("$toast.recording_started")
    mediaRecorder = new MediaRecorder(stream, options)
    mediaRecorder.start()

    mediaRecorder.ondataavailable = handleDataAvailable
    mediaRecorder.onstop = handleStop
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
    console.log("Video available")
    recordedChunks.push(e.data)
}

async function handleStop() {
    newToast("$toast.recording_stopped")

    const blob = new Blob(recordedChunks, options)
    const arraybuffer = await blob.arrayBuffer()

    let name = `FreeShow_${formatTime()}.webm`
    window.api.send(RECORDER, { blob: arraybuffer, path: get(recordingPath), name })

    currentRecordingStream.set(null)
    activeRecording.set(null)
    recordedChunks = []
}

function formatTime() {
    var today = new Date()
    var s = String(today.getSeconds()).padStart(2, "0")
    var m = String(today.getMinutes()).padStart(2, "0")
    var h = String(today.getHours()).padStart(2, "0")
    var dd = String(today.getDate()).padStart(2, "0")
    var mm = String(today.getMonth() + 1).padStart(2, "0")
    var yyyy = today.getFullYear()

    return mm + "-" + dd + "-" + yyyy + "_" + h + "-" + m + "-" + s
}
