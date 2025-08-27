<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { Input } from "../../../types/Input"
    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
    import MaterialToggleSwitch from "../inputs/MaterialToggleSwitch.svelte"
    import { commonInputs, customInputs } from "./inputs"

    export let input: Input

    let dispatch = createEventDispatcher()
    function changed(e: any) {
        let value = e.detail
        dispatch("change", value)
    }
</script>

{#if input.type === "dropdown"}
    <MaterialDropdown label={input.name} value={input.value} options={input.options} on:change={changed} />
{:else if input.type === "checkbox"}
    <MaterialToggleSwitch label={input.name} checked={input.value} on:change={changed} />
{:else if customInputs[input.type]}
    <svelte:component this={customInputs[input.type]} label={input.name} value={input.value} {...input.settings || {}} on:change={changed} />
{:else}
    <svelte:component this={commonInputs[input.type]} label={input.name} value={input.value} {...input.settings || {}} on:change={changed} />
{/if}
