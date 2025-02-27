import { NdiSender } from "../ndi/NdiSender"

// const isStopping = false
const channelCount = 2
const sampleRate = 48000 // Hz

let opusEncoder: any = null
try {
    const { OpusEncoder } = require("@discordjs/opus")
    opusEncoder = new OpusEncoder(sampleRate, channelCount)
} catch (err) {
    console.log("OPUS not found!")
}

export async function processAudio(buffer: Buffer, timeDelay = 0) {
    if (!opusEncoder) return

    /*  optionally delay the processing  */
    const offset = timeDelay
    if (offset > 0) await new Promise((resolve) => setTimeout(resolve, offset))
    // if (isStopping) return

    // decode raw OPUS packets into raw PCM/interleaved/signed-int16/little-endian data
    try {
        buffer = opusEncoder.decode(buffer)
    } catch (err) {
        console.log("Could not process audio.")
        return
    }

    NdiSender.sendAudioBufferNDI(buffer, { sampleRate, channelCount })
    // Object.keys(NdiSender.NDI).forEach((id) => {
    //     let sender = NdiSender.NDI[id]
    //     if (!sender?.sendAudio) return

    //     NdiSender.sendAudioBufferNDI(id, buffer, { sampleRate, channelCount })
    // })
}
