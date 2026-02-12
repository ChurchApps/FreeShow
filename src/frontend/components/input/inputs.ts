import type { Input } from "../../../types/Input"
import MidiValues from "../actions/MidiValues.svelte"
import RestValues from "../actions/RestValues.svelte"
import MaterialColorInput from "../inputs/MaterialColorInput.svelte"
import MaterialDatePicker from "../inputs/MaterialDatePicker.svelte"
import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
import MaterialNumberInput from "../inputs/MaterialNumberInput.svelte"
import MaterialTextInput from "../inputs/MaterialTextInput.svelte"
import MaterialTimePicker from "../inputs/MaterialTimePicker.svelte"

// [DEFAULT] IN: value= OUT=on:change
export const commonInputs = {
    // eslint-disable-next-line
    string: MaterialTextInput,
    number: MaterialNumberInput,
    dropdown: MaterialDropdown,
    color: MaterialColorInput,
    date: MaterialDatePicker,
    time: MaterialTimePicker,

    midi: MidiValues,
    rest: RestValues
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
