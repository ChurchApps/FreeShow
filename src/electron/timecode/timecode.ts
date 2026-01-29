import { Main } from "../../types/IPC/Main"
import { sendMain } from "../IPC/main"
import { feedLTCFrame, sendLTC, setupLTCListener, stopSendLTC } from "./LTC"
import { sendMTC, setupMTCListener, stopSendMTC } from "./MTC"

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
        sendTimecode(data.mode, data.data)
    } else if (data.type === "receive") {
        receiveTimecode(data.mode, data.data)
    }
}

// RECEIVE

export function timecodeStop() {
    stopSendingTimecode()
    stopReceivingTimecode()
}

let timecodeReceivers: { [key in TimecodeMode]?: Receiver } = {}

async function receiveTimecode(mode: TimecodeMode, data: any) {
    if (timecodeReceivers[mode]) return

    const listener = mode === "LTC" ? setupLTCListener(framerate) : mode === "MTC" ? await setupMTCListener(framerate, data) : null
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

let lastStatus: "play" | "pause" | "stop" | null = null
export function updateTimecodeStatus(status: "play" | "pause" | "stop") {
    if (lastStatus === status) return
    lastStatus = status
    sendMain(Main.TIMECODE_STATUS, status)
}

// SEND

let currentMode: TimecodeMode | null = null
let sendData: any
function sendTimecode(mode: TimecodeMode, data: any) {
    currentMode = mode
    sendData = data
}

function stopSendingTimecode() {
    if (currentMode === "LTC") stopSendLTC()
    else if (currentMode === "MTC") stopSendMTC()
}

export function updateTimecodeValue(value: number) {
    if (currentMode === "LTC") sendLTC(value, framerate)
    else if (currentMode === "MTC") sendMTC(value, framerate, sendData)
}
