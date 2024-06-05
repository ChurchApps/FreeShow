<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import NumberInput from "../inputs/NumberInput.svelte"
    import TextInput from "../inputs/TextInput.svelte"
    import { activePopup, audioStreams, dictionary, groups, midiIn, stageShows, styles, triggers } from "../../stores"
    import Button from "../inputs/Button.svelte"
    import T from "../helpers/T.svelte"
    import Checkbox from "../inputs/Checkbox.svelte"
    import MidiValues from "./MidiValues.svelte"
    import type { Option } from "../../../types/Main"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"
    import { actionData } from "./actionData"
    import { sortByName } from "../helpers/array"

    export let inputId: string
    export let value
    export let actionId: string

    $: console.log(inputId)

    let dispatch = createEventDispatcher()
    function updateValue(key: string, e) {
        value = { [key]: e.detail }
        dispatch("change", value)
    }

    function checkboxChanged(e: any) {
        updateValue("value", e.target.checked)
    }

    function convertToOptions(object) {
        let options: Option[] = Object.keys(object).map((id) => ({ id, name: object[id].name }))
        return options
    }

    const getOptions = {
        id_select_group: () => sortByName(Object.keys($groups).map((id) => ({ id, name: $dictionary.groups?.[$groups[id].name] || $groups[id].name }))),
        id_select_stage_layout: () => convertToOptions($stageShows),
        start_audio_stream: () => convertToOptions($audioStreams),
        id_select_output_style: () => [{ id: null, name: "—" }, ...sortByName(convertToOptions($styles))],
        start_trigger: () => convertToOptions($triggers),
        run_action: () => convertToOptions($midiIn),
    }

    $: options = getOptions[actionId]?.() || []
</script>

{#if inputId === "index"}
    <NumberInput value={value?.index || 0} on:change={(e) => updateValue("index", e)} />
{:else if inputId === "strval"}
    <TextInput value={value?.value || ""} on:change={(e) => updateValue("value", e)} />
{:else if inputId === "bolval"}
    <Checkbox checked={value?.value} on:change={checkboxChanged} />
{:else if inputId === "id"}
    <!-- <TextInput value={value?.value || ""} on:change={(e) => updateValue("value", e)} /> -->
    {#if actionId === "start_show"}
        <Button on:click={() => activePopup.set("select_show")}>
            <T id="popup.select_show" />
        </Button>
    {:else if options.length}
        <CombinedInput>
            <p><T id={actionData[actionId]?.name || actionId} /></p>
            <Dropdown value={options.find((a) => a.id === value?.id)?.name || value?.id || "—"} {options} />
        </CombinedInput>
    {/if}
{:else if inputId === "volume"}
    <!-- gain can also be set -->
    <NumberInput value={value?.volume || 0} on:change={(e) => updateValue("volume", e)} />
{:else if inputId === "transition"}
    <!-- transition -->
{:else if inputId === "variable"}
    <!-- variable -->
{:else if inputId === "midi"}
    <MidiValues midi={value?.midi} on:change={(e) => updateValue("midi", e)} />
{/if}
