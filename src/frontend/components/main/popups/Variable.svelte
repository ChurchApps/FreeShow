<script lang="ts">
    import { uid } from "uid"
    import T from "../../helpers/T.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import { selected, variables } from "../../../stores"
    import TextInput from "../../inputs/TextInput.svelte"
    import { clone } from "../../helpers/array"

    const types = [
        { id: "number", name: "$:variables.number:$" },
        { id: "text", name: "$:variables.text:$" },
    ]

    const DEFAULT_VARIABLE = {
        name: "",
        type: "number",
    }

    let existing: boolean = $selected.id === "variable" && $selected.data[0]?.id
    let variableId = existing ? $selected.data[0].id : uid()
    let currentVariable = clone($variables[variableId] || DEFAULT_VARIABLE)

    function updateValue(e: any, key: string) {
        let value = e?.target?.value ?? e
        if (!value) return

        currentVariable[key] = value

        variables.update((a) => {
            a[variableId] = currentVariable
            return a
        })
    }
</script>

<CombinedInput textWidth={25}>
    <p><T id="inputs.name" /></p>
    <TextInput value={currentVariable.name} on:change={(e) => updateValue(e, "name")} />
</CombinedInput>
<CombinedInput textWidth={25}>
    <p><T id="clock.type" /></p>
    <Dropdown disabled={existing} value={types.find((a) => a.id === currentVariable.type)?.name || "—"} options={types} on:click={(e) => updateValue(e.detail.id, "type")} />
</CombinedInput>
