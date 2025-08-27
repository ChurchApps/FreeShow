import type { Input } from "../../../types/Input"
import type { Option } from "../../../types/Main"
import MidiValues from "../actions/MidiValues.svelte"
import RestValues from "../actions/RestValues.svelte"
import { clone, sortByName } from "../helpers/array"
import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
import MaterialNumberInput from "../inputs/MaterialNumberInput.svelte"
import MaterialTextInput from "../inputs/MaterialTextInput.svelte"
import MaterialToggleSwitch from "../inputs/MaterialToggleSwitch.svelte"

// multiple preset inputs
export const customInputs = {
    midi: MidiValues,
    rest: RestValues,
}

// [DEFAULT] IN: value= OUT=on:change
export const commonInputs = {
    // eslint-disable-next-line
    string: MaterialTextInput,
    number: MaterialNumberInput,
    dropdown: MaterialDropdown, // OUT=click
    checkbox: MaterialToggleSwitch, // IN=checked
}

// init values

// WIP similar to convertToOptions()
export function initDropdownOptions(object: Option[] | { [key: string]: { name: string;[key: string]: any } }) {
    let options: { value: string; label: string }[] = []
    if (Array.isArray(object)) options = object.map((a) => ({ value: a.id || a.name, label: a.name }))
    else options = sortByName(Object.keys(object).map((id) => ({ value: id, label: object[id].name })), "label")

    return clone(options)
}

// get values

export function getValues(inputs: Input[], data: object) {
    if (!Array.isArray(inputs)) return []

    inputs = inputs.map((input) => {
        if (!input.id) return { ...input, value: data || input.value }

        const keys = input.id.includes(".") ? input.id.split(".") : [input.id]
        let value = data?.[keys[0]]
        if (keys.length > 1) value = value?.[keys[1]]

        if (value === undefined) return input
        return { ...input, value }
    })

    return inputs
}
