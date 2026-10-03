import { get } from "svelte/store"
import { OUTPUT } from "../../../../types/Channels"
import { Main } from "../../../../types/IPC/Main"
import { AudioAnalyser } from "../../../audio/audioAnalyser"
import { AudioRoutingManager } from "../../../audio/routing/audioRoutingManager"
import { sendMain } from "../../../IPC/main"
import { activeRecording, audioRouting, currentRecordingStream, outputs, special } from "../../../stores"
import { newToast } from "../../../utils/common"
import { send } from "../../../utils/request"
import { getOutputResolution } from "../../helpers/output"
import { onStreamFrame } from "../../../utils/streamPort"
import { StreamCanvasRenderer } from "./streamCanvas"

let mediaRecorder: MediaRecorder | null = null
let recordedChunks: Blob[] = []
let activeCleanup: (() => void) | null = null
let activeLabel = ""
let stopResolver: (() => void) | null = null

const getMimeType = () => (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm; codecs=vp9,opus") ? "video/webm; codecs=vp9,opus" : "video/webm")

export function createMediaRecorder(stream: MediaStream, options?: { onCleanup?: () => void; label?: string }) {
    activeCleanup = options?.onCleanup || null
    activeLabel = options?.label || ""
    recordedChunks = []

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

export const mediaRecorderIsPaused = () => !mediaRecorder || mediaRecorder.state === "paused"

export function toggleMediaRecorder(): boolean {
    if (!mediaRecorder) return false
    if (mediaRecorder.state === "paused") {
        mediaRecorder.resume()
        return false
    }
    mediaRecorder.pause()
    return true
}

export function stopMediaRecorder(): Promise<void> {
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

function getOutputVideoStream(outputId: string): { stream: MediaStream; cleanup: () => void } {
    const canvas = document.createElement("canvas")
    const res = getOutputResolution(outputId, get(outputs), true) || { width: 1920, height: 1080 }
    canvas.width = res.width || 1920
    canvas.height = res.height || 1080

    // frames come from the capture worker over shared memory (see RecorderStream.ts)
    const renderer = new StreamCanvasRenderer()
    const unlisten = onStreamFrame("RECORDER", (data) => {
        if (data.id === outputId) renderer.draw(canvas, data.frame)
    })

    // Start capture in Electron
    send(OUTPUT, ["CAPTURE"], { id: outputId, captures: { recorder: true } })

    // The canvas keeps its last frame, so a static slide is recorded by asking the track for frames
    // rather than redrawing it
    const stream = canvas.captureStream(0)
    const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack
    const keepalive = setInterval(() => track.requestFrame(), 1000 / 30)

    return {
        stream,
        cleanup: () => {
            clearInterval(keepalive)
            unlisten()
            renderer.destroy()
            send(OUTPUT, ["CAPTURE"], { id: outputId, captures: { recorder: false } })
            stream.getTracks().forEach((t) => t.stop())
        }
    }
}

function getOutputAudioStream(outputId: string): { stream: MediaStream; cleanup: () => void } {
    const audioCtx = AudioAnalyser.getAudioContext()
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {})
    const audioDest = audioCtx.createMediaStreamDestination()

    const conns = get(audioRouting)?.connections || []
    const channels = get(audioRouting)?.channels || []

    const networkChannels = conns.filter((c) => c.to === `network_sub_${outputId}`).map((c) => c.from)
    const outputChannelId = `channel_${outputId}`
    if (networkChannels.length === 0 && channels.some((c) => c.id === outputChannelId)) {
        networkChannels.push(outputChannelId)
    }

    const targetChannels = networkChannels.length > 0 ? networkChannels : ["main"]
    targetChannels.forEach((chId) => AudioRoutingManager.getInstance().registerChannelRecorder(chId, audioDest))

    const netNode = networkChannels.length > 0 ? AudioAnalyser.getOrCreateDestinationNode(outputId) : null
    if (netNode) {
        try { netNode.connect(audioDest) } catch {}
    }

    return {
        stream: audioDest.stream,
        cleanup: () => {
            audioDest.stream.getTracks().forEach((t) => t.stop())
            if (netNode) {
                try { netNode.disconnect(audioDest) } catch {}
            }
            targetChannels.forEach((chId) => AudioRoutingManager.getInstance().unregisterChannelRecorder(chId, audioDest))
        }
    }
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

    const video = getOutputVideoStream(outputId)
    if (!video.stream.getVideoTracks().length) {
        newToast("toast.error_media")
        video.cleanup()
        return
    }

    const audio = getOutputAudioStream(outputId)
    const onCleanup = () => {
        video.cleanup()
        audio.cleanup()
    }

    const combinedStream = new MediaStream([...video.stream.getVideoTracks(), ...audio.stream.getAudioTracks()])
    currentRecordingStream.set(combinedStream)
    activeRecording.set({ outputId, isOutput: true, type: "output" })

    createMediaRecorder(combinedStream, { onCleanup, label: output.name || "Output" })
}
