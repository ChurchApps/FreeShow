<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { MAIN } from "../../../types/Channels"
    import { popupData } from "../../stores"
    import { receive, send } from "../../utils/request"
    import T from "../helpers/T.svelte"
    import Checkbox from "../inputs/Checkbox.svelte"

    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"
    import NumberInput from "../inputs/NumberInput.svelte"
    import { defaultMidiActionChannels, midiActions, midiToNote } from "./midi"

    export let midi

    $: if (midi) change()
    let dispatch = createEventDispatcher()
    function change() {
        dispatch("change", midi)
    }

    let types = [{ name: "noteon" }, { name: "noteoff" }]

    let inputs: any[] = [{ name: "—" }]
    let outputs: any[] = [{ name: "—" }]
    // request midi inputs/outputs
    $: if ($popupData.type === "in") {
        send(MAIN, ["GET_MIDI_INPUTS"])
    } else {
        send(MAIN, ["GET_MIDI_OUTPUTS"])
    }

    receive(MAIN, {
        GET_MIDI_OUTPUTS: (msg) => {
            if (!msg.length) return
            outputs = msg.map((a) => ({ name: a }))
            if (!midi.output) midi.output = msg[0]
        },
        GET_MIDI_INPUTS: (msg) => {
            if (!msg.length) return
            inputs = msg.map((a) => ({ name: a }))
            if (!midi.input) midi.input = msg[0]
        },
        RECEIVE_MIDI: (msg) => {
            if (!autoValues) return
            if (msg.id === $popupData.id && msg.type === midi.type) {
                midi.values = msg.values
                if (midi.action.includes("index_")) midi.values.velocity = -1
            }
        },
    })

    let autoValues: boolean = false
    function toggleAutoValues(e: any) {
        autoValues = e.target.checked
    }

    function toggleDefaultValues(e: any) {
        midi.defaultValues = e.target.checked

        if (midi.defaultValues && defaultMidiActionChannels[midi.action]) {
            midi = { ...midi, ...defaultMidiActionChannels[midi.action] }
        }
    }

    // TODO: delete unused midi in actions, that are created when adding a new one

    // $: midiInOptions = Object.entries($midiIn)
    //     .filter(([_id, value]) => !value.action)
    //     .map(([id, value]) => ({ id, name: value.name }))

    // function changeId(e: any) {
    //     if (!e.detail?.id) return
    //     if ($popupData.type !== "in") return
    //     if ($popupData.index === undefined) return

    //     // update show action id
    //     let ref = _show().layouts("active").ref()[0]
    //     let layoutSlide = ref[$popupData.index]
    //     let actions = layoutSlide.data.actions || {}

    //     id = e.detail.id
    //     actions.receiveMidi = id

    //     let override = "show#" + $activeShow?.id + "layout#" + _show().get("settings.activeLayout") + "index#" + $popupData.index
    //     history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: [$popupData.index] }, location: { page: "show", override } })

    //     midiInListen()
    // }

    $: canHaveAction = $popupData.action || midi.action
    if ($popupData.action) midi.action = Object.keys(midiActions)[0] || ""
    $: notActionOrDefaultValues = canHaveAction ? midi.defaultValues : false
</script>

<h3 style="margin-top: 10px;">
    <T id="midi.midi" />
</h3>

<CombinedInput>
    {#if $popupData.type === "in"}
        <p><T id="midi.input" /></p>
        <Dropdown value={midi.input || "—"} options={inputs} on:click={(e) => (midi.input = e.detail.name)} />
    {:else}
        <p><T id="midi.output" /></p>
        <Dropdown value={midi.output || "—"} options={outputs} on:click={(e) => (midi.output = e.detail.name)} />
    {/if}
</CombinedInput>

<br />

{#if canHaveAction}
    <CombinedInput>
        <p><T id="midi.use_default_values" /></p>
        <div class="alignRight">
            <Checkbox checked={midi.defaultValues} on:change={toggleDefaultValues} />
        </div>
    </CombinedInput>
{/if}

{#if !notActionOrDefaultValues}
    <CombinedInput>
        <p><T id="midi.auto_values" /></p>
        <div class="alignRight">
            <Checkbox checked={autoValues} on:change={toggleAutoValues} />
        </div>
    </CombinedInput>

    {#if $popupData.type === "in" && !midi.action?.includes("index_")}
        <CombinedInput>
            <p style="font-size: 0.7em;opacity: 0.8;">
                <T id="midi.tip_velocity" />
            </p>
        </CombinedInput>
    {/if}
{/if}

<CombinedInput>
    <p><T id="midi.type" /></p>
    <Dropdown value={midi.type} options={types} on:click={(e) => (midi.type = e.detail.name)} disabled={notActionOrDefaultValues} />
</CombinedInput>

<CombinedInput>
    <p>
        <T id="midi.note" />
        <span style="opacity: 0.7;padding: 0 10px;display: flex;align-items: center;">{midiToNote(midi.values.note)}</span>
    </p>
    <NumberInput value={midi.values.note} max={127} on:change={(e) => (midi.values.note = Number(e.detail))} disabled={notActionOrDefaultValues} />
</CombinedInput>
{#if !notActionOrDefaultValues && !midi.action?.includes("index_")}
    <CombinedInput>
        <p><T id="midi.velocity" /></p>
        <NumberInput value={midi.values.velocity} min={$popupData.type === "in" ? -1 : 0} max={127} on:change={(e) => (midi.values.velocity = Number(e.detail))} />
    </CombinedInput>
{/if}
<CombinedInput>
    <p><T id="midi.channel" /></p>
    <NumberInput value={midi.values.channel} max={255} on:change={(e) => (midi.values.channel = Number(e.detail))} disabled={notActionOrDefaultValues} />
</CombinedInput>

<style>
    h3 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }
</style>
