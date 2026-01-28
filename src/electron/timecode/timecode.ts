import { Main } from "../../types/IPC/Main"
import { sendMain } from "../IPC/main"
import { feedLTCFrame, sendLTC, setupLTCListener, stopSendLTC } from "./LTC"

export type TimecodeMode = "LTC" | "MTC" | "ableton"
interface Receiver {
    listener: {
        stop: () => void
    }
}

let framerate = 25
export function timecodeStart(data: { type: "send" | "receive"; mode: TimecodeMode; framerate?: number; data?: any }) {
    if (data.framerate) framerate = data.framerate
    if (data.type === "send") {
        sendTimecode(data.mode)
    } else if (data.type === "receive") {
        receiveTimecode(data.mode)
    }
}

// RECEIVE

export function timecodeStop() {
    stopSendingTimecode()
    stopReceivingTimecode()
}

let timecodeReceivers: { [key in TimecodeMode]?: Receiver } = {}

function receiveTimecode(mode: TimecodeMode) {
    if (timecodeReceivers[mode]) return

    const listener = mode === "LTC" ? setupLTCListener(framerate) : null
    if (!listener) return

    timecodeReceivers[mode] = { listener }
}

function stopReceivingTimecode() {
    Object.values(timecodeReceivers).forEach((receiver) => {
        receiver.listener.stop()
    })
    timecodeReceivers = {}
}

export function processAudioData(data: { mode: TimecodeMode; buffer: Uint8Array }) {
    if (data.mode === "LTC") feedLTCFrame(Buffer.from(data.buffer))
}

export function processFrame(timeMs: number) {
    sendMain(Main.TIMECODE_VALUE, timeMs)
}

// SEND

let currentMode: TimecodeMode | null = null
function sendTimecode(mode: TimecodeMode) {
    currentMode = mode
}

function stopSendingTimecode() {
    if (currentMode === "LTC") stopSendLTC()
}

export function updateTimecodeValue(value: number) {
    if (currentMode === "LTC") sendLTC(value, framerate)
}
