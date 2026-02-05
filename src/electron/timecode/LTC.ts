import { LTCDecoder, LTCEncoder } from "libltc-wrapper"
import { Main } from "../../types/IPC/Main"
import { sendMain } from "../IPC/main"
import { processFrame } from "./timecode"

// RECEIVER

export function feedLTCFrame(audioframes: Buffer) {
    if (!decoder) return

    decoder.write(audioframes)

    const frame = decoder.read()
    if (frame !== undefined) {
        const time = frame.hours * 3600 + frame.minutes * 60 + frame.seconds + frame.frames / framerate
        processFrame(time * 1000)
    }
}

let decoder: LTCDecoder | null = null

let framerate = 25
const sampleRate = 48000
export function setupLTCListener(f: number = 25) {
    framerate = f

    decoder = new LTCDecoder(sampleRate, framerate, "u8") // 48khz, 25 fps, unsigned 8 bit

    return {
        stop: () => {
            decoder = null
        }
    }
}

// SENDER

let encoder: LTCEncoder | null = null
let currentFramerate: number | null = null
let lastTimeMs = -1

// WIP can't send frames past sent time

export function sendLTC(timeMs: number, framerate: number) {
    // using default LTC_USE_DATE encoding
    if (!encoder || currentFramerate !== framerate || timeMs < lastTimeMs) {
        encoder = new LTCEncoder(sampleRate, framerate)
        currentFramerate = framerate
    }
    lastTimeMs = timeMs

    const hours = Math.floor((timeMs / (1000 * 60 * 60)) % 24)
    const minutes = Math.floor((timeMs / (1000 * 60)) % 60)
    const seconds = Math.floor((timeMs / 1000) % 60)
    const frames = Math.floor(((timeMs % 1000) / 1000) * framerate)

    encoder.setTimecode({ hours, minutes, seconds, frames })

    // encoder.incrementTimecode();

    // Get 1 frame worth of LTC audio (48khz 25fps would be 40ms audio)
    encoder.encodeFrame()

    const buffer = encoder.getBuffer()
    sendMain(Main.TIMECODE_AUDIO_DATA, buffer)
}

export function stopSendLTC() {
    encoder = null
}
