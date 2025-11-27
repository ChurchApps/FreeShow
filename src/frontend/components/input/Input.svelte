<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { Input } from "../../../types/Input"
    import { activePopup } from "../../stores"
    import { translateText } from "../../utils/language"
    import { select } from "../helpers/select"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialCheckbox from "../inputs/MaterialCheckbox.svelte"
    import MaterialColorInput from "../inputs/MaterialColorInput.svelte"
    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
    import { commonInputs } from "./inputs"

    export let input: Input

    $: label = input.label ?? input.name ?? ""

    let dispatch = createEventDispatcher()
    function changed(e: any) {
        let value = e.detail
        dispatch("change", value)
    }
</script>

{#if input.type === "dropdown"}
    <MaterialDropdown {label} {...input} options={input.options?.map(a => ({ ...a, label: translateText(a.label) }))} on:change={changed} />

    <!-- custom edit -->
    {#if input.label === "items.timer" && input.value}
        <MaterialButton
            icon="edit"
            on:click={() => {
                select("timer", { id: input.value })
                activePopup.set("timer")
            }}
        />
    {/if}
{:else if input.type === "checkbox"}
    <MaterialCheckbox {label} checked={input.value} style="flex: 1;{input.style || ''}" on:change={changed} />
{:else if input.type === "color"}
    <MaterialColorInput {label} {...input} {...input.settings || {}} on:input={changed} />
{:else}
    <svelte:component this={commonInputs[input.type]} {label} {...input} {...input.settings || {}} on:change={changed} />
{/if}
