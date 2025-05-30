/* eslint @typescript-eslint/no-unsafe-call: 0 */

import JZZ from "jzz"
import { sendToMain } from "../IPC/main"
import { ToMain } from "../../types/IPC/ToMain"

// const virtualDevices: any = {}
// export function createVirtualMidi() {
//     virtualDevices.input = new easymidi.Input("FreeShow MIDI Input", true)
//     virtualDevices.output = new easymidi.Output("FreeShow MIDI Output", true)
//     console.log("Created MIDI devices")
// }

// export function closeVirtualMidi() {
//     virtualDevices.input?.close()
//     virtualDevices.output?.close()
// }

type MidiValues = { name: string }[]

// https://jazz-soft.net/doc/JZZ/jzz.html#info
// https://jazz-soft.net/doc/JZZ/midiin.html#info
export function getMidiOutputs(): { name: string }[] {
    return (JZZ().info().outputs as MidiValues).map((a) => ({ name: a.name }))
}

export function getMidiInputs(): { name: string }[] {
    return (JZZ().info().inputs as MidiValues).map((a: any) => ({ name: a.name }))
}

let openedOutputPorts: { [key: string]: any } = {}
export async function sendMidi(data: any) {
    let port: any = null

    if (!data.type) data.type = "noteon"
    if (!data.values) data.values = { note: 0, velocity: 0, channel: 1 }

    // send channel 1 as channel 1, and not 0
    if (data.values.channel) data.values.channel--

    try {
        if (!openedOutputPorts[data.output]) openedOutputPorts[data.output] = await JZZ().openMidiOut(data.output).or("Error sending MIDI signal: Could not connect to receiver!")
        port = openedOutputPorts[data.output]
        if (!port) return

        console.info("SENDING MIDI SIGNAL:", data)
        if (data.type === "noteon") {
            // this might be rendered as note off by some programs if velocity is 0, but that should be fine
            await port.noteOn(data.values.channel, data.values.note, data.values.velocity)
        } else {
            // data.type === "noteoff"
            await port.noteOff(data.values.channel, data.values.note, data.values.velocity)
        }
    } catch (err) {
        console.error(err)
    }

    // closing port caused all 16 channels to send midi off
    // if (!port) return
    // port.close()
}

let openedPorts: { [key: string]: any } = {}
export async function receiveMidi(data: any) {
    // console.log("INPUT", data.input)
    if (!data.input || openedPorts[data.id]) return
    // fix: https://github.com/ChurchApps/FreeShow/issues/1672
    if (data.input === "input") return

    try {
        // connect to the input and listen for notes!
        const port = await JZZ().openMidiIn(data.input).or("Error opening MIDI listener: Device not found or not supported!")
        console.info("LISTENING FOR MIDI SIGNAL:", data)

        if (port.name()) openedPorts[data.id] = port

        await port.connect((msg: any) => {
            if (!msg.toString().includes("Note")) return

            // console.log("CHECK IF NOTE ON/OFF", msg.toString()) // 00 00 00 -- Note Off
            const type: "noteon" | "noteoff" = msg.toString().includes("Off") ? "noteoff" : "noteon"
            const values = { note: msg["1"], velocity: msg["2"], channel: (msg["0"] & 0x0f) + 1 }
            sendToMain(ToMain.RECEIVE_MIDI2, { id: data.id, values, type })
        })
    } catch (err) {
        console.error(err)
    }
}

export function stopMidi() {
    closeMidiInPorts()
    closeMidiOutPorts()
    // closeVirtualMidi()
}

function closeMidiOutPorts() {
    Object.values(openedOutputPorts).forEach((port: any) => {
        port.close()
    })

    openedOutputPorts = {}
}

export function closeMidiInPorts(id = "") {
    if (id && openedPorts[id]) {
        openedPorts[id].close()
        delete openedPorts[id]
        return
    }

    Object.values(openedPorts).forEach((port: any) => {
        port.close()
    })

    openedPorts = {}
}
