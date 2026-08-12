import type { OpusEncoder as TOpusEncoder } from "@discordjs/opus"
import { BlackmagicSender } from "../blackmagic/BlackmagicSender"
import { NdiSender } from "../ndi/NdiSender"
import { getServerData, toServer } from "../servers"
import { RtmpStreamer } from "../streaming/RtmpStreamer"
import { WebRtcHost } from "../streaming/WebRtcHost"
import { IcecastSender } from "./IcecastSender"

// const isStopping = false
const channelCount2 = 2
const sampleRate2 = 48000 // Hz

let opusEncoder: TOpusEncoder | null = null
try {
    const { OpusEncoder } = require("@discordjs/opus")
    opusEncoder = new OpusEncoder(sampleRate2, channelCount2)
} catch (err) {
    console.error("OPUS not found!")
}

export function isAudioEnabled(): boolean {
    return opusEncoder !== null
}

let icecastPcmAccumulator: Buffer = Buffer.alloc(0)

export async function processAudio(buffer: Buffer, sampleRate: number = 48000, targetId?: any, icecast?: any) {
    if (!buffer || buffer.length === 0) return

    if (typeof targetId === "object" && targetId !== null) {
        icecast = targetId
        targetId = undefined
    }

    const sr = Number(sampleRate) || 48000
    const tid = typeof targetId === "string" ? targetId : undefined

    // Only route to NDI if targetId matches an NDI output ID or is not specified
    if (!tid || Object.keys(NdiSender.NDI).includes(tid)) {
        if (tid) {
            NdiSender.sendAudioBufferNDITarget(tid, buffer, { sampleRate: sr, channelCount: channelCount2 })
        } else {
            NdiSender.sendAudioBufferNDI(buffer, { sampleRate: sr, channelCount: channelCount2 })
        }
    }

    // Convert Planar Float32 to Int16 LE Interleaved PCM for legacy audio sinks
    const int16Buffer = convertPlanarFloat32ToInt16Interleaved(buffer, channelCount2)

    // Only route to Icecast if targetId is "icecast" or not specified
    if (icecast && opusEncoder && (!tid || tid === "icecast")) {
        try {
            icecastPcmAccumulator = Buffer.concat([icecastPcmAccumulator, int16Buffer])
            const frameByteSize = 960 * 2 * 2 // 960 samples * 2 channels * 2 bytes/sample = 3840 bytes

            while (icecastPcmAccumulator.length >= frameByteSize) {
                const chunk = icecastPcmAccumulator.subarray(0, frameByteSize)
                icecastPcmAccumulator = icecastPcmAccumulator.subarray(frameByteSize)
                const opusFrame = opusEncoder.encode(chunk)
                IcecastSender.sendAudio(opusFrame, icecast)
            }
        } catch (err) {
            console.error("Could not encode Opus for Icecast:", err)
        }
    }

    if (!tid || tid !== "icecast") {
        BlackmagicSender.sendAudioBuffer(int16Buffer, { sampleRate: sr, channelCount: channelCount2 })
        sendAudioToOutputServer(int16Buffer, { sampleRate: sr, channelCount: channelCount2 })

        // Stream system audio through WebRTC/WHIP
        if (WebRtcHost.isRunning()) {
            WebRtcHost.sendAudio(int16Buffer, { sampleRate: sr, channelCount: channelCount2 })
        }

        // Stream system audio to RTMP Streamer targeted to specific outputId
        if (RtmpStreamer.anyRunning()) {
            RtmpStreamer.updateAudio(tid, int16Buffer, sr)
        }
    }
}

function convertPlanarFloat32ToInt16Interleaved(buffer: Buffer, channels: number = 2): Buffer {
    const totalFloat32 = Math.floor(buffer.length / 4)
    const samplesPerChannel = Math.floor(totalFloat32 / channels)
    const pcm16 = Buffer.alloc(samplesPerChannel * channels * 2)

    for (let i = 0; i < samplesPerChannel; i++) {
        const floatL = buffer.readFloatLE(i * 4)
        const floatR = buffer.readFloatLE((samplesPerChannel + i) * 4)

        const sL = Math.max(-1, Math.min(1, floatL))
        const intL = sL < 0 ? Math.round(sL * 0x8000) : Math.round(sL * 0x7fff)
        pcm16.writeInt16LE(intL, i * 4)

        const sR = Math.max(-1, Math.min(1, floatR))
        const intR = sR < 0 ? Math.round(sR * 0x8000) : Math.round(sR * 0x7fff)
        pcm16.writeInt16LE(intR, i * 4 + 2)
    }

    return pcm16
}

export function sendAudioToOutputServer(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
    if (!getServerData("OUTPUT_STREAM").sendAudio) return

    toServer("OUTPUT_STREAM", { channel: "AUDIO_BUFFER", data: { buffer, sampleRate, channelCount } })
}
