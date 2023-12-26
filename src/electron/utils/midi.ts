import JZZ from "jzz"
import { toApp } from ".."

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

// https://jazz-soft.net/doc/JZZ/jzz.html#info
// https://jazz-soft.net/doc/JZZ/midiin.html#info
export function getMidiOutputs() {
    return JZZ()
        .info()
        .outputs.map((a: any) => a.name)
}

export function getMidiInputs() {
    return JZZ()
        .info()
        .inputs.map((a: any) => a.name)
}

export async function sendMidi(data: any) {
    let port: any = null
    // console.log("OUTPUT", data.output)

    try {
        port = await JZZ().openMidiOut(data.output).or("Could not connect to MIDI out!")
        if (!port) return
        if (data.type === "noteon") {
            await port.noteOn(data.values.channel, data.values.note, data.values.velocity)
            // .wait(500).noteOff(data.values.channel, data.values.note)
        } else {
            // data.type === "noteoff"
            await port.noteOff(data.values.channel, data.values.note, data.values.velocity)
        }
    } catch (err) {
        console.error(err)
    }

    if (!port) return
    port.close()
}

let openedPorts: any = {}

export function closeMidiInPorts(id: string = "") {
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

export async function receiveMidi(data: any) {
    // let port: any = null
    // console.log("INPUT", data.input)
    if (!data.input) return
    if (openedPorts[data.id]) return

    try {
        // I want to connect to the input and listen for notes!
        let port = await JZZ().openMidiIn(data.input).or("MIDI-In: Cannot open!")
        // console.log("MIDI-In:", port.name())

        if (port.name()) openedPorts[data.id] = port

        port.connect(function (msg: any) {
            // console.log("CHECK IF NOTE ON/OFF", msg.toString()) // 00 00 00 -- Note Off
            let type = msg.toString().includes("Off") ? "noteoff" : "noteon"
            let values = { note: msg["1"], velocity: msg["2"], channel: msg["0"] }
            toApp("MAIN", { channel: "RECEIVE_MIDI", data: { id: data.id, values, type } })
        })
    } catch (err) {
        console.error(err)
    }
}
