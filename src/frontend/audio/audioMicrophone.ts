import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { sendMain } from "../IPC/main"
import { outLocked } from "../stores"
import { AudioAnalyser } from "./audioAnalyser"
import { AudioInputCapture } from "./routing/audioInputCapture"
import { AudioPlayer } from "./audioPlayer"

type AudioMetadata = {
    name: string
}
type AudioOptions = {
    pauseIfPlaying?: boolean
}

interface AudioMicrophoneListener {
    stream: MediaStream
    source: MediaStreamAudioSourceNode
}

export class AudioMicrophone {
    static volumes: { [deviceId: string]: number } = {}
    private static activeListeners: { [deviceId: string]: AudioMicrophoneListener } = {}

    static start(deviceId: string, metadata: AudioMetadata, options: AudioOptions = {}) {
        if (get(outLocked)) return

        const id = "mic_sub_" + deviceId
        if (AudioPlayer.audioExists(id)) {
            if (options.pauseIfPlaying) AudioPlayer.stop(id)
            return
        }

        navigator.mediaDevices
            .getUserMedia({ audio: { deviceId: { exact: deviceId }, echoCancellation: false } })
            .then((stream) => {
                AudioPlayer.playStream(id, stream, metadata)
            })
            .catch((err) => {
                console.error(err)
                if (err.name === "NotReadableError") {
                    sendMain(Main.ACCESS_MICROPHONE_PERMISSION)
                }
            })
    }

    static stop(id: string) {
        AudioPlayer.stop(id)
    }

    static startListening(deviceId: string) {
        if (this.activeListeners[deviceId]) return

        navigator.mediaDevices
            .getUserMedia({ audio: { deviceId: { exact: deviceId } } })
            .then((stream) => {
                const ac = AudioAnalyser.getAudioContext()
                const source = ac.createMediaStreamSource(stream)
                this.activeListeners[deviceId] = { stream, source }

                // Capture for visualizer but don't connect to destination
                AudioInputCapture.getInstance().captureInput("mic_sub_" + deviceId, source)
            })
            .catch((err) => {
                console.error("Could not start microphone listener:", err)
            })
    }

    static getVolume(deviceId: string): number {
        const id = deviceId.startsWith("mic_sub_") ? deviceId : "mic_sub_" + deviceId
        const data = AudioInputCapture.getInstance().getVisualizerData(id)
        if (data && typeof data.db === "number") return data.db
        if (data && data.channels?.[0]) return data.channels[0].db
        return -60
    }

    static async getList() {
        return navigator.mediaDevices.enumerateDevices().then((devices) => {
            return devices?.filter((device) => device.kind === "audioinput" && device.deviceId !== "default")
        })
    }
}
