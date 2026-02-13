// only types are imported at the top level, the actual require is done in the functions in case systems are missing dependencies
import type { LTCDecoder, LTCEncoder } from "libltc-wrapper"
import { Main } from "../../types/IPC/Main"
import { sendMain, sendToMain } from "../IPC/main"
import { processFrame } from "./timecode"
import { isWindows } from ".."
import { ToMain } from "../../types/IPC/ToMain"

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
let decoderFailed = false
export function setupLTCListener(f: number = 25) {
    if (decoderFailed) return null
    framerate = f

    try {
        const { LTCDecoder } = require("libltc-wrapper")
        decoder = new LTCDecoder(sampleRate, framerate, "u8") as LTCDecoder // 48khz, 25 fps, unsigned 8 bit
    } catch (error) {
        console.error("Failed to create LTCDecoder:", error)

        let msg = "Could not initialize LTC Decoder!"
        if (isWindows) msg += "\n\nThis is likely because the required Visual C++ Redistributable is not installed.\nPlease install it from https://aka.ms/vs/17/release/vc_redist.x64.exe"
        sendToMain(ToMain.ALERT, msg)

        decoderFailed = true
        return null
    }

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

let encoderFailed = false
export function sendLTC(timeMs: number, framerate: number) {
    if (encoderFailed) return

    // using default LTC_USE_DATE encoding
    if (!encoder || currentFramerate !== framerate || timeMs < lastTimeMs) {
        try {
            const { LTCEncoder } = require("libltc-wrapper")
            encoder = new LTCEncoder(sampleRate, framerate) as LTCEncoder
        } catch (error) {
            console.error("Failed to create LTCEncoder:", error)

            let msg = "Could not initialize LTC Encoder!"
            if (isWindows) msg += "\n\nThis is likely because the required Visual C++ Redistributable is not installed.\nPlease install it from https://aka.ms/vs/17/release/vc_redist.x64.exe"
            sendToMain(ToMain.ALERT, msg)

            encoderFailed = true
            return
        }

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
