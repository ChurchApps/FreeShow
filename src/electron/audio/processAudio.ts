import { OpusEncoder } from "@discordjs/opus"
import { NdiSender } from "../ndi/NdiSender"

// const isStopping = false
const channelCount = 2
const sampleRate = 48000 // Hz

const opusEncoder = new OpusEncoder(sampleRate, channelCount)

export async function processAudio(buffer: Buffer, timeDelay = 0) {
    /*  optionally delay the processing  */
    const offset = timeDelay
    if (offset > 0) await new Promise((resolve) => setTimeout(resolve, offset))
    // if (isStopping) return

    // decode raw OPUS packets into raw PCM/interleaved/signed-int16/little-endian data
    buffer = opusEncoder.decode(buffer)

    NdiSender.sendAudioBufferNDI(buffer, { sampleRate, channelCount })
    // Object.keys(NdiSender.NDI).forEach((id) => {
    //     let sender = NdiSender.NDI[id]
    //     if (!sender?.sendAudio) return

    //     NdiSender.sendAudioBufferNDI(id, buffer, { sampleRate, channelCount })
    // })
}
