<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import { AudioMicrophone } from "../../../audio/audioMicrophone"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { requestMain } from "../../../IPC/main"
    import { timecode } from "../../../stores"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"

    const types = [
        { label: "Send", value: "send" },
        { label: "Receive", value: "receive" }
    ]

    const modes = [
        { label: "LTC (Linear Timecode)", value: "LTC" },
        { label: "MTC (MIDI Timecode)", value: "MTC" }
        // { label: "Ableton", value: "ableton" }
    ]

    const frameratesList = [24, 25, 29.97, 30] // [23.976, 24, 25, 29.97, 30, 50, 59.94, 60]
    const framerates = frameratesList.map((a) => ({ label: a.toString(), value: a.toString() }))

    function updateValue(key: string, value: any) {
        timecode.update((a) => {
            a[key] = value
            return a
        })
    }

    $: type = $timecode.type || "send"
    $: mode = $timecode.mode || "LTC"
    $: framerate = $timecode.framerate || 25
    $: offset = $timecode.offset || 0

    // I/O

    let audioOutputs: { value: string; label: string }[] = []
    let audioInputs: { value: string; label: string }[] = []
    let midiOutputs: { value: string; label: string }[] = []
    let midiInputs: { value: string; label: string }[] = []

    $: if (mode && type) getValues()
    async function getValues() {
        if (mode === "LTC") {
            if (type === "send") {
                if (audioOutputs.length) return
                audioOutputs = await AudioPlayer.getOutputs()
            } else {
                if (audioInputs.length) return
                audioInputs = (await AudioMicrophone.getList()).map((device) => ({ value: device.deviceId, label: device.label }))
            }
        } else if (mode === "MTC") {
            if (type === "send") {
                if (midiOutputs.length) return
                const data = await requestMain(Main.GET_MIDI_OUTPUTS)
                midiOutputs = data.map((a) => ({ value: a.name, label: a.name }))
            } else {
                if (midiInputs.length) return
                const data = await requestMain(Main.GET_MIDI_INPUTS)
                midiInputs = data.map((a) => ({ value: a.name, label: a.name }))
            }
        }
    }
</script>

<InputRow>
    <MaterialDropdown label="sort.type" options={types} value={type} on:change={(e) => updateValue("type", e.detail)} />

    {#if type === "send" || mode === "LTC"}
        <MaterialDropdown label="settings.frame_rate" options={framerates} value={framerate.toString()} defaultValue="25" on:change={(e) => updateValue("framerate", Number(e.detail))} />
    {/if}
</InputRow>

<InputRow style="margin-top: 10px;">
    <MaterialDropdown label="actions.mode" options={modes} value={mode} on:change={(e) => updateValue("mode", e.detail)} />

    {#if mode === "LTC"}
        {#if type === "send"}
            <MaterialDropdown label="audio.custom_output" options={audioOutputs} value={$timecode.audioOutput || ""} on:change={(e) => updateValue("audioOutput", e.detail)} allowEmpty />
        {:else}
            <MaterialDropdown label="live.microphones" options={audioInputs} value={$timecode.audioInput || ""} on:change={(e) => updateValue("audioInput", e.detail)} allowEmpty />
        {/if}
    {:else if mode === "MTC"}
        {#if type === "send"}
            <MaterialDropdown label="midi.output" value={$timecode.midiOutput || ""} options={midiOutputs} on:change={(e) => updateValue("midiOutput", e.detail)} allowEmpty />
        {:else}
            <MaterialDropdown label="midi.input" value={$timecode.midiInput || ""} options={midiInputs} on:change={(e) => updateValue("midiInput", e.detail)} allowEmpty />
        {/if}
    {/if}
</InputRow>

<MaterialNumberInput label="edit.offset (ms)" value={offset} min={-60000} max={60000} step={100} defaultValue={0} on:change={(e) => updateValue("offset", e.detail)} />
