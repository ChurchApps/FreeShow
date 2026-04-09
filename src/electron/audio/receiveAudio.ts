import { type Block, Decoder, type StateAndTagData } from "ebml"
import type { Message } from "../../types/Socket"
import { processAudio } from "./processAudio"

// let channelCount = 2
// let sampleRate = 48000 // Hz
// let audioDelay = 0

export function receiveAudio(_e: Electron.IpcMainEvent, msg: Message) {
    if (msg.channel !== "CAPTURE") {
        console.error("Unknown AUDIO channel:", msg.channel)
        return
    }

    const data = msg.data
    const input = toAudioBuffer(data?.buffer)
    if (!input) {
        console.error("Received invalid audio data")
        return
    }
    if (input.length === 0) {
        console.error("Received audio buffer with invalid length")
        return
    }

    // if (msg.data.channels) channelCount = msg.data.channels
    // if (msg.data.sampleRate) sampleRate = msg.data.sampleRate
    // if (msg.data.audioDelay) audioDelay = msg.data.audioDelay

    const decoder = createDecoder(data.id || "main")
    try {
        decoder.write(input)
    } catch (error) {
        console.error("Failed to decode incoming audio chunk", error)
    }
}

function toAudioBuffer(value: unknown): Buffer | null {
    if (!value) return null
    if (Buffer.isBuffer(value)) return value
    if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
    if (value instanceof ArrayBuffer) return Buffer.from(value)
    if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength)

    const serialized = value as { type?: unknown; data?: unknown }
    if (serialized?.type === "Buffer" && Array.isArray(serialized.data)) {
        return Buffer.from(serialized.data as number[])
    }

    return null
}

const ebmlDecoders = new Map<string, Decoder>()
let previousDataId = ""
let newIdTimeout: NodeJS.Timeout | null = null
let timeoutId = ""
function createDecoder(id: string) {
    const existing = ebmlDecoders.get(id)
    if (existing) return existing
    previousDataId = id

    const decoder = new Decoder()
    ebmlDecoders.set(id, decoder)

    decoder.on("data", ([blockType, data]: StateAndTagData) => {
        if (timeoutId === id) return
        if (blockType !== "tag" || data.name !== "SimpleBlock" || data.type !== "b") return

        const block = data as Block
        if (!block.payload || (timeoutId && countUniqueBytes(block.payload) < 4)) return

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
        processAudio(block.payload)
    })

    return decoder
}

function countUniqueBytes(payload: Uint8Array): number {
    const seen = new Uint8Array(256)
    let count = 0
    for (let i = 0; i < payload.length; i++) {
        const b = payload[i]
        if (!seen[b]) {
            seen[b] = 1
            if (++count >= 4) return count
        }
    }
    return count
}
