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
    console.log("OUTPUT", data.output)

    try {
        port = await JZZ().openMidiOut(data.output).or("Could not connect to MIDI out!")
        if (!port) return
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

export async function receiveMidi(data: any) {
    // let port: any = null
    console.log("INPUT", data.input)
    if (!data.input) return

    // this is for testing
    console.log("Testing all inputs")
    JZZ()
        .info()
        .inputs.forEach((input: any, index: number) => {
            console.log(index, input)

            JZZ()
                .openMidiIn(index)
                .or(index + ": Can't open!")
        })

    try {
        JZZ()
            .openMidiIn(data.input)
            .or("MIDI-In: Cannot open!")
            .and(function (test: any) {
                console.log("MIDI-In:", test.name())
            })
            .connect(JZZ().openMidiOut()) // redirect to the default MIDI-Out port
            .connect(function (msg: any) {
                console.log(msg.toString())
                toApp("RECEIVE_MIDI", msg)
            }) // and log to the console
            .wait(10000)
            .close()
            .and("Thank you!")

        // I want to connect to the input and listen for notes!
        // port = await JZZ().openMidiIn(data.input).
        // port.connect(function (msg: any) {
        //     console.log(msg)
        //     toApp("RECEIVE_MIDI", msg)
        // })

        // if (data.type === "noteon") {
        //     await port.noteOn(data.values.channel, data.values.note, data.values.velocity)
        //     // .wait(500).noteOff(data.values.channel, data.values.note)
        // } else if (data.type === "noteoff") {
        //     await port.noteOff(data.values.channel, data.values.note, data.values.velocity)
        // }
    } catch (error) {
        console.error(error)
    }

    // if (!port) return
    // port.close()
}
