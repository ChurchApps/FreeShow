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

export async function processAudio(buffer: Buffer, icecast?: any) {
    if (!opusEncoder) return

    // decode raw OPUS/WebM packets into raw PCM/interleaved/signed-int16/little-endian data
    try {
        buffer = opusEncoder.decode(buffer)
    } catch (err) {
        console.error("Could not process audio.")
        return
    }

    // Encode clean PCM into standard 20ms (960 samples = 3840 bytes) Opus frames for Icecast
    if (icecast) {
        try {
            const frameByteSize = 960 * 2 * 2 // 960 samples * 2 channels * 2 bytes/sample = 3840 bytes
            for (let offset = 0; offset < buffer.length; offset += frameByteSize) {
                const chunk = buffer.subarray(offset, offset + frameByteSize)
                if (chunk.length === frameByteSize) {
                    const opusFrame = opusEncoder.encode(chunk)
                    IcecastSender.sendAudio(opusFrame, icecast)
                }
            }
        } catch (err) {
            console.error("Could not encode Opus for Icecast:", err)
        }
    }

    NdiSender.sendAudioBufferNDI(buffer, { sampleRate: sampleRate2, channelCount: channelCount2 })
    BlackmagicSender.sendAudioBuffer(buffer, { sampleRate: sampleRate2, channelCount: channelCount2 })
    sendAudioToOutputServer(buffer, { sampleRate: sampleRate2, channelCount: channelCount2 })

    // Stream system audio through WebRTC/WHIP
    if (WebRtcHost.isRunning()) {
        WebRtcHost.sendAudio(buffer, { sampleRate: sampleRate2, channelCount: channelCount2 })
    }

    // Stream system audio to RTMP Streamer
    if (RtmpStreamer.anyRunning()) {
        RtmpStreamer.updateAudio(buffer)
    }
}

export function sendAudioToOutputServer(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
    if (!getServerData("OUTPUT_STREAM").sendAudio) return

    toServer("OUTPUT_STREAM", { channel: "AUDIO_BUFFER", data: { buffer, sampleRate, channelCount } })
}
