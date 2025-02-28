import { Decoder } from "ebml"
import type { Message } from "../../types/Socket"
import { processAudio } from "./processAudio"

// let channelCount = 2
// let sampleRate = 48000 // Hz
// let audioDelay = 0

export async function receiveAudio(_e: any, msg: Message) {
    switch (msg.channel) {
        case "CAPTURE":
            if (!msg.data?.buffer) {
                console.error("Received invalid audio data")
                return
            }

            // if (msg.data.channels) channelCount = msg.data.channels
            // if (msg.data.sampleRate) sampleRate = msg.data.sampleRate
            // if (msg.data.audioDelay) audioDelay = msg.data.audioDelay

            const decoder = createDecoder(msg.data.id)
            decoder.write(Buffer.from(msg.data.buffer))
            break
        default:
            console.log("Unknown AUDIO channel:", msg.channel)
            break
    }
}

const ebmlDecoders = new Map<string, Decoder>()
let previousDataId = ""
let newIdTimeout: any = null
let timeoutId: string = ""
function createDecoder(id: string) {
    if (ebmlDecoders.has(id)) return ebmlDecoders.get(id)!
    previousDataId = id

    const decoder = new Decoder()
    ebmlDecoders.set(id, decoder)

    decoder.on("data", ([blockType, data]: any) => {
        if (timeoutId === id) return
        if (blockType !== "tag" || data.name !== "SimpleBlock" || data.type !== "b" || !data.payload) return
        if (timeoutId && new Set(data.payload).size < 4) return

        // audio from both video (output) and main does not combine well
        // this will ensure only one "input" is allowed at once
        if (newIdTimeout) {
            timeoutId = ""
            clearTimeout(newIdTimeout)
        }
        if (previousDataId !== id) {
            timeoutId = id
            newIdTimeout = setTimeout(() => {
                timeoutId = ""
                previousDataId = id
            }, 100)
            return
        }

        // { channelCount, sampleRate, audioDelay }
        processAudio(data.payload)
    })

    return decoder
}
