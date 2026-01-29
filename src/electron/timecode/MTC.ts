import JZZ from "jzz"
import { processFrame, updateTimecodeStatus } from "./timecode"

// RECEIVING

export async function setupMTCListener(_f: number = 25, data: any) {
    const port = await JZZ().openMidiIn(data.midiInput).or("Cannot open MIDI In")
    if (port.name()) console.info("Opened MIDI listener")

    let mtc = new Array(8).fill(0)
    let midiClockTime = 0
    let lastTickTime = 0

    await port.connect((msg: any) => {
        // Quarter Frame (MTC)
        if (msg[0] === 0xf1) {
            const data = msg[1]
            const type = (data >> 4) & 0x07
            const value = data & 0x0f

            mtc[type] = value

            if (type !== 7) return

            const frames = (mtc[1] << 4) | mtc[0]
            const seconds = (mtc[3] << 4) | mtc[2]
            const minutes = (mtc[5] << 4) | mtc[4]
            const hours = ((mtc[7] & 0x01) << 4) | mtc[6]

            const fpsCode = (mtc[7] >> 1) & 0x03
            const fps = [24, 25, 29.97, 30][fpsCode]

            const timeMs = (hours * 3600 + minutes * 60 + seconds + frames / fps) * 1000
            processFrame(timeMs)
            midiClockTime = timeMs
            updateTimecodeStatus("play")
        }
        // Full Frame (SysEx)
        else if (msg[0] === 0xf0 && msg[1] === 0x7f && msg[3] === 0x01 && msg[4] === 0x01) {
            const hoursByte = msg[5]
            const minutes = msg[6]
            const seconds = msg[7]
            const frames = msg[8]

            const hours = hoursByte & 0x1f
            const fpsCode = (hoursByte >> 5) & 0x03
            const fps = [24, 25, 29.97, 30][fpsCode] || 25

            const timeMs = (hours * 3600 + minutes * 60 + seconds + frames / fps) * 1000
            processFrame(timeMs)
            midiClockTime = timeMs

            // Update internal mtc buffer to match current full frame
            mtc[0] = frames & 0x0f
            mtc[1] = (frames >> 4) & 0x01
            mtc[2] = seconds & 0x0f
            mtc[3] = (seconds >> 4) & 0x03
            mtc[4] = minutes & 0x0f
            mtc[5] = (minutes >> 4) & 0x03
            mtc[6] = hours & 0x0f
            mtc[7] = ((hours >> 4) & 0x01) | (fpsCode << 1)
        }
        // Song Position Pointer (SPP)
        // Note: SPP is based on 16th notes/beats, not time.
        // We assume 120 BPM if not specified, which might causes inaccuracies if the source is different.
        else if (msg[0] === 0xf2) {
            const lsb = msg[1]
            const msb = msg[2]
            const sixteenths = (msb << 7) | lsb
            const bpm = 120

            const timeMs = (sixteenths / bpm) * 15000
            processFrame(timeMs)
            midiClockTime = timeMs
            lastTickTime = 0
        }
        // MIDI Start
        else if (msg[0] === 0xfa) {
            // midiClockTime = 0 // Don't reset time, in case SPP was sent just before
            processFrame(midiClockTime)
            lastTickTime = Date.now()
            updateTimecodeStatus("play")
        }
        // MIDI Continue
        else if (msg[0] === 0xfb) {
            lastTickTime = Date.now()
            updateTimecodeStatus("play")
        }
        // MIDI Stop
        else if (msg[0] === 0xfc) {
            // console.log("MIDI Stop")
            lastTickTime = 0
            updateTimecodeStatus("pause")
        }
        // MIDI Timing Clock
        else if (msg[0] === 0xf8) {
            const now = Date.now()
            if (lastTickTime > 0) {
                const delta = now - lastTickTime
                // Sanity check for delta (e.g. if paused for a long time without stop)
                if (delta < 500) {
                    midiClockTime += delta
                    processFrame(midiClockTime)
                }
            }
            lastTickTime = now
            updateTimecodeStatus("play")
        }
    })

    return {
        stop: () => {
            port.close()
        }
    }
}

// SENDING

let sendPort: any = null
export async function sendMTC(timeMs: number, framerate: number, data: any) {
    const hours = Math.floor((timeMs / (1000 * 60 * 60)) % 24)
    const minutes = Math.floor((timeMs / (1000 * 60)) % 60)
    const seconds = Math.floor((timeMs / 1000) % 60)
    const frames = Math.floor(((timeMs % 1000) / 1000) * framerate)

    if (!sendPort) {
        sendPort = await JZZ().openMidiOut(data.midiOutput).or("Cannot open MIDI Out")
        if (sendPort.name()) console.info("Opened MIDI sender")
    }
    if (!sendPort) return

    const fpsCode = { 24: 0, 25: 1, 29.97: 2, 30: 3 }[framerate] || 1

    const mtcData = [frames & 0x0f, (frames >> 4) & 0x01, seconds & 0x0f, (seconds >> 4) & 0x03, minutes & 0x0f, (minutes >> 4) & 0x03, hours & 0x0f, ((hours >> 4) & 0x01) | (fpsCode << 1)]

    mtcData.forEach((value, type) => {
        sendPort.send([0xf1, (type << 4) | value])
    })
}

export function stopSendMTC() {
    if (sendPort) {
        sendPort.close()
        sendPort = null
    }
}
