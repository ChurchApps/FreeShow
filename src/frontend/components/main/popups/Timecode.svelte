<script lang="ts">
    import { onMount } from "svelte"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { timecode } from "../../../stores"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import { AudioMicrophone } from "../../../audio/audioMicrophone"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"

    const types = [
        { label: "Send", value: "send" },
        { label: "Receive", value: "receive" }
    ]

    const modes = [
        { label: "LTC (Linear Timecode)", value: "LTC" }
        // { label: "MTC (MIDI)", value: "MTC" },
        // { label: "Ableton", value: "ableton" }
    ]

    const frameratesList = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60]
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

    // audio outputs
    let audioOutputs: { value: string; label: string }[] = []
    let audioInputs: { value: string; label: string }[] = []
    onMount(async () => {
        audioOutputs = await AudioPlayer.getOutputs()
        audioInputs = (await AudioMicrophone.getList()).map((device) => ({ value: device.deviceId, label: device.label }))
    })
</script>

<MaterialDropdown label="sort.type" options={types} value={type} on:change={(e) => updateValue("type", e.detail)} />

<InputRow>
    <MaterialDropdown label="actions.mode" options={modes} value={mode} on:change={(e) => updateValue("mode", e.detail)} />

    {#if mode === "LTC"}
        {#if type === "send"}
            <MaterialDropdown label="audio.custom_output" options={audioOutputs} value={$timecode.audioOutput || ""} on:change={(e) => updateValue("audioOutput", e.detail)} allowEmpty />
        {:else}
            <MaterialDropdown label="live.microphones" options={audioInputs} value={$timecode.audioInput || ""} on:change={(e) => updateValue("audioInput", e.detail)} allowEmpty />
        {/if}
    {/if}
</InputRow>

{#if type === "send"}
    <MaterialDropdown label="settings.frame_rate" options={framerates} value={framerate.toString()} defaultValue="25" on:change={(e) => updateValue("framerate", Number(e.detail))} />
{/if}

<MaterialNumberInput label="edit.offset (ms)" value={offset} min={-60000} max={60000} step={100} defaultValue={0} on:change={(e) => updateValue("offset", e.detail)} />
