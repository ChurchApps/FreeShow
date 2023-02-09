import JZZ from "jzz"

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

export async function sendMidi(data: any) {
    let port: any = null

    try {
        port = await JZZ().openMidiOut(data.output)
        if (data.type === "noteon") {
            await port.noteOn(data.values.channel, data.values.note, data.values.velocity)
            // .wait(500).noteOff(data.values.channel, data.values.note)
        } else if (data.type === "noteoff") {
            await port.noteOff(data.values.channel, data.values.note, data.values.velocity)
        }
    } catch (error) {
        console.error(error)
    }

    if (!port) return
    port.close()
}
