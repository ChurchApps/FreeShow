import { get } from "svelte/store"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../IPC/main"
import { timecode } from "../../stores"
import ltcProcessorUrl from "./ltcProcessor.ts?worker&url"
import { getActiveTimelinePlayback } from "./TimelinePlayback"

export function updateTimelineTime(timeMs: number) {
    const active = getActiveTimelinePlayback()
    if (!active) return

    active.setTime(timeMs)
}

export function updateTimelineStatus(status: "play" | "pause" | "stop") {
    const active = getActiveTimelinePlayback()
    if (!active) return

    if (status === "play") active.play(true)
    else if (status === "pause") active.pause(true)
    else if (status === "stop") active.pause(true)
}

let ltcContext: AudioContext | null = null
function getLTCContext(): AudioContext {
    if (ltcContext) return ltcContext
    ltcContext = new AudioContext()
    return ltcContext
}

export function processTimecodeFrame(buffer: Buffer) {
    const mode = get(timecode).mode || "LTC"
    if (mode === "LTC") processLTCFrame(buffer)
}

// buffer = Uint8Array(1920)
async function processLTCFrame(buffer: Buffer) {
    const audioOutput = get(timecode).audioOutput
    if (!audioOutput) return

    if (!buffer || buffer.length === 0) return

    try {
        const ctx = getLTCContext()

        if ((ctx as any).setSinkId && (ctx as any).sinkId !== audioOutput) {
            ;(ctx as any).setSinkId(audioOutput).catch((e: unknown) => console.warn("Failed to set LTC audio output:", e))
        }

        if (ctx.state === "suspended") await ctx.resume()

        // Create an AudioBuffer (Mono, 1 frame length, 48kHz)
        // 1920 samples @ 48kHz is exactly 1 frame at 25fps
        const audioBuffer = ctx.createBuffer(1, buffer.length, 48000)
        const channelData = audioBuffer.getChannelData(0)

        // Convert Uint8 (0-255) to Float32 (-1.0 to 1.0)
        for (let i = 0; i < buffer.length; i++) {
            channelData[i] = (buffer[i] - 128) / 128.0
        }

        const source = ctx.createBufferSource()
        source.buffer = audioBuffer

        source.connect(ctx.destination)
        source.start()
    } catch (err) {
        console.log("Could not create audio frame:", err)
    }
}

let listenerStream: MediaStream | null = null
let listenerCtx: AudioContext | null = null
let listenerNode: AudioWorkletNode | null = null

export async function stopListeningLTC() {
    if (listenerStream) {
        listenerStream.getTracks().forEach((t) => t.stop())
        listenerStream = null
    }
    if (listenerCtx) {
        listenerCtx.close()
        listenerCtx = null
    }
}

export async function startListeningLTC() {
    await stopListeningLTC()
    const deviceId = get(timecode).audioInput
    if (!deviceId) return

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: { exact: deviceId },
                autoGainControl: false,
                echoCancellation: false,
                noiseSuppression: false,
                channelCount: 1,
                sampleRate: 48000
            }
        })
        listenerStream = stream

        listenerCtx = new AudioContext({ sampleRate: 48000 })
        const source = listenerCtx.createMediaStreamSource(stream)

        await listenerCtx.audioWorklet.addModule(ltcProcessorUrl)

        listenerNode = new AudioWorkletNode(listenerCtx, "ltc-processor")
        listenerNode.port.onmessage = (e) => {
            sendMain(Main.TIMECODE_AUDIO_DATA, e.data)
        }

        source.connect(listenerNode)
        listenerNode.connect(listenerCtx.destination) // needed for chrome to keep the node alive
    } catch (err) {
        console.error("Failed to start LTC listener:", err)
    }
}
