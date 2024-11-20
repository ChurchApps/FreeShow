<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { Option } from "../../../../types/Main"

    import { variables } from "../../../stores"
    import { sortByName } from "../../helpers/array"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import T from "../../helpers/T.svelte"

    export let value

    function convertToOptions(object) {
        let options: Option[] = Object.keys(object).map((id) => ({ id, name: object[id].name }))
        return sortByName(options)
    }

    const variableOptions = convertToOptions($variables) // .map((a) => ({...a, type: $variables[a.id]?.type}))

    const variableModes = [
        { id: "enabled", name: "Toggle" }, // set enabled state
        { id: "value", name: "Value" }, // variables.value
    ]

    let dispatch = createEventDispatcher()
    function updateValue(key: string, e) {
        let value = e?.detail ?? e?.target?.value ?? e
        dispatch("update", { key, value })
    }

    function checkboxChanged(e: any) {
        dispatch("update", { key: "value", value: e.target.checked })
    }
</script>

<CombinedInput>
    <Dropdown style="width: 100%;" activeId={value?.id} value={variableOptions.find((a) => a.id === value?.id)?.name || value?.id || "—"} options={variableOptions} on:click={(e) => updateValue("id", e.detail?.id)} />
</CombinedInput>

{#if $variables[value?.id]?.type === "text"}
    <CombinedInput>
        <Dropdown style="width: 100%;" value={variableModes.find((a) => a.id === (value?.key || "enabled"))?.name || ""} options={variableModes} on:click={(e) => updateValue("key", e.detail?.id)} />
    </CombinedInput>
{/if}

{#if value?.key === "value" || $variables[value?.id]?.type === "number"}
    <CombinedInput>
        {#if $variables[value?.id]?.type === "number"}
            <NumberInput value={!isNaN(value?.value) ? value?.value || "0" : "0"} on:change={(e) => updateValue("value", e)} />
        {:else}
            <TextInput value={typeof value?.value === "string" ? value?.value || "" : ""} on:change={(e) => updateValue("value", e)} />
        {/if}
    </CombinedInput>
{:else}
    <CombinedInput>
        {#if value?.value === undefined}<p style="opacity: 0.8;font-size: 0.8em;"><T id="actions.toggle_checkbox_tip" /></p>{/if}
        <div class="alignRight" style="width: 100%;">
            <Checkbox checked={!!value?.value} on:change={checkboxChanged} />
        </div>
    </CombinedInput>
{/if}
