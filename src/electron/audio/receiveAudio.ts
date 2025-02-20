import type { Message } from "../../types/Socket"
import { processAudio } from "./processAudio"
import { Decoder } from "ebml"

let audioDelay = 0

const ebmlDecoder = new Decoder()
try {
    ebmlDecoder.on("data", ([blockType, data]: any) => {
        if (blockType === "tag" && data.name === "SimpleBlock" && data.type === "b") {
            processAudio(data.payload, audioDelay)
        }
    })
} catch (err) {
    console.error("Error when processing audio:", err)
}

export async function receiveAudio(_e: any, msg: Message) {
    switch (msg.channel) {
        case "CAPTURE":
            if (!msg.data?.buffer) {
                console.error("Received invalid audio data")
                return
            }

            audioDelay = msg.data.audioDelay || 0
            ebmlDecoder.write(Buffer.from(msg.data.buffer))
            break
        default:
            console.log("Unknown AUDIO channel:", msg.channel)
            break
    }
}
