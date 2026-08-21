import { Main } from "../../types/IPC/Main"
import { sendMain } from "../IPC/main"
import { recordingChannels } from "../stores"
import { newToast } from "../utils/common"
import { AudioAnalyser } from "./audioAnalyser"
import { AudioRoutingManager } from "./routing/audioRoutingManager"

const activeRecorders: { [channelId: string]: { recorder: MediaRecorder; stream: MediaStream; chunks: any[] } } = {}
const options: any = { mimeType: "audio/webm; codecs=opus" }

export function toggleChannelRecording(channelId: string, label?: string) {
    if (activeRecorders[channelId]) stopChannelRecording(channelId)
    else startChannelRecording(channelId, label)
}

export function startChannelRecording(channelId: string, label = "") {
    if (activeRecorders[channelId]) return

    const audioCtx = AudioAnalyser.getAudioContext()
    const streamDest = audioCtx.createMediaStreamDestination()
    AudioRoutingManager.getInstance().registerChannelRecorder(channelId, streamDest)

    const recorder = new MediaRecorder(streamDest.stream, options)
    const chunks: any[] = []

    recorder.ondataavailable = (e) => chunks.push(e.data)
    recorder.onstop = async () => {
        newToast("toast.recording_stopped")
        const blob = new Blob(chunks, options)
        const arraybuffer = await blob.arrayBuffer()

        const name = `FreeShow_${label ? label.replace(/[\\/:*?"<>|]/g, "_") + "_" : ""}${formatTime()}.webm`
        sendMain(Main.RECORDER, { blob: arraybuffer, name })

        streamDest.stream.getTracks().forEach((track) => track.stop())
        AudioRoutingManager.getInstance().unregisterChannelRecorder(channelId, streamDest)
    }

    recorder.start()
    activeRecorders[channelId] = { recorder, stream: streamDest.stream, chunks }
    recordingChannels.update((a) => ({ ...a, [channelId]: true }))
    newToast("toast.recording_started")
}

export function stopChannelRecording(channelId: string) {
    const active = activeRecorders[channelId]
    if (!active) return

    delete activeRecorders[channelId]
    recordingChannels.update((a) => {
        delete a[channelId]
        return a
    })

    if (active.recorder.state !== "inactive") active.recorder.stop()
}

export function isChannelRecording(channelId = "main") {
    return !!activeRecorders[channelId]
}

export function stopAllChannelRecordings() {
    Object.keys(activeRecorders).forEach((channelId) => stopChannelRecording(channelId))
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
