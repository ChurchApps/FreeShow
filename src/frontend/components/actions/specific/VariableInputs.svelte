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

    const variableTextModes = [
        { id: "enabled", name: "$:variables.set_state:$" }, // set enabled state
        { id: "value", name: "$:variables.value:$" },
    ]

    const variableNumberModes = [
        { id: "value", name: "$:variables.value:$" },
        { id: "increment", name: "$:actions.increment:$" },
        { id: "decrement", name: "$:actions.decrement:$" },
    ]

    let dispatch = createEventDispatcher()
    function updateValue(key: string, e) {
        let value = e?.detail ?? e?.target?.value ?? e
        dispatch("update", { key, value })
    }

    function checkboxChanged(e: any) {
        dispatch("update", { key: "value", value: e.target.checked })
    }

    $: variable = $variables[value?.id]
</script>

<CombinedInput>
    <Dropdown style="width: 100%;" activeId={value?.id} value={variableOptions.find((a) => a.id === value?.id)?.name || value?.id || "—"} options={variableOptions} on:click={(e) => updateValue("id", e.detail?.id)} />
</CombinedInput>

{#if value?.id}
    <CombinedInput>
        <p><T id="actions.mode" /></p>
        {#if variable?.type === "text"}
            <Dropdown style="width: 100%;" value={variableTextModes.find((a) => a.id === (value?.key || "enabled"))?.name || "—"} options={variableTextModes} on:click={(e) => updateValue("key", e.detail?.id)} />
        {:else if variable?.type === "number"}
            <Dropdown style="width: 100%;" value={variableNumberModes.find((a) => a.id === (value?.key || "value"))?.name || "—"} options={variableNumberModes} on:click={(e) => updateValue("key", e.detail?.id)} />
        {/if}
    </CombinedInput>

    {#if value?.key === "value" || variable?.type === "number"}
        <CombinedInput>
            {#if variable?.type === "number"}
                <NumberInput value={!isNaN(value?.value) ? value?.value || "1" : "1"} step={1} decimals={1} fixed={Number(value?.value).toString().includes(".") ? 1 : 0} on:change={(e) => updateValue("value", e)} />
            {:else}
                <TextInput value={isNaN(value?.value) ? value?.value || "" : ""} on:change={(e) => updateValue("value", e)} />
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
{/if}
