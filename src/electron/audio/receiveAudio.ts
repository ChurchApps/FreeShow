import type { Message } from "../../types/Socket"
import { processAudio } from "./processAudio"
import { Decoder } from "ebml"

let audioDelay = 0

export async function receiveAudio(_e: any, msg: Message) {
    switch (msg.channel) {
        case "CAPTURE":
            if (!msg.data?.buffer) {
                console.error("Received invalid audio data")
                return
            }

            audioDelay = msg.data.audioDelay || 0
            const decoder = createDecoder(msg.data.id)
            decoder.write(Buffer.from(msg.data.buffer))
            break
        default:
            console.log("Unknown AUDIO channel:", msg.channel)
            break
    }
}

const ebmlDecoders: { [key: string]: Decoder } = {}
let previousDataId = ""
let newIdTimeout: any = null
function createDecoder(id: string) {
    if (ebmlDecoders[id]) return ebmlDecoders[id]
    previousDataId = id

    ebmlDecoders[id] = new Decoder()
    try {
        ebmlDecoders[id].on("data", ([blockType, data]: any) => {
            if (blockType === "tag" && data.name === "SimpleBlock" && data.type === "b") {
                // WIP audio from both video (output) and main does not combine well
                // this will ensure only one "input" is allowed at once
                if (newIdTimeout) clearTimeout(newIdTimeout)
                newIdTimeout = setTimeout(() => (previousDataId = id), 1000)
                if (previousDataId !== id) return

                processAudio(data.payload, audioDelay)
            }
        })
    } catch (err) {
        console.error("Error when processing audio:", err)
    }

    return ebmlDecoders[id]
}
