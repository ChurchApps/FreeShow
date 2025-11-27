<script lang="ts">
    import { createEventDispatcher } from "svelte"

    import { variables } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { sortByName } from "../../helpers/array"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import InputRow from "../../input/InputRow.svelte"

    export let value

    function convertToOptions(a) {
        let options = Object.keys(a).map(id => ({ value: id, label: a[id].name, data: translateText(`variables.${a[id].type}`) }))
        return sortByName(options, "label")
    }

    const variableOptions = convertToOptions($variables)

    const variableModes = {
        text: [
            { value: "enabled", label: translateText("variables.set_state") }, // set enabled state
            { value: "value", label: translateText("variables.value") }
        ],
        number: [
            { value: "value", label: translateText("variables.value") },
            { value: "increment", label: translateText("actions.increment") },
            { value: "decrement", label: translateText("actions.decrement") },
            { value: "expression", label: translateText("actions.expression") } // math & variables
        ],
        random_number: [
            { value: "randomize", label: translateText("variables.randomize") },
            { value: "reset", label: translateText("actions.reset") }
        ],
        text_set: [
            { value: "next", label: translateText("media.next") },
            { value: "previous", label: translateText("media.previous") },
            { value: "value", label: translateText("variables.value") }
        ]
    }
    const defaultMode = {
        text: "enabled",
        number: "value",
        random_number: "randomize",
        text_set: "next"
    }

    let dispatch = createEventDispatcher()
    function updateValue(key: string, e) {
        let value = e?.detail ?? e?.target?.value ?? e
        dispatch("update", { key, value })

        if (key === "id") {
            dispatch("update", { key: "key", value: undefined })
            dispatch("update", { key: "value", value: undefined })
        }
    }

    const stateOptions = [
        { value: "", label: "Toggle" },
        { value: "off", label: "Off" },
        { value: "on", label: "On" }
    ]
    function textStateChange(e: any) {
        let value = e.detail

        if (value === "off") value = false
        else if (value === "on") value = true
        else value = undefined

        dispatch("update", { key: "value", value })
    }

    $: variable = $variables[value?.id]
    $: currentType = variable?.type
</script>

<MaterialDropdown label="items.variable" options={variableOptions} value={value?.id} on:change={e => updateValue("id", e.detail)} />

{#if value?.id}
    <InputRow>
        <MaterialDropdown label="actions.mode" options={variableModes[currentType] || []} value={value?.key || defaultMode[currentType] || ""} on:change={e => updateValue("key", e.detail)} />

        <!-- {#if variable?.type === "text_set"}
        <CombinedInput>
            <Dropdown style="width: 100%;" value={variable?.textSetKeys?.find((name) => name === value?.setId) || "—"} options={(variable?.textSetKeys || []).map((name) => ({ name }))} on:click={(e) => updateValue("setId", e.detail?.id)} />
        </CombinedInput>
    {/if} -->

        {#if value?.key === "value" || variable?.type === "number"}
            {#if (variable?.type === "number" && value?.key !== "expression") || variable?.type === "text_set"}
                <MaterialNumberInput label="variables.value" value={!isNaN(value?.value) ? value?.value || "1" : "1"} step={1} on:change={e => updateValue("value", e)} />
            {:else}
                <MaterialTextInput label="variables.value" value={isNaN(value?.value) ? value?.value || "" : ""} placeholder={value?.key === "expression" ? "Use math & dynamic variable values" : ""} on:change={e => updateValue("value", e)} />
            {/if}
        {:else if variable?.type === "text"}
            <MaterialDropdown label="variables.value" options={stateOptions} value={typeof value?.value === "boolean" ? (value.value ? "on" : "off") : ""} on:change={textStateChange} />
        {/if}
    </InputRow>
{/if}
