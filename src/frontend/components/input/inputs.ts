import type { Option } from "../../../types/Main"
import type { Input, InputType } from "../../../types/Input"
import MidiValues from "../actions/MidiValues.svelte"
import RestValues from "../actions/RestValues.svelte"
import { clone, sortByName } from "../helpers/array"
import Checkbox from "../inputs/Checkbox.svelte"
import Dropdown from "../inputs/Dropdown.svelte"
import NumberInput from "../inputs/NumberInput.svelte"
import TextInput from "../inputs/TextInput.svelte"

const getInputValue = {
    string: (e: any) => e.target.value,
    number: (e: any) => Number(e.detail),
    checkbox: (e: any) => e.target.checked,
}
export function getValue(e: any, type: InputType) {
    const input = getInputValue[type]
    if (input) return input(e)
    return e.detail
}

// multiple preset inputs
export const customInputs = {
    midi: MidiValues,
    rest: RestValues,
}

// [DEFAULT] IN: value= OUT=on:change
export const commonInputs = {
    string: TextInput,
    number: NumberInput,
    dropdown: Dropdown, // OUT=click
    checkbox: Checkbox, // IN=checked
}

// init values

// WIP similar to convertToOptions()
export function initDropdownOptions(object: Option[] | { [key: string]: { name: string; [key: string]: any } }, addEmpty = false) {
    let options: Option[] = []
    if (Array.isArray(object)) options = object
    else options = sortByName(Object.keys(object).map((id) => ({ id, name: object[id].name })))

    if (addEmpty) options = [{ name: "—", id: "" }, ...options]
    return clone(options)
}

export function getDropdownValue(options: Option[], id: string | undefined) {
    return options.find((a) => a.id === id)?.name || "—"
}

// get values

export function getValues(inputs: Input[], data: Object) {
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
