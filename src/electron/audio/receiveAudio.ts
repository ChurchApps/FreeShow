import { MessageChannelMain } from "electron"
import type { Message } from "../../types/Socket"
import { IcecastSender } from "./IcecastSender"
import { processAudio } from "./processAudio"

let latestIcecastConfig: any = null
const activeAudioPortsByTarget = new Map<string, any>()

export function receiveAudio(_e: Electron.IpcMainEvent, msg: Message) {
    const data = msg.data

    if (msg.channel === "RESET_DECODER") return

    if (msg.channel === "CLOSE_PORT") {
        const targetIdKey = data?.id ? String(data.id) : "default"
        const existingPort = activeAudioPortsByTarget.get(targetIdKey)
        if (existingPort) {
            try {
                existingPort.close()
            } catch {}
            activeAudioPortsByTarget.delete(targetIdKey)
        }

        if (targetIdKey === "icecast") IcecastSender.disconnect()
        return
    }

    if (msg.channel === "INIT_PORT") {
        const targetIdKey = data?.id ? String(data.id) : "default"
        const existingPort = activeAudioPortsByTarget.get(targetIdKey)
        if (existingPort) {
            try {
                existingPort.close()
            } catch {}
            activeAudioPortsByTarget.delete(targetIdKey)
        }

        const { port1, port2 } = new MessageChannelMain()
        activeAudioPortsByTarget.set(targetIdKey, port1)

        port1.on("message", (msgEvent) => {
            const { channel, payload } = msgEvent.data || {}
            if (channel === "AUDIO" && payload) {
                const input = toAudioBuffer(payload.buffer)
                if (!input || input.length === 0) return

                if (payload.icecast) latestIcecastConfig = payload.icecast
                const sampleRate = Number(payload.sampleRate) || 48000
                const targetId = payload.id ? String(payload.id) : undefined
                processAudio(input, sampleRate, targetId, latestIcecastConfig)
            }
        })

        port1.on("close", () => {
            if (activeAudioPortsByTarget.get(targetIdKey) === port1) {
                activeAudioPortsByTarget.delete(targetIdKey)
            }

            if (targetIdKey === "icecast") IcecastSender.disconnect()
        })

        port1.start()

        if (_e.sender && !_e.sender.isDestroyed()) {
            _e.sender.postMessage("AUDIO_PORT", { targetId: data?.id }, [port2])
        }
        return
    }

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
