import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { sendMain } from "../IPC/main"
import { outLocked } from "../stores"
import { AudioPlayer } from "./audioPlayer"

type AudioMetadata = {
    name: string
}
type AudioOptions = {
    pauseIfPlaying?: boolean
}

export class AudioMicrophone {
    static activeListeners: {
        [deviceId: string]: {
            stream: MediaStream
            context: AudioContext
            analyser: AnalyserNode
        }
    } = {}
    static volumes: { [deviceId: string]: number } = {}

    static start(id: string, metadata: AudioMetadata, options: AudioOptions = {}) {
        if (get(outLocked)) return

        if (AudioPlayer.audioExists(id)) {
            if (options.pauseIfPlaying) AudioPlayer.stop(id)
            return
        }

        navigator.mediaDevices
            .getUserMedia({ audio: { deviceId: { exact: id }, echoCancellation: false } })
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

    static async getList() {
        return navigator.mediaDevices.enumerateDevices().then((devices) => {
            return devices?.filter((device) => device.kind === "audioinput")
        })
    }

    static startListening(deviceId: string) {
        if (this.activeListeners[deviceId]) return

        navigator.mediaDevices
            .getUserMedia({ audio: { deviceId: { exact: deviceId } } })
            .then((stream) => {
                const context = new AudioContext()
                const source = context.createMediaStreamSource(stream)
                const analyser = context.createAnalyser()
                analyser.fftSize = 256
                source.connect(analyser)

                this.activeListeners[deviceId] = {
                    stream,
                    context,
                    analyser
                }
            })
            .catch((err) => {
                console.error("Error starting mic listener:", err)
            })
    }

    static getVolume(deviceId: string): number {
        if (this.volumes[deviceId] !== undefined) return this.volumes[deviceId]

        const listener = this.activeListeners[deviceId]
        if (!listener) return -80

        const array = new Uint8Array(listener.analyser.fftSize)
        listener.analyser.getByteTimeDomainData(array)
        let sumOfSquares = 0
        const len = array.length
        for (let i = 0; i < len; i++) {
            const normalizedValue = (array[i] - 128) / 128
            sumOfSquares += normalizedValue * normalizedValue
        }
        const rms = Math.sqrt(sumOfSquares / len)
        const dB = 20 * Math.log10(rms || 0.0001)
        return Math.round(dB)
    }
}
