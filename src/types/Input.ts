import type { Option } from "./Main"
import type { MidiValues } from "./Show"

interface BaseInput {
    name: string
    id: string
    settings?: any
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
type InputDropdown = {
    type: "dropdown"
    value: string
    options: Option[]
}

type InputMidi = {
    type: "midi"
    value: MidiValues
}
type InputRest = {
    type: "rest"
    value: RestValues
}

type Inputs = InputString | InputNumber | InputCheckbox | InputDropdown | InputMidi | InputRest
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
