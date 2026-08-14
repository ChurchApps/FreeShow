import type { OpusEncoder as TOpusEncoder } from "@discordjs/opus"
import { BlackmagicSender } from "../blackmagic/BlackmagicSender"
import { NdiSender } from "../ndi/NdiSender"
import { getServerData, toServer } from "../servers"
import { RtmpStreamer } from "../streaming/RtmpStreamer"
import { WebRtcHost } from "../streaming/WebRtcHost"
import { IcecastSender } from "./IcecastSender"

const channelCount2 = 2
const sampleRate2 = 48000 // Hz

let opusEncoder: TOpusEncoder | null = null
try {
    const { OpusEncoder } = require("@discordjs/opus")
    opusEncoder = new OpusEncoder(sampleRate2, channelCount2)
} catch (err) {
    console.error("OPUS not found!")
}

export function isAudioEnabled(): boolean {
    return opusEncoder !== null
}

let icecastPcmAccumulator: Buffer = Buffer.alloc(0)

export async function processAudio(buffer: Buffer, sampleRate: number = 48000, targetId?: string, icecast?: any) {
    if (!buffer || buffer.length === 0) return

    const sr = Number(sampleRate) || 48000
    const tid = typeof targetId === "string" ? targetId : undefined

    // Only route to NDI if targetId matches an NDI output ID or is not specified
    if (!tid || Object.keys(NdiSender.NDI).includes(tid)) {
        if (tid) {
            NdiSender.sendAudioBufferNDITarget(tid, buffer, { sampleRate: sr, channelCount: channelCount2 })
        } else {
            NdiSender.sendAudioBufferNDI(buffer, { sampleRate: sr, channelCount: channelCount2 })
        }
    }

    // Convert Planar Float32 to Int16 LE Interleaved PCM for legacy audio sinks
    const int16Buffer = convertPlanarFloat32ToInt16Interleaved(buffer, channelCount2)

    // Only route to Icecast if targetId is "icecast" or not specified
    if (icecast && opusEncoder && (!tid || tid === "icecast")) {
        try {
            const pcm48k = sr === 48000 ? int16Buffer : resamplePcmInt16Stereo(int16Buffer, sr, 48000)
            const frameByteSize = 960 * 2 * 2 // 3840 bytes

            // Fast-path: Skip accumulator if perfectly sized
            if (icecastPcmAccumulator.length === 0 && pcm48k.length === frameByteSize) {
                const opusFrame = opusEncoder.encode(pcm48k)
                enqueueOpusFrame(opusFrame, icecast)
            } else {
                icecastPcmAccumulator = Buffer.concat([icecastPcmAccumulator, pcm48k])

                while (icecastPcmAccumulator.length >= frameByteSize) {
                    const chunk = icecastPcmAccumulator.subarray(0, frameByteSize)
                    icecastPcmAccumulator = Buffer.from(icecastPcmAccumulator.subarray(frameByteSize))

                    const opusFrame = opusEncoder.encode(chunk)
                    enqueueOpusFrame(opusFrame, icecast)
                }
            }
        } catch (err) {
            console.error("Could not encode Opus for Icecast:", err)
        }
    }

    if (!tid || tid !== "icecast") {
        BlackmagicSender.sendAudioBuffer(int16Buffer, { sampleRate: sr, channelCount: channelCount2 })
        sendAudioToOutputServer(int16Buffer, { sampleRate: sr, channelCount: channelCount2 })

        if (WebRtcHost.isRunning()) {
            WebRtcHost.sendAudio(int16Buffer, { sampleRate: sr, channelCount: channelCount2 })
        }

        if (RtmpStreamer.anyRunning()) {
            RtmpStreamer.updateAudio(tid, int16Buffer, sr)
        }
    }
}

function convertPlanarFloat32ToInt16Interleaved(buffer: Buffer, channels: number = 2): Buffer {
    const totalFloat32 = buffer.length / 4
    const samplesPerChannel = totalFloat32 / channels

    const pcm16 = Buffer.allocUnsafe(samplesPerChannel * channels * 2)

    const floatArr = new Float32Array(buffer.buffer, buffer.byteOffset, totalFloat32)
    const intArr = new Int16Array(pcm16.buffer, pcm16.byteOffset, pcm16.length / 2)

    for (let i = 0; i < samplesPerChannel; i++) {
        const floatL = floatArr[i]
        const floatR = floatArr[samplesPerChannel + i]

        const sL = Math.max(-1, Math.min(1, floatL))
        intArr[i * 2] = sL < 0 ? Math.round(sL * 0x8000) : Math.round(sL * 0x7fff)

        const sR = Math.max(-1, Math.min(1, floatR))
        intArr[i * 2 + 1] = sR < 0 ? Math.round(sR * 0x8000) : Math.round(sR * 0x7fff)
    }

    return pcm16
}

export function sendAudioToOutputServer(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
    if (!getServerData("OUTPUT_STREAM").sendAudio) return

    toServer("OUTPUT_STREAM", { channel: "AUDIO_BUFFER", data: { buffer, sampleRate, channelCount } })
}

let resampleBuffer = Buffer.alloc(1920 * 4)
function resamplePcmInt16Stereo(input: Buffer, inSampleRate: number, outSampleRate: number = 48000): Buffer {
    if (inSampleRate === outSampleRate || !input || input.length === 0) return input

    const numInputFrames = Math.floor(input.length / 4)
    const ratio = inSampleRate / outSampleRate
    const numOutputFrames = Math.floor(numInputFrames / ratio)
    const requiredBytes = numOutputFrames * 4

    if (resampleBuffer.length < requiredBytes) {
        resampleBuffer = Buffer.alloc(requiredBytes)
    }

    for (let i = 0; i < numOutputFrames; i++) {
        const inputIndex = i * ratio
        const index0 = Math.floor(inputIndex)
        const index1 = Math.min(index0 + 1, numInputFrames - 1)
        const frac = inputIndex - index0

        const pos0 = index0 * 4
        const pos1 = index1 * 4

        const l0 = input.readInt16LE(pos0)
        const l1 = input.readInt16LE(pos1)
        const lSample = Math.round(l0 + (l1 - l0) * frac)

        const r0 = input.readInt16LE(pos0 + 2)
        const r1 = input.readInt16LE(pos1 + 2)
        const rSample = Math.round(r0 + (r1 - r0) * frac)

        resampleBuffer.writeInt16LE(Math.max(-32768, Math.min(32767, lSample)), i * 4)
        resampleBuffer.writeInt16LE(Math.max(-32768, Math.min(32767, rSample)), i * 4 + 2)
    }

    return resampleBuffer.subarray(0, requiredBytes)
}

// Pacing state
const opusQueue: Buffer[] = []
let isPacing = false
let nextSendMs = 0

function getHrTimeMs(): number {
    const [sec, nsec] = process.hrtime()
    return sec * 1000 + nsec / 1e6
}

function enqueueOpusFrame(frame: Buffer, icecast: any) {
    opusQueue.push(frame)
    if (!isPacing) {
        isPacing = true
        nextSendMs = getHrTimeMs()
        pacePackets(icecast)
    }
}

function pacePackets(icecast: any) {
    if (opusQueue.length === 0) {
        isPacing = false
        return
    }

    // Drop oldest frames if backed up over 1s (50 x 20ms frames)
    if (opusQueue.length > 50) {
        opusQueue.splice(0, opusQueue.length - 10)
        nextSendMs = getHrTimeMs()
    }

    const nowMs = getHrTimeMs()

    if (nowMs > nextSendMs + 500) {
        nextSendMs = nowMs
    }

    while (opusQueue.length > 0 && getHrTimeMs() >= nextSendMs) {
        const frame = opusQueue.shift()!
        IcecastSender.sendAudio(frame, icecast)
        nextSendMs += 20
    }

    const delayMs = Math.max(0, nextSendMs - getHrTimeMs())

    // High-precision scheduling
    if (delayMs <= 2) {
        setImmediate(() => pacePackets(icecast))
    } else {
        setTimeout(() => pacePackets(icecast), delayMs)
    }
}
