<script lang="ts">
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { audioChannelsData, audioRouting, popupData, special } from "../../../stores"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    const popupInfo = $popupData
    const nodeId = popupInfo?.nodeId
    popupData.set(null)

    $: channel = $audioRouting?.channels?.find((c) => c.id === nodeId)
    $: isChannelNode = !!channel || nodeId === "main" || nodeId?.startsWith("channel_")

    $: channelData = $audioChannelsData[nodeId] || {}
    $: rawVolume = Number(channelData.volume ?? 1)
    $: volumeValue = rawVolume > 5 ? rawVolume / 100 : rawVolume
    $: muted = !!channelData.isMuted

    $: delayMs = Number(channelData.delay ?? 0)

    function updateSpecial(value: any, key: string) {
        special.update((a) => {
            a[key] = value
            return a
        })
    }

    function updateChannelData(key: string, value: any) {
        audioChannelsData.update((a) => {
            if (!a[nodeId]) a[nodeId] = {}
            a[nodeId][key] = value
            return a
        })

        AudioPlayer.updateVolume()
    }
</script>

{#if nodeId === "icecast"}
    <InputRow>
        <MaterialTextInput label="IP" value={$special.icecastHost || "localhost"} on:change={(e) => updateSpecial(e.detail, "icecastHost")} />
        <MaterialNumberInput label="settings.port" value={$special.icecastPort ?? 8000} max={65535} min={1} step={1} on:change={(e) => updateSpecial(e.detail, "icecastPort")} />
    </InputRow>
    <MaterialTextInput label="Mountpoint" value={$special.icecastMount || "/stream.opus"} on:change={(e) => updateSpecial(e.detail, "icecastMount")} />
    <MaterialTextInput label="remote.password" type="password" value={$special.icecastPassword ?? "hackme"} defaultValue="hackme" on:change={(e) => updateSpecial(e.detail, "icecastPassword")} />
{:else if isChannelNode}
    <!-- this is the same options we find in the audio drawer -->
    <InputRow>
        <MaterialNumberInput label="media.volume (%)" value={Number((volumeValue * 100).toFixed(0))} min={0} max={125} step={1} defaultValue={100} on:change={(e) => updateChannelData("volume", e.detail / 100)} showSlider />
        <MaterialButton variant="outlined" icon={muted ? "muted" : "volume"} title="actions.{muted ? 'unmute' : 'mute'}" on:click={() => updateChannelData("isMuted", !muted)} red={muted} />
    </InputRow>

    <MaterialNumberInput label="audio.delay (ms)" value={delayMs} min={0} max={5000} step={10} defaultValue={0} on:change={(e) => updateChannelData("delay", e.detail)} showSlider />
{/if}
