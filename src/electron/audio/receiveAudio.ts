import type { Message } from "../../types/Socket"
import { processAudio } from "./processAudio"

let latestIcecastConfig: any = null

export function receiveAudio(_e: Electron.IpcMainEvent, msg: Message) {
    const data = msg.data

    if (msg.channel === "RESET_DECODER") return

    if (msg.channel !== "PCM" && msg.channel !== "CAPTURE") {
        console.error("Unknown AUDIO channel:", msg.channel)
        return
    }

    const input = toAudioBuffer(data?.buffer)
    if (!input || input.length === 0) return

    if (data?.icecast) latestIcecastConfig = data.icecast
    const sampleRate = Number(data?.sampleRate) || 48000
    const targetId = data?.id ? String(data.id) : undefined
    processAudio(input, sampleRate, targetId, latestIcecastConfig)
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
