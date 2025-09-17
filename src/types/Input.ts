import type { MidiValues } from "./Show"

interface BaseInput {
    label?: string
    name?: string
    id: string
    settings?: any
    style?: string
}

type InputString = {
    type: "string"
    value: string
}
type InputNumber = {
    type: "number"
    value: number
}
type InputCheckbox = {
    type: "checkbox"
    value: boolean
}
type InputColor = {
    type: "color"
    value: string
}
type InputDropdown = {
    type: "dropdown"
    value: string
    options: DropdownOptions
}
export type DropdownOptions = { label: string; value: string; prefix?: string; style?: string; data?: string }[]

type InputMidi = {
    type: "midi"
    value: MidiValues
}
type InputRest = {
    type: "rest"
    value: RestValues
}

type Inputs = InputString | InputNumber | InputCheckbox | InputColor | InputDropdown | InputMidi | InputRest
export type Input = BaseInput & Inputs

type ExtractType<T> = T extends { type: infer U } ? U : never
export type InputType = ExtractType<Inputs>

///

// import type { API_rest_command } from "./../frontend/components/actions/api"
type RestValues = {
    url: string
    method: string
    contentType: string
    payload: string
}
