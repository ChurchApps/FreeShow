import { get } from "svelte/store"
import type { Input } from "../../../types/Input"
import type { EmitterInputs, EmitterTypes } from "../../../types/Show"
import { emitters } from "../../stores"
import { INPUT_MIDI, INPUT_REST } from "../input/inputs"
import type { API_emitter, API_rest_command } from "./api"
import { sendRestCommandSync } from "./rest"
import { emitOSC, type OSC_SIGNAL } from "./apiOSC"

export const OSC_SIGNAL_INPUTS: Input[] = [
    { name: "inputs.url", id: "url", type: "string", value: "ws://localhost" },
    { name: "settings.port", id: "port", type: "number", value: 8080, settings: { max: 65535, buttons: false } },
]

export const emitterData: { [key in EmitterTypes]: EmitterInputs } = {
    osc: {
        signal: OSC_SIGNAL_INPUTS,
    },
    http: {
        signal: [{ ...INPUT_REST, settings: { emitter: true } }],
    },
    midi: {
        signal: [INPUT_MIDI],
    },
}

const EMIT_DATA = {
    osc: (signal: OSC_SIGNAL, values: { [key: string]: string }) => {
        let OSC_DATA = "/" + Object.values(values).join("/")
        emitOSC(signal, OSC_DATA)
    },
    http: (signal: API_rest_command, values: { [key: string]: string }) => {
        let REST_DATA = signal
        REST_DATA.contentType = "application/json"
        REST_DATA.payload = JSON.stringify(values)
        sendRestCommandSync(REST_DATA)
    },
}

export function emitData(data: API_emitter) {
    let emitter = get(emitters)[data.emitter]
    if (!data.emitter || !emitter) return

    let emitterTemplateValues = data.template ? emitter.templates?.[data.template]?.inputs || [] : []

    let values = emitterTemplateValues.map((a, i) => {
        let customValue = data.templateValues?.[i]
        if (a.value) return a
        return customValue || a
    })
    if (!values.length) values = data.templateValues || []
    if (!values.length) return

    if (!EMIT_DATA[emitter.type]) {
        console.error("Received unknown data emit type")
        return
    }

    let signal: { [key: string]: any } = emitter.signal || {}
    if (signal.value) signal = signal.value

    let valueObject: { [key: string]: string } = {}
    values.forEach(({ name, value }) => {
        if (!name) return
        valueObject[name] = value
    })

    EMIT_DATA[emitter.type](signal, valueObject)
}
