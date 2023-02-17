<script lang="ts">
    import { MAIN } from "../../../../types/Channels"
    import { activeShow, midiIn, popupData } from "../../../stores"
    import { midiInListen } from "../../../utils/midi"
    import { receive, send } from "../../../utils/request"
    import { history } from "../../helpers/history"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    let id: string = ""
    $: if ($popupData.id) id = $popupData.id

    let midi: any = { name: "MIDI", type: "noteon", values: { note: 1, velocity: 1, channel: 1 } }
    $: if (id) setMidi()
    function setMidi() {
        if ($popupData.type === "in") midi = $midiIn[id] || midi
        else midi = _show().get("midi")?.[id] || midi
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
            if (msg.id === id) {
                console.log("YES", msg)
            }
        },
    })

    // update show
    $: if (midi) saveMidi()

    function changeName(e: any) {
        midi.name = e.target.value
    }

    // TODO: midi input start slide...

    // TODO: save to midiIn!
    // TODO: global overview in settings

    // TODO: history!
    function saveMidi() {
        if (!midi.name) return

        if ($popupData.type === "in") {
            midiIn.update((a) => {
                let shows = a[id]?.shows || []
                let showId = $activeShow!.id
                if (!shows.find((a) => a.id === showId)) shows.push({ id: showId })
                console.log(shows)
                a[id] = { ...midi, shows }
                return a
            })
        } else {
            let showMidi = _show().get("midi") || {}
            if (JSON.stringify(showMidi[id] || {}) === JSON.stringify(midi)) return
            showMidi[id] = midi

            _show().set({ key: "midi", value: showMidi })
        }
    }

    $: midiInOptions = Object.entries($midiIn).map(([id, value]) => ({ id, name: value.name }))

    // TODO: check if midiIn[id] dont has any shows, or delete current show, if so delete midiIn[id]
    function changeId(e: any) {
        if (!e.detail?.id) return
        if ($popupData.type !== "in") return

        // update show action id
        let ref = _show().layouts("active").ref()[0]
        let layoutSlide = ref[$popupData.index]
        console.log(layoutSlide)
        let actions = layoutSlide.data.actions || {}

        id = e.detail.id
        actions.receiveMidi = id

        history({
            id: "changeLayout",
            newData: { key: "actions", value: actions },
            location: { page: "show", show: $activeShow!, layoutSlide: $popupData.index, layout: _show().get("settings.activeLayout") },
        })

        midiInListen()
    }

    // jzz
    // import navigator from "jzz"
    // const onFail = function (err) {
    //     console.log(err)
    // }

    // const onSuccess = (midiAccess) => {
    //     setTimeout(() => {
    //         console.log(midiAccess)
    //         console.log(midiAccess.inputs.values())
    //         console.log([...midiAccess.inputs.values()])

    //         for (const input of midiAccess.inputs.values()) {
    //             console.log(input)

    //             input.onmidimessage = function (msg) {
    //                 console.log(msg)
    //             }
    //         }
    //     }, 500)
    // }
    // // Electron MIDI bug: when MIDIAccess is just open, inputs and outputs are empty.
    // navigator.requestMIDIAccess().then(onSuccess, onFail)
    // setTimeout(() => {
    //     navigator.requestMIDIAccess().then(onSuccess, onFail)
    // }, 500)

    // async function accessMIDI() {
    //     // await new Promise(function(resolve/*, reject*/) {
    //         navigator.requestMIDIAccess().then((onSuccess, onFail) => { setTimeout(resolve, 500); });
    //     // });
    // }
</script>

<div>
    {#if $popupData.type === "in"}
        <span class="id">
            <Dropdown value={midi.name || "—"} options={midiInOptions} on:click={changeId} />
        </span>
    {/if}

    <span>
        <p><T id="midi.name" /></p>
        <TextInput style="width: 70%;" value={midi.name} on:change={changeName} />
    </span>

    <span>
        {#if $popupData.type === "in"}
            <p><T id="midi.input" /></p>
            <Dropdown value={midi.input || "—"} options={inputs} on:click={(e) => (midi.input = e.detail.name)} />
        {:else}
            <p><T id="midi.output" /></p>
            <Dropdown value={midi.output || "—"} options={outputs} on:click={(e) => (midi.output = e.detail.name)} />
        {/if}
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
    div span.id :global(.dropdownElem) {
        width: 100%;
    }
</style>
