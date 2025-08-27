<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte"
    import { Main } from "../../../types/IPC/Main"
    import { ToMain } from "../../../types/IPC/ToMain"
    import { destroyMain, receiveToMain, requestMain } from "../../IPC/main"
    import { popupData } from "../../stores"
    import T from "../helpers/T.svelte"
    import InputRow from "../input/InputRow.svelte"
    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../inputs/MaterialToggleSwitch.svelte"
    import type { API_midi } from "./api"
    import { defaultMidiActionChannels, midiToNote } from "./midi"

    export let value: API_midi
    export let firstActionId = ""
    export let type: "input" | "output" | "emitter" = "input"
    export let playSlide = false
    export let simple = false
    $: midi = value

    $: hasActions = !!firstActionId

    function setValues(key: string, value: any) {
        if (!midi.values) midi.values = { note: 0, velocity: type === "input" ? -1 : 0, channel: 1 }
        midi.values[key] = value
        change()
    }
    function setMidi(key: string, value: any) {
        // fix: https://github.com/ChurchApps/FreeShow/issues/1672
        if (value === "input") return

        midi[key] = value
        change()
    }

    let dispatch = createEventDispatcher()
    function change() {
        dispatch("change", midi)
    }

    let types = [
        { value: "noteon", label: "noteon" },
        { value: "noteoff", label: "noteoff" },
        { value: "control", label: "control" }
    ]

    let inputs: any[] = [{ name: "—" }]
    let outputs: any[] = [{ name: "—" }]
    // request midi inputs/outputs
    $: if (type) requestData()
    function requestData() {
        if (type === "input") {
            requestMain(Main.GET_MIDI_INPUTS, undefined, (data) => {
                if (!data.length) return
                inputs = data
                if (!midi.input) midi.input = data[0]?.name

                setInitialData()
            })
        } else {
            requestMain(Main.GET_MIDI_OUTPUTS, undefined, (data) => {
                if (!data.length) return
                outputs = data
                if (!midi.output) midi.output = data[0]?.name

                setInitialData()
            })
        }
    }

    function setInitialData() {
        // set initial data
        console.log(midi)
        if (midi.values?.note) return

        setTimeout(() => setValues("note", 0), 50)
    }

    let listenerId = receiveToMain(ToMain.RECEIVE_MIDI2, (data) => {
        if (!autoValues || !data) return
        if (data.id === $popupData.id && data.type === midi.type) {
            midi.values = data.values
            if (firstActionId.includes("index_")) midi.values.velocity = -1
        }
    })
    onDestroy(() => destroyMain(listenerId))

    let autoValues = false
    function toggleAutoValues(e: any) {
        autoValues = e.target.checked

        change()
    }

    function toggleDefaultValues(e: any) {
        midi.defaultValues = e.detail

        if (midi.defaultValues && defaultMidiActionChannels[firstActionId]) {
            midi = { ...midi, ...defaultMidiActionChannels[firstActionId] }
        }

        change()
    }

    $: noActionOrDefaultValues = type !== "emitter" && (!hasActions || (midi.defaultValues && defaultMidiActionChannels[firstActionId]))
</script>

{#if type !== "emitter"}
    {#if type === "input"}
        <MaterialDropdown label="midi.input" value={midi.input || ""} options={inputs} on:click={(e) => setMidi("input", e.detail)} />
    {:else}
        <MaterialDropdown label="midi.output" value={midi.output || ""} options={outputs} on:click={(e) => setMidi("output", e.detail)} />
    {/if}

    {#if type !== "output" && !simple}
        <br />
    {/if}
{/if}

{#if hasActions && midi.type !== "control"}
    <MaterialToggleSwitch label="midi.use_default_values" disabled={midi.defaultValues && !defaultMidiActionChannels[firstActionId]} checked={midi.defaultValues} on:change={toggleDefaultValues} />
{/if}

{#if !noActionOrDefaultValues}
    <MaterialToggleSwitch label="midi.auto_values" checked={autoValues} on:change={toggleAutoValues} />
{/if}

{#if type !== "emitter"}
    <MaterialDropdown label="midi.type" disabled={noActionOrDefaultValues && type !== "output" && !playSlide} value={midi.type || "noteon"} options={types} on:click={(e) => setMidi("type", e.detail)} />
{/if}

{#if midi.type === "control"}
    <MaterialNumberInput label="midi.controller" value={midi.values?.controller || 0} max={127} on:change={(e) => setValues("controller", e.detail)} />
    <MaterialNumberInput label="variables.value" value={midi.values?.value || 0} max={127} on:change={(e) => setValues("value", e.detail)} />
{:else}
    <MaterialNumberInput
        label="midi.note <span style='color: var(--text);opacity: 0.5;font-weight: normal;font-size: 0.8em;margin-left: 10px;'>{midiToNote(midi.values?.note ?? 0)}</span>"
        disabled={noActionOrDefaultValues && type !== "output" && !playSlide}
        value={midi.values?.note || 0}
        max={127}
        on:change={(e) => setValues("note", e.detail)}
    />

    {#if (!noActionOrDefaultValues && firstActionId?.includes("index_")) || type === "output" || type === "emitter" || playSlide}
        {#if type === "input"}
            <InputRow>
                <p style="font-size: 0.7em;opacity: 0.8;">
                    <T id="midi.tip_velocity" />
                </p>
            </InputRow>
        {/if}
        <MaterialNumberInput label="midi.velocity" value={midi.values?.velocity ?? (type === "input" ? -1 : 0)} min={type === "input" ? -1 : 0} max={127} on:change={(e) => setValues("velocity", e.detail)} />
    {/if}
{/if}
<MaterialNumberInput label="midi.channel" disabled={noActionOrDefaultValues && type !== "output" && !playSlide} value={midi.values?.channel ?? 1} min={1} max={16} on:change={(e) => setValues("channel", e.detail)} />
