import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { sendMain } from "../IPC/main"
import { recordingChannels, special } from "../stores"
import { newToast } from "../utils/common"
import { AudioAnalyser } from "./audioAnalyser"
import { AudioRoutingManager } from "./routing/audioRoutingManager"

import { getRecordingFileName } from "../components/drawer/live/recorder"

const activeRecorders: { [channelId: string]: { recorder: MediaRecorder; stream: MediaStream; onstopPromise: Promise<void> } } = {}
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

    const onstopPromise = new Promise<void>((resolve) => {
        recorder.onstop = async () => {
            newToast("toast.recording_stopped")
            const blob = new Blob(chunks, options)
            const arraybuffer = await blob.arrayBuffer()

            const name = getRecordingFileName(label)
            const customPath = get(special)?.audioRecordingsPath
            sendMain(Main.RECORDER, { blob: arraybuffer, name, path: customPath })

            streamDest.stream.getTracks().forEach((track) => track.stop())
            AudioRoutingManager.getInstance().unregisterChannelRecorder(channelId, streamDest)

            resolve()
        }
    })

    recorder.start()
    activeRecorders[channelId] = { recorder, stream: streamDest.stream, onstopPromise }
    recordingChannels.update((a) => ({ ...a, [channelId]: true }))
    newToast("toast.recording_started")
}

export function stopChannelRecording(channelId: string): Promise<void> {
    const active = activeRecorders[channelId]
    if (!active) return Promise.resolve()

    delete activeRecorders[channelId]
    recordingChannels.update((a) => {
        delete a[channelId]
        return a
    })

    if (active.recorder.state !== "inactive") active.recorder.stop()
    return active.onstopPromise
}

export function isChannelRecording(channelId = "main") {
    return !!activeRecorders[channelId]
}

export async function stopAllChannelRecordings(): Promise<void> {
    const promises = Object.keys(activeRecorders).map((channelId) => stopChannelRecording(channelId))
    await Promise.all(promises)
}
