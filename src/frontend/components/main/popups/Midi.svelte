<script lang="ts">
    import { MAIN } from "../../../../types/Channels"
    import { activeShow, popupData } from "../../../stores"
    import { receive, send } from "../../../utils/request"
    import { history } from "../../helpers/history"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    $: layoutSlideIndex = $popupData.index || 0
    $: layoutSlideRef = _show().layouts("active").ref()[0][layoutSlideIndex]

    // TODO: ID!!! (drag and drop to other slides...??)
    // let id: string = uid()

    let midi: any = { name: "Send MIDI", output: "", type: "noteon", values: { note: 1, velocity: 1, channel: 1 } }
    $: if (layoutSlideRef.data.actions?.sendMidi) midi = layoutSlideRef.data.actions?.sendMidi

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
    $: if (midi) {
        let actions = layoutSlideRef.data.actions || {}
        actions.sendMidi = midi
        history({
            id: "changeLayout",
            newData: { key: "actions", value: actions },
            location: { page: "show", show: $activeShow!, layoutSlide: $popupData.index, layout: _show().get("settings.activeLayout") },
        })
    }

    function changeName(e: any) {
        midi.name = e.target.value
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
