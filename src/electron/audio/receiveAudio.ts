import type { Message } from "../../types/Socket"
import { processAudio } from "./processAudio"

export async function receiveAudio(_e: any, msg: Message) {
    switch (msg.channel) {
        case "CAPTURE":
            processAudio(msg.data)
            break
        default:
            console.log("Unknown AUDIO channel:", msg.channel)
            break
    }
}
