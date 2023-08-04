import { get } from "svelte/store"
import { OUTPUT_STREAM, RECORDER } from "../../../../types/Channels"
import { activeRecording, currentRecordingStream, outputDisplay, recordingPath } from "../../../stores"
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
    mediaRecorder = null
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

// OUTPUT STREAM

export function startOutputStream(sourceId: string) {
    // WIP same as Capture.svelte

    // HD
    const STREAM_WIDTH = 1280
    const STREAM_HEIGHT = 720

    let options: any = {
        audio: false,
        video: {
            // https://github.com/electron/electron/issues/7584
            // cursor: "never",
            mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: sourceId,
                maxWidth: STREAM_WIDTH,
                maxHeight: STREAM_HEIGHT,
                // maxAspectRatio: 16/9,
                maxFrameRate: 60,
            },
        },
    }

    navigator.mediaDevices
        .getUserMedia(options)
        .then((stream) => {
            if (!stream) return console.error("Error getting media stream!")

            let video = document.createElement("video")
            video.srcObject = stream
            video.onloadedmetadata = function () {
                video.play()
            }

            let canvas = document.createElement("canvas")
            canvas.height = STREAM_WIDTH
            canvas.width = STREAM_HEIGHT
            let ctx = canvas.getContext("2d")

            updater()
            function updater() {
                if (get(outputDisplay)) {
                    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)
                    var jpegUrl = canvas.toDataURL("image/jpeg")
                    window.api.send(OUTPUT_STREAM, { channel: "STREAM", data: { base64: jpegUrl } })
                }

                setTimeout(updater, 80)
            }
        })
        .catch(function (err) {
            console.log(err.name + ": " + err.message)
        })
}
