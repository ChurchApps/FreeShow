<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import { Main } from "../../../types/IPC/Main"
    import { requestMain } from "../../IPC/main"
    import { actions, activePopup, audioPlaylists, audioStreams, dictionary, effects, groups, outputs, overlays, popupData, projects, shows, stageShows, styles, templates, timers, triggers, variables } from "../../stores"
    import MetronomeInputs from "../drawer/audio/MetronomeInputs.svelte"
    import T from "../helpers/T.svelte"
    import { convertToOptions, keysToID, sortByName } from "../helpers/array"
    import Button from "../inputs/Button.svelte"
    import Checkbox from "../inputs/Checkbox.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"
    import NumberInput from "../inputs/NumberInput.svelte"
    import TextInput from "../inputs/TextInput.svelte"
    import ChooseEmitter from "./ChooseEmitter.svelte"
    import MidiValues from "./MidiValues.svelte"
    import RestValues from "./RestValues.svelte"
    import ChooseStyle from "./specific/ChooseStyle.svelte"
    import VariableInputs from "./specific/VariableInputs.svelte"

    export let inputId: string
    export let value
    export let actionId: string
    export let actionIndex = 0
    export let mainId = ""
    export let list = false

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

    $: if (list && actionId === "start_show" && !value?.id) openSelectShow()
    function openSelectShow() {
        popupData.set({ ...$popupData, action: "select_show", revert: $activePopup, active: value?.id, actionIndex })
        activePopup.set("select_show")
    }

    let cameras: { name: string; id: string; groupId: string }[] = []
    if (inputId === "camera") getCameras()
    function getCameras() {
        navigator.mediaDevices?.enumerateDevices()?.then((devices) => {
            if (!devices) return
            let cameraList = devices.filter((a) => a.kind === "videoinput").map((a) => ({ name: a.label, id: a.deviceId, groupId: a.groupId }))
            cameras = sortByName(cameraList)
        })
    }

    let screens: { name: string; id: string }[] = []
    if (inputId === "screen") getScreens()
    async function getScreens() {
        let screenList = await requestMain(Main.GET_SCREENS)
        let windowList = await requestMain(Main.GET_WINDOWS)
        // screens = sortByName(screensList)
        screens = [...screenList, ...windowList]
    }

    const getOptions = {
        id_select_project: () => convertToOptions($projects),
        id_select_group: () => sortByName(Object.keys($groups).map((id) => ({ id, name: $dictionary.groups?.[$groups[id].name] || $groups[id].name }))),
        clear_overlay: () => [...convertToOptions($overlays), ...convertToOptions($effects)],
        id_start_effect: () => convertToOptions($effects),
        id_select_overlay: () => convertToOptions($overlays),
        id_select_stage_layout: () => convertToOptions($stageShows),
        stage_outputs: () => [{ id: "", name: "$:actions.all_outputs:$" }, ...sortByName(keysToID($outputs).filter((a) => a.stageOutput))],
        start_audio_stream: () => convertToOptions($audioStreams),
        start_playlist: () => convertToOptions($audioPlaylists),
        id_select_output_style: () => [{ id: null, name: "—" }, ...convertToOptions($styles)],
        id_start_timer: () => convertToOptions($timers),
        variable: () => convertToOptions($variables), // .map((a) => ({...a, type: $variables[a.id]?.type}))
        start_trigger: () => convertToOptions($triggers),
        // WIP remove all actions that reference this action and so on - to prevent infinite loop
        run_action: () => convertToOptions($actions).filter((a) => a.name && a.id !== mainId),
        set_template: () => convertToOptions($templates),
        toggle_output: () => convertToOptions($outputs)
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
        <Dropdown style="width: 100%;" value={getOptions.stage_outputs().find((a) => a.id === (value?.outputId || ""))?.name || "—"} options={getOptions.stage_outputs()} on:click={(e) => updateValue("outputId", e.detail?.id)} />
    </CombinedInput>
{:else if inputId === "camera"}
    <CombinedInput>
        <p><T id="items.camera" /></p>
        <Dropdown style="width: 100%;" value={cameras.find((a) => a.id === value?.id)?.name || "—"} options={cameras} on:click={(e) => updateValue("", e.detail)} />
    </CombinedInput>
{:else if inputId === "screen"}
    <CombinedInput>
        <p><T id="items.screen" /></p>
        <Dropdown style="width: 100%;" value={screens.find((a) => a.id === value?.id)?.name || "—"} options={screens} on:click={(e) => updateValue("", e.detail)} />
    </CombinedInput>
{:else if inputId === "midi"}
    <MidiValues value={value?.midi || {}} type="output" on:change={(e) => updateValue("midi", e)} />
{:else if inputId === "metronome"}
    <div class="column">
        <MetronomeInputs values={value || { tempo: 120, beats: 4 }} on:change={(e) => updateValue("", e)} action />
    </div>
{:else if inputId === "variable"}
    <VariableInputs {value} on:update={(e) => updateValue(e.detail?.key, e.detail?.value)} />
{:else if inputId === "toggle_action"}
    <CombinedInput>
        <Dropdown style="width: 100%;" activeId={value?.id} value={getOptions.run_action().find((a) => a.id === value?.id)?.name || value?.id || "—"} options={getOptions.run_action()} on:click={(e) => updateValue("id", e.detail?.id)} />
    </CombinedInput>
    <CombinedInput>
        {#if value?.value === undefined}<p style="opacity: 0.8;font-size: 0.8em;"><T id="actions.toggle_checkbox_tip" /></p>{/if}
        <div class="alignRight" style="width: 100%;">
            <Checkbox checked={value?.value} on:change={checkboxChanged} />
        </div>
    </CombinedInput>
{:else if inputId === "rest"}
    <RestValues value={value || {}} on:change={(e) => updateValue("", e)} />
{:else if inputId === "emitter"}
    <ChooseEmitter value={value || {}} on:change={(e) => updateValue("", e)} />
{:else}
    <CombinedInput style={inputId === "midi" ? "flex-direction: column;" : ""}>
        {#if inputId === "index"}
            <NumberInput value={value?.index || 0} on:change={(e) => updateValue("index", e)} />
        {:else if inputId === "number"}
            <NumberInput value={value?.number || 0} decimals={1} fixed={1} step={0.5} on:change={(e) => updateValue("number", e)} />
        {:else if inputId === "strval"}
            <TextInput value={value?.value || ""} placeholder={$dictionary.inputs?.name} on:change={(e) => updateValue("value", e)} />
        {:else if inputId === "bolval"}
            {#if actionId === "lock_output" && value?.value === undefined}<p style="opacity: 0.8;font-size: 0.8em;"><T id="actions.toggle_checkbox_tip" /></p>{/if}
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
