import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { sendMain } from "../IPC/main"
import { audioRouting, outLocked } from "../stores"
import { AudioAnalyser } from "./audioAnalyser"
import { clearAudio } from "./audioFading"
import { AudioPlayer } from "./audioPlayer"
import { MIN_DB } from "./dBUtils"
import { AudioInputCapture } from "./routing/audioInputCapture"

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
    public static channelCountCache = new Map<string, number>()

    private static getConfiguredChannels(deviceId: string): number | undefined {
        const config = get(audioRouting)
        const micNodeId = `mic_sub_${deviceId}`
        const item = config?.inputs?.find((i) => i.id === micNodeId || i.id === deviceId || i.deviceId === deviceId)
        return item?.channels
    }

    private static async getMediaStream(deviceId: string): Promise<{ stream: MediaStream; channelCount: number }> {
        const configuredCount = this.getConfiguredChannels(deviceId)
        const targetChannels = configuredCount ?? 8

        const baseConstraints = {
            deviceId: { exact: deviceId },
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false
        }

        let stream: MediaStream
        try {
            // Try exact first to force Chromium to open all discrete channels without stereo downmix
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    ...baseConstraints,
                    channelCount: { exact: targetChannels }
                }
            })
        } catch {
            // Fallback to ideal if exact is overconstrained
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    ...baseConstraints,
                    channelCount: { ideal: targetChannels }
                }
            })
        }

        const [track] = stream.getAudioTracks()
        let channelCount = configuredCount || 2
        if (track) {
            const cap = track.getCapabilities ? track.getCapabilities() : null
            const settings = track.getSettings ? track.getSettings() : null
            channelCount = configuredCount || Math.max(1, cap?.channelCount?.max || settings?.channelCount || 2)
            this.channelCountCache.set(deviceId, channelCount)
        }
        return { stream, channelCount }
    }

    static async start(deviceId: string, metadata: AudioMetadata, options: AudioOptions = {}) {
        if (get(outLocked)) return

        const id = "mic_sub_" + deviceId
        if (AudioPlayer.audioExists(id)) {
            if (options.pauseIfPlaying) AudioPlayer.stop(id)
            return
        }

        try {
            const { stream } = await this.getMediaStream(deviceId)
            AudioPlayer.playStream(id, stream, metadata)
        } catch (err: any) {
            console.error(err)
            if (err?.name === "NotReadableError") {
                sendMain(Main.ACCESS_MICROPHONE_PERMISSION)
            }
        }
    }

    static stop(id: string) {
        if (!id) return
        const micId = id.startsWith("mic_sub_") ? id : "mic_sub_" + id
        clearAudio(micId, { clearPlaylist: false, clearMicrophones: true })
        // AudioPlayer.stop(micId)
    }

    static async startListening(deviceId: string) {
        if (this.activeListeners[deviceId]) return

        try {
            const { stream, channelCount } = await this.getMediaStream(deviceId)
            const ac = AudioAnalyser.getAudioContext()
            const source = ac.createMediaStreamSource(stream)
            this.activeListeners[deviceId] = { stream, source }

            // Capture for visualizer but don't connect to destination
            AudioInputCapture.getInstance().captureInput("mic_sub_" + deviceId, source, channelCount)
        } catch (err) {
            console.error("Could not start microphone listener:", err)
        }
    }

    static getVolume(deviceId: string): number {
        const id = deviceId.startsWith("mic_sub_") ? deviceId : "mic_sub_" + deviceId
        const data = AudioInputCapture.getInstance().getVisualizerData(id)
        if (data && typeof data.db === "number") return data.db
        if (data && data.channels?.[0]) return data.channels[0].db
        return MIN_DB
    }

    private static async detectChannelCount(deviceId: string, cap?: any): Promise<number> {
        const configuredCount = this.getConfiguredChannels(deviceId)
        if (configuredCount) {
            this.channelCountCache.set(deviceId, configuredCount)
            return configuredCount
        }
        if (this.channelCountCache.has(deviceId)) {
            return this.channelCountCache.get(deviceId)!
        }
        if (cap?.channelCount?.max) {
            const max = Math.max(1, cap.channelCount.max)
            this.channelCountCache.set(deviceId, max)
            return max
        }
        try {
            const { stream, channelCount } = await this.getMediaStream(deviceId)
            stream.getTracks().forEach((t) => t.stop())
            return channelCount
        } catch {
            return 2
        }
    }

    static setChannelCount(deviceId: string, count: number) {
        this.channelCountCache.set(deviceId, count)
    }

    static async getInputs(): Promise<{ value: string; label: string; channels: number }[]> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            const inputDevices = devices.filter((d) => d.kind === "audioinput" && d.deviceId !== "default")

            return await Promise.all(
                inputDevices.map(async (d, i) => ({
                    value: `mic_sub_${d.deviceId}`,
                    label: d.label || `Microphone ${i + 1}`,
                    channels: await this.detectChannelCount(d.deviceId, (d as any).getCapabilities?.())
                }))
            )
        } catch (err) {
            console.error("Could not enumerate audio inputs:", err)
            return []
        }
    }

    static async getList() {
        return navigator.mediaDevices.enumerateDevices().then((devices) => {
            return devices?.filter((device) => device.kind === "audioinput" && device.deviceId !== "default")
        })
    }
}
