import { OpusEncoder } from "@discordjs/opus"
import { NdiSender } from "../ndi/NdiSender"

const ndiEnabled = true
const isStopping = false
const timeDelay = 0
const channelCount = 2
const sampleRate2 = 48 // kHz

// const timeStart = BigInt(Date.now()) * BigInt(1e6) - process.hrtime.bigint()
// function timeNow() {
//     return timeStart + process.hrtime.bigint()
// }

// WIP this is temporary:
const opusEncoder = new OpusEncoder(sampleRate2 * 1000, channelCount)

export async function processAudio(buffer: Buffer) {
    if (!ndiEnabled || isStopping) return

    /*  optionally delay the processing  */
    const offset = timeDelay
    if (offset > 0) await new Promise((resolve) => setTimeout(resolve, offset))
    if (isStopping) return

    /*  start time-keeping  */
    // const t0 = Date.now()

    if (!ndiEnabled) return

    /*  determine frame information  */
    const sampleRate = sampleRate2 * 1000
    const bytesForFloat32 = 4

    /*  decode raw OPUS packets into raw
        PCM/interleaved/signed-int16/little-endian data  */
    buffer = opusEncoder.decode(buffer)

    // WIP send to all enabled NDI outputs
    let outputId = Object.keys(NdiSender.NDI)[0]
    NdiSender.sendAudioBufferNDI(outputId, buffer, { sampleRate, channelCount, bytesForFloat32 })
}
