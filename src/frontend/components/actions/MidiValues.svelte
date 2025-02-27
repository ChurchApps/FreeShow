<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte"
    import { MAIN } from "../../../types/Channels"
    import { popupData } from "../../stores"
    import { destroy, receive, send } from "../../utils/request"
    import T from "../helpers/T.svelte"
    import Checkbox from "../inputs/Checkbox.svelte"

    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"
    import NumberInput from "../inputs/NumberInput.svelte"
    import { defaultMidiActionChannels, midiToNote } from "./midi"
    import { uid } from "uid"
    import type { API_midi } from "./api"

    export let value: API_midi
    export let firstActionId: string = ""
    export let type: "input" | "output" = "input"
    export let playSlide: boolean = false
    export let simple: boolean = false
    $: midi = value

    $: hasActions = !!firstActionId

    function setValues(key: string, value: any) {
        if (!midi.values) midi.values = { note: 0, velocity: type === "input" ? -1 : 0, channel: 1 }
        midi.values[key] = value
        change()
    }
    function setMidi(key: string, value: any) {
        midi[key] = value
        change()
    }

    let dispatch = createEventDispatcher()
    function change() {
        dispatch("change", midi)
    }

    let types = [{ name: "noteon" }, { name: "noteoff" }]

    let inputs: any[] = [{ name: "—" }]
    let outputs: any[] = [{ name: "—" }]
    // request midi inputs/outputs
    $: if (type) requestData()
    function requestData() {
        if (type === "input") {
            send(MAIN, ["GET_MIDI_INPUTS"])
        } else {
            send(MAIN, ["GET_MIDI_OUTPUTS"])
        }
    }

    function setInitialData() {
        // set initial data
        console.log(midi)
        if (midi.values?.note) return

        setTimeout(() => setValues("note", 0), 50)
    }

    let id = uid()
    receive(
        MAIN,
        {
            GET_MIDI_OUTPUTS: (msg) => {
                if (!msg.length) return
                outputs = msg.map((a) => ({ name: a }))
                if (!midi.output) midi.output = msg[0]

                setInitialData()
            },
            GET_MIDI_INPUTS: (msg) => {
                if (!msg.length) return
                inputs = msg.map((a) => ({ name: a }))
                if (!midi.input) midi.input = msg[0]

                setInitialData()
            },
            RECEIVE_MIDI: (msg) => {
                if (!autoValues) return
                if (msg.id === $popupData.id && msg.type === midi.type) {
                    midi.values = msg.values
                    if (firstActionId.includes("index_")) midi.values.velocity = -1
                }
            },
        },
        id
    )
    onDestroy(() => destroy(MAIN, id))

    let autoValues: boolean = false
    function toggleAutoValues(e: any) {
        autoValues = e.target.checked

        change()
    }

    function toggleDefaultValues(e: any) {
        midi.defaultValues = e.target.checked

        if (midi.defaultValues && defaultMidiActionChannels[firstActionId]) {
            midi = { ...midi, ...defaultMidiActionChannels[firstActionId] }
        }

        change()
    }

    $: noActionOrDefaultValues = !hasActions || (midi.defaultValues && defaultMidiActionChannels[firstActionId])
</script>

<CombinedInput>
    {#if type === "input"}
        <p><T id="midi.input" /></p>
        <Dropdown value={midi.input || "—"} options={inputs} on:click={(e) => setMidi("input", e.detail.name)} />
    {:else}
        <p><T id="midi.output" /></p>
        <Dropdown value={midi.output || "—"} options={outputs} on:click={(e) => setMidi("output", e.detail.name)} />
    {/if}
</CombinedInput>

{#if type !== "output" && !simple}
    <br />
{/if}

{#if hasActions}
    <CombinedInput>
        <p><T id="midi.use_default_values" /></p>
        <div class="alignRight">
            <Checkbox disabled={midi.defaultValues && !defaultMidiActionChannels[firstActionId]} checked={midi.defaultValues} on:change={toggleDefaultValues} />
        </div>
    </CombinedInput>
{/if}

{#if !noActionOrDefaultValues}
    <CombinedInput>
        <p><T id="midi.auto_values" /></p>
        <div class="alignRight">
            <Checkbox checked={autoValues} on:change={toggleAutoValues} />
        </div>
    </CombinedInput>
{/if}

<CombinedInput>
    <p><T id="midi.type" /></p>
    <Dropdown value={midi.type || "noteon"} options={types} on:click={(e) => setMidi("type", e.detail.name)} disabled={noActionOrDefaultValues && type !== "output" && !playSlide} />
</CombinedInput>

<CombinedInput>
    <p>
        <T id="midi.note" />
        <span style="opacity: 0.7;padding: 0 10px;display: flex;align-items: center;">{midiToNote(midi.values?.note ?? 0)}</span>
    </p>
    <NumberInput value={midi.values?.note ?? 0} max={127} on:change={(e) => setValues("note", Number(e.detail))} disabled={noActionOrDefaultValues && type !== "output" && !playSlide} />
</CombinedInput>
{#if (!noActionOrDefaultValues && firstActionId?.includes("index_")) || type === "output" || playSlide}
    {#if type === "input"}
        <CombinedInput>
            <p style="font-size: 0.7em;opacity: 0.8;">
                <T id="midi.tip_velocity" />
            </p>
        </CombinedInput>
    {/if}
    <CombinedInput>
        <p><T id="midi.velocity" /></p>
        <NumberInput value={midi.values?.velocity ?? (type === "input" ? -1 : 0)} min={type === "input" ? -1 : 0} max={127} on:change={(e) => setValues("velocity", Number(e.detail))} />
    </CombinedInput>
{/if}
<CombinedInput>
    <p><T id="midi.channel" /></p>
    <NumberInput value={midi.values?.channel ?? 1} min={1} max={16} on:change={(e) => setValues("channel", Number(e.detail))} disabled={noActionOrDefaultValues && type !== "output" && !playSlide} />
</CombinedInput>
