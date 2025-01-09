<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { Input } from "../../../types/Input"
    import T from "../helpers/T.svelte"
    import Checkbox from "../inputs/Checkbox.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"
    import { commonInputs, customInputs, getDropdownValue, getValue } from "./inputs"

    export let input: Input

    let dispatch = createEventDispatcher()
    function changed(e: any) {
        let value = getValue(e, input.type)
        dispatch("change", value)
    }
</script>

{#if input.type === "dropdown"}
    <CombinedInput>
        <p><T id={input.name} /></p>
        <Dropdown value={getDropdownValue(input.options, input.value)} options={input.options} on:click={(e) => changed(e)} />
    </CombinedInput>
{:else if input.type === "checkbox"}
    <CombinedInput>
        <p><T id={input.name} /></p>
        <Checkbox checked={input.value} on:change={(e) => changed(e)} />
    </CombinedInput>
{:else if customInputs[input.type]}
    <svelte:component this={customInputs[input.type]} value={input.value} {...input.settings || {}} on:change={(e) => changed(e)} />
{:else}
    <CombinedInput>
        <p><T id={input.name} /></p>
        <svelte:component this={commonInputs[input.type]} value={input.value} {...input.settings || {}} on:change={(e) => changed(e)} />
    </CombinedInput>
{/if}
