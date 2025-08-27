import { get } from "svelte/store"
import type { Input } from "../../../types/Input"
import type { EmitterInputs, EmitterTemplateValue, EmitterTypes } from "../../../types/Show"
import { emitters } from "../../stores"
import type { API_emitter, API_midi, API_rest_command } from "./api"
import { emitOSC, type OSC_SIGNAL } from "./apiOSC"
import { sendRestCommandSync } from "./rest"
import { midiToNote } from "./midi"
import { sendMidi } from "../helpers/showActions"

const OSC_SIGNAL_INPUTS: Input[] = [
    { name: "inputs.url", id: "host", type: "string", value: "0.0.0.0" }, // ws://127.0.0.1
    { name: "settings.port", id: "port", type: "number", value: 8080, settings: { max: 65535, buttons: false } }
]

const INPUT_REST: Input = { name: "", id: "", type: "rest", value: { url: "", method: "", contentType: "", payload: "" } }

const MIDI_SIGNAL_INPUTS: Input[] = [
    { name: "midi.output", id: "output", type: "dropdown", value: "", options: [{ value: "", label: "—" }] },
    {
        name: "midi.type",
        id: "type",
        type: "dropdown",
        value: "noteon",
        options: [
            { value: "noteon", label: "noteon" },
            { value: "noteoff", label: "noteoff" },
            { value: "control", label: "control" }
        ]
    }
]

export const emitterData: { [key in EmitterTypes]: EmitterInputs } = {
    osc: {
        signal: OSC_SIGNAL_INPUTS
    },
    http: {
        signal: [{ ...INPUT_REST, settings: { emitter: true } }]
    },
    midi: {
        signal: MIDI_SIGNAL_INPUTS
    }
}

function valueArrayToObject(values: EmitterTemplateValue[], removeEmptyValues = false) {
    const valueObject: { [key: string]: string } = {}
    values.forEach(({ name, value }) => {
        if (!name || (removeEmptyValues && !value) || typeof value !== "string") return
        valueObject[name] = value
    })
    return valueObject
}

function getMidiInfo(values: { note?: number; velocity?: number; channel?: number }) {
    if (!values.note) return ""
    return `${values.channel ?? 1}: ${midiToNote(values.note)}${values.velocity || 0 > 0 ? ` - ${values.velocity}` : ""}`
}

export const formatData = {
    osc: (values: EmitterTemplateValue[], data = "") => `/${Object.values(valueArrayToObject(values, true)).join("/")}${data ? ` ${data}` : ""}`,
    http: (values: EmitterTemplateValue[]) => JSON.stringify(valueArrayToObject(values)),
    midi: (values: EmitterTemplateValue[]) => getMidiInfo(typeof values[0]?.value === "object" ? values[0].value : {})
}

const EMIT_DATA = {
    osc: (signal: OSC_SIGNAL, values: EmitterTemplateValue[], data: string) => {
        const OSC_DATA = formatData.osc(values, data)
        emitOSC(signal, OSC_DATA)
    },
    http: (signal: API_rest_command, values: EmitterTemplateValue[]) => {
        const REST_DATA = signal
        REST_DATA.contentType = "application/json"
        REST_DATA.payload = formatData.http(values)
        sendRestCommandSync(REST_DATA)
    },
    midi: (signal: { type?: "noteon" | "noteoff"; output?: string }, values: EmitterTemplateValue[]) => {
        if (!signal.output || typeof values[0]?.value !== "object") return
        const midiValues = { channel: 1, note: 0, velocity: 0, ...values[0].value }
        const data: API_midi = { output: signal.output, type: signal.type || "noteon", values: midiValues }
        sendMidi(data)
    }
}

export function emitData(data: API_emitter) {
    const emitter = get(emitters)[data.emitter]
    if (!data.emitter || !emitter) return

    const emitterTemplateValues = data.template ? emitter.templates?.[data.template]?.inputs || [] : []

    let values = emitterTemplateValues.map((a, i) => {
        const customValue = data.templateValues?.[i]
        if (a.value) return a
        return customValue || a
    })
    if (!values.length) values = data.templateValues || []
    if (!values.length) return

    if (!EMIT_DATA[emitter.type]) {
        console.error("Received unknown data emit type")
        return
    }

    let signal: any = emitter.signal || {}
    if (signal.value) signal = signal.value

    EMIT_DATA[emitter.type](signal, values, data.data || "")
}
