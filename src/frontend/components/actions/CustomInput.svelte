<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { Option } from "../../../types/Main"
    import { activePopup, audioPlaylists, audioStreams, dictionary, groups, midiIn, popupData, shows, stageShows, styles, triggers } from "../../stores"
    import T from "../helpers/T.svelte"
    import { sortByName } from "../helpers/array"
    import { _show } from "../helpers/shows"
    import Button from "../inputs/Button.svelte"
    import Checkbox from "../inputs/Checkbox.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"
    import NumberInput from "../inputs/NumberInput.svelte"
    import TextInput from "../inputs/TextInput.svelte"
    import MidiValues from "./MidiValues.svelte"
    import ChooseStyle from "./specific/ChooseStyle.svelte"

    export let inputId: string
    export let value
    export let actionId: string
    export let actionIndex: number = 0
    export let mainId: string = ""
    export let list: boolean = false

    let dispatch = createEventDispatcher()
    function updateValue(key: string, e) {
        let newValue = e?.detail ?? e?.target?.value ?? e
        if (key) value = { [key]: newValue }
        else value = newValue

        dispatch("change", value)
    }

    function checkboxChanged(e: any) {
        updateValue("value", { detail: e.target.checked })
    }

    function convertToOptions(object) {
        let options: Option[] = Object.keys(object).map((id) => ({ id, name: object[id].name }))
        return sortByName(options)
    }

    $: if (list && actionId === "start_show" && !value?.id) openSelectShow()
    function openSelectShow() {
        popupData.set({ ...$popupData, action: "select_show", revert: $activePopup, active: value?.id, actionIndex })
        activePopup.set("select_show")
    }

    const getOptions = {
        id_select_group: () => sortByName(Object.keys($groups).map((id) => ({ id, name: $dictionary.groups?.[$groups[id].name] || $groups[id].name }))),
        id_select_stage_layout: () => convertToOptions($stageShows),
        start_audio_stream: () => convertToOptions($audioStreams),
        start_playlist: () => convertToOptions($audioPlaylists),
        id_select_output_style: () => [{ id: null, name: "—" }, ...convertToOptions($styles)],
        start_trigger: () => convertToOptions($triggers),
        run_action: () => convertToOptions($midiIn).filter((a) => a.id !== mainId),
    }

    $: options = getOptions[actionId]?.() || []
</script>

{#if inputId === "output_style"}
    <div style="display: flex;flex-direction: column;">
        <ChooseStyle value={value || {}} on:change={(e) => updateValue("", e)} />
    </div>
{:else if inputId === "midi"}
    <MidiValues midi={value?.midi || {}} type="output" on:change={(e) => updateValue("midi", e)} />
{:else}
    <CombinedInput style={inputId === "midi" ? "flex-direction: column;" : ""}>
        {#if inputId === "index"}
            <NumberInput value={value?.index || 0} on:change={(e) => updateValue("index", e)} />
        {:else if inputId === "strval"}
            <TextInput value={value?.value || ""} placeholder={$dictionary.inputs?.name} on:change={(e) => updateValue("value", e)} />
        {:else if inputId === "bolval"}
            {#if actionId === "lock_output" && value?.value === undefined}<p style="opacity: 0.8;font-size: 0.8em;">Action will toggle if checkbox is unchanged</p>{/if}
            <div class="alignRight" style="width: 100%;">
                <Checkbox checked={value?.value} on:change={checkboxChanged} />
            </div>
        {:else if inputId === "id"}
            <!-- <TextInput value={value?.value || ""} on:change={(e) => updateValue("value", e)} /> -->
            {#if actionId === "start_show"}
                <Button on:click={openSelectShow} style="width: 100%;" dark center>
                    {#if value?.id}
                        {$shows[value.id]?.name || "—"}
                    {:else}
                        <T id="popup.select_show" />
                    {/if}
                </Button>
            {:else if options.length || getOptions[actionId]}
                <!-- <p><T id={actionData[actionId]?.name || actionId} /></p> -->
                <Dropdown style="width: 100%;" value={options.find((a) => a.id === value?.id)?.name || value?.id || "—"} {options} on:click={(e) => updateValue("id", e.detail?.id)} />
            {/if}
        {:else if inputId === "volume"}
            <!-- gain can also be set -->
            <NumberInput value={value?.volume || 0} max={1} decimals={2} step={0.1} inputMultiplier={100} on:change={(e) => updateValue("volume", e)} />
        {:else if inputId === "transition"}
            <!-- transition -->
        {:else if inputId === "variable"}
            <!-- variable -->
        {/if}
    </CombinedInput>
{/if}
