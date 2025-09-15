<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import { Main } from "../../../types/IPC/Main"
    import { requestMain } from "../../IPC/main"
    import { actions, activePopup, audioPlaylists, audioStreams, effects, groups, outputs, overlays, popupData, projects, shows, stageShows, styles, templates, timers, triggers, variables } from "../../stores"
    import { translateText } from "../../utils/language"
    import MetronomeInputs from "../drawer/audio/MetronomeInputs.svelte"
    import T from "../helpers/T.svelte"
    import { keysToID, sortByName } from "../helpers/array"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../inputs/MaterialTextInput.svelte"
    import ChooseEmitter from "./ChooseEmitter.svelte"
    import MidiValues from "./MidiValues.svelte"
    import RestValues from "./RestValues.svelte"
    import ChooseStyle from "./specific/ChooseStyle.svelte"
    import VariableInputs from "./specific/VariableInputs.svelte"
    import { getGlobalGroupName } from "../show/tools/groups"

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

        updateValue("value", { detail: value })
    }

    $: if (list && actionId === "start_show" && !value?.id) openSelectShow()
    function openSelectShow() {
        popupData.set({ ...$popupData, action: "select_show", revert: $activePopup, active: value?.id, actionIndex })
        activePopup.set("select_show")
    }

    let cameras: { label: string; id: string; groupId: string }[] = []
    if (inputId === "camera") getCameras()
    function getCameras() {
        navigator.mediaDevices?.enumerateDevices()?.then((devices) => {
            if (!devices) return
            let cameraList = devices.filter((a) => a.kind === "videoinput").map((a) => ({ label: a.label, id: a.deviceId, groupId: a.groupId }))
            cameras = sortByName(cameraList, "label")
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

    function convertToOptions(a) {
        const options = Object.keys(a).map((id) => ({ value: id, label: a[id].name }))
        return sortByName(options, "label")
    }

    const getOptions = {
        id_select_project: () => convertToOptions($projects),
        id_select_group: () =>
            sortByName(
                Object.keys($groups).map((id) => ({ value: id, label: getGlobalGroupName(id) })),
                "label"
            ),
        clear_overlay: () => [...convertToOptions($overlays), ...convertToOptions($effects)],
        id_start_effect: () => convertToOptions($effects),
        id_select_overlay: () => convertToOptions($overlays),
        id_select_stage_layout: () => convertToOptions($stageShows),
        normal_outputs: () => [{ value: "", label: translateText("actions.all_outputs") }, ...sortByName(keysToID($outputs).filter((a) => !a.stageOutput)).map((a) => ({ value: a.id, label: a.name }), "label")],
        output_lock: () => [{ value: "", label: translateText("preview.lock") }, { value: "all", label: translateText("actions.all_outputs") }, ...getOptions.normal_outputs().slice(1)],
        stage_outputs: () => [{ value: "", label: translateText("actions.all_outputs") }, ...sortByName(keysToID($outputs).filter((a) => a.stageOutput)).map((a) => ({ value: a.id, label: a.name }), "label")],
        start_audio_stream: () => convertToOptions($audioStreams),
        start_playlist: () => convertToOptions($audioPlaylists),
        id_select_output_style: () => [{ value: null, label: "—" }, ...convertToOptions($styles)],
        change_output_style: () => convertToOptions($styles),
        id_start_timer: () => convertToOptions($timers),
        variable: () => convertToOptions($variables), // .map((a) => ({...a, type: $variables[a.id]?.type}))
        start_trigger: () => convertToOptions($triggers),
        // WIP remove all actions that reference this action and so on - to prevent infinite loop
        run_action: () => convertToOptions($actions).filter((a) => a.label && a.value !== mainId),
        set_template: () => convertToOptions($templates),
        toggle_output: () => convertToOptions($outputs)
    }

    $: options = getOptions[actionId]?.() || []
</script>

{#if inputId === "output_style" || value?.outputStyle || value?.styleOutputs}
    <!-- deprecated -->
    <ChooseStyle value={value || {}} on:change={(e) => updateValue("", e)} />
{:else if inputId === "change_output_style"}
    <MaterialDropdown label="stage.output" options={getOptions.normal_outputs()} value={value?.outputId || ""} on:change={(e) => updateValue("outputId", e.detail)} />
    <MaterialDropdown label="edit.style" options={getOptions.change_output_style()} value={value?.styleId} on:change={(e) => updateValue("styleId", e.detail)} allowEmpty />
{:else if inputId === "stage_output_layout"}
    <MaterialDropdown label="stage.output" options={getOptions.stage_outputs()} value={value?.outputId || ""} on:change={(e) => updateValue("outputId", e.detail)} />
    <MaterialDropdown label="stage.stage_layout" options={getOptions.id_select_stage_layout()} value={value?.stageLayoutId} on:change={(e) => updateValue("stageLayoutId", e.detail)} />
{:else if inputId === "camera"}
    <MaterialDropdown
        label="items.camera"
        options={cameras.map((a) => ({ value: a.id, label: a.label }))}
        value={value?.id}
        on:change={(e) => {
            const cam = cameras.find((a) => a.id === e.detail)
            updateValue("", cam)
        }}
    />
{:else if inputId === "screen"}
    <MaterialDropdown
        label="items.screen"
        options={screens.map((a) => ({ value: a.id, label: a.name }))}
        value={value?.id}
        on:change={(e) => {
            const screen = screens.find((a) => a.id === e.detail)
            updateValue("", screen)
        }}
    />
{:else if inputId === "midi"}
    <!-- deprecated -->
    <MidiValues value={value?.midi || {}} type="output" on:change={(e) => updateValue("midi", e)} />
{:else if inputId === "metronome"}
    <MetronomeInputs values={value || { tempo: 120, beats: 4 }} on:change={(e) => updateValue("", e)} action />
{:else if inputId === "variable"}
    <VariableInputs {value} on:update={(e) => updateValue(e.detail?.key, e.detail?.value)} />
{:else if inputId === "toggle_action"}
    <MaterialDropdown label="popup.action" options={getOptions.run_action()} value={value?.id} on:change={(e) => updateValue("id", e.detail)} />
    <MaterialDropdown label="variables.value" options={stateOptions} value={typeof value?.value === "boolean" ? (value.value ? "on" : "off") : ""} on:change={textStateChange} />
{:else if inputId === "rest"}
    <!-- deprecated -->
    <RestValues value={value || {}} on:change={(e) => updateValue("", e)} />
{:else if inputId === "emitter"}
    <ChooseEmitter value={value || {}} on:change={(e) => updateValue("", e)} />
{:else if inputId === "start_show"}
    <MaterialButton variant="outlined" style="width: 100%;" on:click={openSelectShow}>
        {#if value?.id}
            {$shows[value.id]?.name || "—"}
        {:else}
            <T id="popup.select_show" />
        {/if}
    </MaterialButton>
{:else if inputId === "number"}
    <!-- action wait (seconds) -->
    <MaterialNumberInput label="timer.seconds" value={value?.number || 0} step={0.5} on:change={(e) => updateValue("number", e)} />
{:else if inputId === "index"}
    <!-- run by index -->
    <MaterialNumberInput label="variables.value" value={value?.index || 0} on:change={(e) => updateValue("index", e)} />
{:else if inputId === "strval"}
    <!-- run by name -->
    <MaterialTextInput label="inputs.name" value={value?.value || ""} on:change={(e) => updateValue("value", e)} />
{:else if inputId === "output_lock"}
    <MaterialDropdown label="stage.output" options={getOptions.output_lock()} value={value?.outputId || ""} on:change={(e) => updateValue("outputId", e.detail)} />
    <MaterialDropdown label="variables.value" options={stateOptions} value={typeof value?.value === "boolean" ? (value.value ? "on" : "off") : ""} on:change={textStateChange} />
{:else if inputId === "id"}
    {#if options.length || getOptions[actionId]}
        <MaterialDropdown label="variables.value" {options} value={value?.id} on:change={(e) => updateValue("id", e.detail)} />
    {/if}
{:else if inputId === "volume"}
    <!-- gain can also be set -->
    <MaterialNumberInput label="variables.value" value={Number(((value?.volume ?? 1) * 100).toFixed(2))} min={0} max={100} on:change={(e) => updateValue("volume", e.detail / 100)} />
{:else if inputId === "transition"}
    <!-- transition -->
{:else if inputId === "variable"}
    <!-- variable -->
{/if}
