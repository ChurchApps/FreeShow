import easymidi from "easymidi"

// input.on('noteon', function (params) {
//     // params = {note: ..., velocity: ..., channel: ...}
//   });

// not windows...
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

export function getMidiOutputs() {
    return easymidi.getOutputs()
}

export function sendMidi(data: any): void {
    let output: any = null

    try {
        output = new easymidi.Output(data.output)
    } catch (error) {
        console.error(error)
    }

    if (!output) return

    output.send(data.type, data.values)
    // cc: { controller: 37, value: 80, channel: 0 }
    // noteon: { note: 64, velocity: 127, channel: 3 }

    output.close()
}
