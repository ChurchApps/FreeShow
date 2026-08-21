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

    const normalizedIcecast = icecast && icecast.enabled !== false ? icecast : null
    const needsIcecast = !!(normalizedIcecast && opusEncoder && (!tid || tid === "icecast"))
    const needsLegacySinks = (!tid || tid !== "icecast") && (Object.keys(BlackmagicSender.playbackData || {}).length > 0 || !!getServerData("OUTPUT_STREAM")?.sendAudio || WebRtcHost.isRunning() || RtmpStreamer.anyRunning())

    if (!needsIcecast && !needsLegacySinks) return

    // Convert Planar Float32 to Int16 LE Interleaved PCM for legacy audio sinks
    const int16Buffer = convertPlanarFloat32ToInt16Interleaved(buffer, channelCount2)

    // Only route to Icecast if targetId is "icecast" or not specified
    if (needsIcecast) {
        try {
            const pcm48k = sr === 48000 ? int16Buffer : resamplePcmInt16Stereo(int16Buffer, sr, 48000)
            const frameByteSize = 960 * 2 * 2 // 3840 bytes (20ms at 48kHz stereo 16-bit)

            // Fast-path: Skip accumulator if perfectly sized
            if (icecastPcmAccumulator.length === 0 && pcm48k.length === frameByteSize) {
                const opusFrame = opusEncoder!.encode(pcm48k)
                IcecastSender.sendAudio(opusFrame, normalizedIcecast)
            } else {
                icecastPcmAccumulator = Buffer.concat([icecastPcmAccumulator, pcm48k])

                while (icecastPcmAccumulator.length >= frameByteSize) {
                    const chunk = icecastPcmAccumulator.subarray(0, frameByteSize)
                    icecastPcmAccumulator = Buffer.from(icecastPcmAccumulator.subarray(frameByteSize))

                    const opusFrame = opusEncoder!.encode(chunk)
                    IcecastSender.sendAudio(opusFrame, normalizedIcecast)
                }
            }
        } catch (err) {
            console.error("Could not encode Opus for Icecast:", err)
        }
    }

    if (needsLegacySinks) {
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
    const totalFloat32 = Math.floor(buffer.length / 4)
    const samplesPerChannel = Math.floor(totalFloat32 / channels)

    const pcm16 = Buffer.allocUnsafe(samplesPerChannel * channels * 2)
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)

    for (let i = 0; i < samplesPerChannel; i++) {
        const floatL = view.getFloat32(i * 4, true)
        const floatR = view.getFloat32((samplesPerChannel + i) * 4, true)

        const sL = Math.max(-1, Math.min(1, Number.isFinite(floatL) ? floatL : 0))
        pcm16.writeInt16LE(sL < 0 ? Math.round(sL * 0x8000) : Math.round(sL * 0x7fff), i * 4)

        const sR = Math.max(-1, Math.min(1, Number.isFinite(floatR) ? floatR : 0))
        pcm16.writeInt16LE(sR < 0 ? Math.round(sR * 0x8000) : Math.round(sR * 0x7fff), i * 4 + 2)
    }

    return pcm16
}

export function sendAudioToOutputServer(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
    if (!getServerData("OUTPUT_STREAM").sendAudio) return

    toServer("OUTPUT_STREAM", { channel: "AUDIO_BUFFER", data: { buffer, sampleRate, channelCount } })
}

interface ResampleState {
    prevL: number
    prevR: number
    phase: number
    inSampleRate: number
}
let resampleState: ResampleState | null = null

function resamplePcmInt16Stereo(input: Buffer, inSampleRate: number, outSampleRate: number = 48000): Buffer {
    if (inSampleRate === outSampleRate || !input || input.length === 0) return input

    if (!resampleState || resampleState.inSampleRate !== inSampleRate) {
        resampleState = { prevL: 0, prevR: 0, phase: 0, inSampleRate }
    }

    const numInputFrames = Math.floor(input.length / 4)
    if (numInputFrames === 0) return Buffer.alloc(0)

    const ratio = inSampleRate / outSampleRate // e.g. 44100 / 48000 = 0.91875
    let currentPhase = resampleState.phase

    const estimatedOutputFrames = Math.ceil((numInputFrames - currentPhase) / ratio) + 2
    const outBuf = Buffer.allocUnsafe(estimatedOutputFrames * 4)
    let outFrameCount = 0

    while (currentPhase < numInputFrames) {
        const index0 = Math.floor(currentPhase)
        const frac = currentPhase - index0

        let l0: number
        let r0: number
        let l1: number
        let r1: number

        if (index0 === 0 && currentPhase < 1) {
            l0 = resampleState.prevL
            r0 = resampleState.prevR
            l1 = input.readInt16LE(0)
            r1 = input.readInt16LE(2)
        } else {
            const pos0 = index0 * 4
            l0 = input.readInt16LE(pos0)
            r0 = input.readInt16LE(pos0 + 2)

            if (index0 + 1 < numInputFrames) {
                const pos1 = (index0 + 1) * 4
                l1 = input.readInt16LE(pos1)
                r1 = input.readInt16LE(pos1 + 2)
            } else {
                l1 = l0
                r1 = r0
            }
        }

        const lSample = Math.round(l0 + (l1 - l0) * frac)
        const rSample = Math.round(r0 + (r1 - r0) * frac)

        const clampedL = Math.max(-32768, Math.min(32767, lSample))
        const clampedR = Math.max(-32768, Math.min(32767, rSample))

        outBuf.writeInt16LE(clampedL, outFrameCount * 4)
        outBuf.writeInt16LE(clampedR, outFrameCount * 4 + 2)
        outFrameCount++

        currentPhase += ratio
    }

    resampleState.prevL = input.readInt16LE((numInputFrames - 1) * 4)
    resampleState.prevR = input.readInt16LE((numInputFrames - 1) * 4 + 2)
    resampleState.phase = currentPhase - numInputFrames

    return outBuf.subarray(0, outFrameCount * 4)
}
