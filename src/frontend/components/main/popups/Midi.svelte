<script lang="ts">
    import { MAIN } from "../../../../types/Channels"
    import { popupData } from "../../../stores"
    import { receive, send } from "../../../utils/request"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    let id: string = ""
    $: if ($popupData.id) id = $popupData.id

    let midi: any = { name: "Send MIDI", output: "", type: "noteon", values: { note: 1, velocity: 1, channel: 1 } }
    $: if (id) midi = _show().get("midi")?.[id] || midi

    let types = [{ name: "noteon" }, { name: "noteoff" }]

    let outputs: any[] = []
    // request midi outputs
    send(MAIN, ["GET_MIDI_OUTPUTS"])
    receive(MAIN, {
        GET_MIDI_OUTPUTS: (msg) => {
            if (!msg.length) return
            outputs = msg.map((a) => ({ name: a }))
            if (!midi.output) midi.output = msg[0]
        },
    })

    // update show
    $: if (midi) saveMidi()

    function changeName(e: any) {
        midi.name = e.target.value
    }

    // TODO: midi input start slide...

    // TODO: history!
    function saveMidi() {
        let showMidi = _show().get("midi") || {}
        if (JSON.stringify(showMidi[id] || {}) === JSON.stringify(midi)) return
        showMidi[id] = midi

        _show().set({ key: "midi", value: showMidi })
    }
</script>

<div>
    <span>
        <p><T id="midi.name" /></p>
        <TextInput style="width: 70%;" value={midi.name} on:change={changeName} />
    </span>

    <span>
        <p><T id="midi.output" /></p>
        <Dropdown value={midi.output} options={outputs} on:click={(e) => (midi.output = e.detail.name)} />
    </span>

    <span>
        <p><T id="midi.type" /></p>
        <Dropdown value={midi.type} options={types} on:click={(e) => (midi.type = e.detail.name)} />
    </span>

    <span>
        <p><T id="midi.note" /></p>
        <NumberInput value={midi.values.note} max={127} on:change={(e) => (midi.values.note = e.detail)} />
    </span>
    <span>
        <p><T id="midi.velocity" /></p>
        <NumberInput value={midi.values.velocity} max={127} on:change={(e) => (midi.values.velocity = e.detail)} />
    </span>
    <span>
        <p><T id="midi.channel" /></p>
        <NumberInput value={midi.values.channel} max={15} on:change={(e) => (midi.values.channel = e.detail)} />
    </span>
</div>

<style>
    div {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    div span {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    div :global(.numberInput),
    div :global(.dropdownElem) {
        width: 70%;
    }
</style>
