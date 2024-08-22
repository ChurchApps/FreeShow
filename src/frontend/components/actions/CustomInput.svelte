<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import type { Option } from "../../../types/Main"
    import { activePopup, audioPlaylists, audioStreams, dictionary, groups, midiIn, outputs, popupData, shows, stageShows, styles, timers, triggers } from "../../stores"
    import T from "../helpers/T.svelte"
    import { keysToID, sortByName } from "../helpers/array"
    import { _show } from "../helpers/shows"
    import Button from "../inputs/Button.svelte"
    import Checkbox from "../inputs/Checkbox.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"
    import NumberInput from "../inputs/NumberInput.svelte"
    import TextInput from "../inputs/TextInput.svelte"
    import MidiValues from "./MidiValues.svelte"
    import RestValues from "./RestValues.svelte"
    import ChooseStyle from "./specific/ChooseStyle.svelte"
    import MetronomeInputs from "../drawer/audio/MetronomeInputs.svelte"

    export let inputId: string
    export let value
    export let actionId: string
    export let actionIndex: number = 0
    export let mainId: string = ""
    export let list: boolean = false

    onMount(() => {
        // set default
        if (inputId === "metronome" && !value) updateValue("", { tempo: 120, beats: 4 })
        else if (inputId === "index" && value?.index === undefined) updateValue("index", 0)
        else if (inputId === "volume" && value?.volume === undefined) updateValue("volume", 1)
    })

    let dispatch = createEventDispatcher()
    function updateValue(key: string, e) {
        let newValue = e?.detail ?? e?.target?.value ?? e
        if (key) value = { ...value, [key]: newValue }
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

    let cameras: any[] = []
    if (inputId === "camera") getCameras()
    function getCameras() {
        navigator.mediaDevices?.enumerateDevices()?.then((devices) => {
            if (!devices) return
            let cameraList = devices.filter((a) => a.kind === "videoinput").map((a) => ({ name: a.label, id: a.deviceId, groupId: a.groupId }))
            cameras = sortByName(cameraList)
        })
    }

    const getOptions = {
        id_select_group: () => sortByName(Object.keys($groups).map((id) => ({ id, name: $dictionary.groups?.[$groups[id].name] || $groups[id].name }))),
        id_select_stage_layout: () => convertToOptions($stageShows),
        stage_outputs: () => [{ id: null, name: "—" }, ...sortByName(keysToID($outputs).filter((a) => a.stageOutput))],
        start_audio_stream: () => convertToOptions($audioStreams),
        start_playlist: () => convertToOptions($audioPlaylists),
        id_select_output_style: () => [{ id: null, name: "—" }, ...convertToOptions($styles)],
        id_start_timer: () => convertToOptions($timers),
        start_trigger: () => convertToOptions($triggers),
        run_action: () => convertToOptions($midiIn).filter((a) => a.name && a.id !== mainId),
    }

    $: options = getOptions[actionId]?.() || []
</script>

{#if inputId === "output_style"}
    <div class="column">
        <ChooseStyle value={value || {}} on:change={(e) => updateValue("", e)} />
    </div>
{:else if inputId === "stage_output_layout"}
    <CombinedInput>
        <p><T id="stage.stage_layout" /></p>
        <Dropdown style="width: 100%;" value={getOptions.id_select_stage_layout().find((a) => a.id === value?.stageLayoutId)?.name || "—"} options={getOptions.id_select_stage_layout()} on:click={(e) => updateValue("stageLayoutId", e.detail?.id)} />
    </CombinedInput>
    <CombinedInput>
        <!-- keep empty to change all stage outputs -->
        <p><T id="stage.output" /></p>
        <Dropdown style="width: 100%;" value={getOptions.stage_outputs().find((a) => a.id === value?.outputId)?.name || "—"} options={getOptions.stage_outputs()} on:click={(e) => updateValue("outputId", e.detail?.id)} />
    </CombinedInput>
{:else if inputId === "camera"}
    <CombinedInput>
        <p><T id="items.camera" /></p>
        <Dropdown style="width: 100%;" value={cameras.find((a) => a.id === value?.id)?.name || "—"} options={cameras} on:click={(e) => updateValue("", e.detail)} />
    </CombinedInput>
{:else if inputId === "midi"}
    <MidiValues midi={value?.midi || {}} type="output" on:change={(e) => updateValue("midi", e)} />
{:else if inputId === "metronome"}
    <div class="column">
        <MetronomeInputs values={value || { tempo: 120, beats: 4 }} on:change={(e) => updateValue("", e)} volume={false} />
    </div>
{:else if inputId === "toggle_action"}
    <CombinedInput>
        <Dropdown style="width: 100%;" activeId={value?.id} value={getOptions.run_action().find((a) => a.id === value?.id)?.name || value?.id || "—"} options={getOptions.run_action()} on:click={(e) => updateValue("id", e.detail?.id)} />
    </CombinedInput>
    <CombinedInput>
        {#if value?.value === undefined}<p style="opacity: 0.8;font-size: 0.8em;">Action will toggle if checkbox is unchanged</p>{/if}
        <div class="alignRight" style="width: 100%;">
            <Checkbox checked={value?.value} on:change={checkboxChanged} />
        </div>
    </CombinedInput>
{:else if inputId === "rest"}
    <RestValues rest={value} on:change={(e) => updateValue("", e)} />
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
                <Dropdown style="width: 100%;" activeId={value?.id} value={options.find((a) => a.id === value?.id)?.name || value?.id || "—"} {options} on:click={(e) => updateValue("id", e.detail?.id)} />
            {/if}
        {:else if inputId === "volume"}
            <!-- gain can also be set -->
            <NumberInput value={value?.volume || 1} max={1} decimals={2} step={0.1} inputMultiplier={100} on:change={(e) => updateValue("volume", e)} />
        {:else if inputId === "transition"}
            <!-- transition -->
        {:else if inputId === "variable"}
            <!-- variable -->
        {/if}
    </CombinedInput>
{/if}

<style>
    .column {
        display: flex;
        flex-direction: column;
    }
</style>
