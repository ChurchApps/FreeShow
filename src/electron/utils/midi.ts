import easymidi from "easymidi"

// const devices: any = {}

// input.on('noteon', function (params) {
//     // params = {note: ..., velocity: ..., channel: ...}
//   });

export function getMidiOutputs() {
    return easymidi.getOutputs()
}

export function sendMidi(data: any): void {
    var output = new easymidi.Output(data.output)

    output.send(data.type, data.values)
    // cc: { controller: 37, value: 80, channel: 0 }
    // noteon: { note: 64, velocity: 127, channel: 3 }

    output.close()
}
