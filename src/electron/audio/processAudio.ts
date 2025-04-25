import type { OpusEncoder as TOpusEncoder } from "@discordjs/opus"
import { NdiSender } from "../ndi/NdiSender"
import { getServerData, toServer } from "../servers"

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

// , { audioDelay }
export function processAudio(buffer: Buffer) {
    if (!opusEncoder) return

    // const offset = audioDelay
    // if (offset > 0) await new Promise((resolve) => setTimeout(resolve, offset))
    // if (isStopping) return

    // decode raw OPUS packets into raw PCM/interleaved/signed-int16/little-endian data
    try {
        buffer = opusEncoder.decode(buffer)
    } catch (err) {
        console.error("Could not process audio.")
        return
    }

    NdiSender.sendAudioBufferNDI(buffer, { sampleRate: sampleRate2, channelCount: channelCount2 })
    sendAudioToOutputServer(buffer, { sampleRate: sampleRate2, channelCount: channelCount2 })
}

export function sendAudioToOutputServer(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
    if (!getServerData("OUTPUT_STREAM").sendAudio) return

    toServer("OUTPUT_STREAM", { channel: "AUDIO_BUFFER", data: { buffer, sampleRate, channelCount } })
}
