<script lang="ts">
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { audioChannelsData, audioRouting, popupData, special } from "../../../stores"
    import { dbToGain, gainToDb, MIN_DB } from "../../../audio/dBUtils"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    const popupInfo = $popupData
    const nodeId = popupInfo?.nodeId
    popupData.set({})

    $: channel = $audioRouting?.channels?.find((c) => c.id === nodeId)
    $: isChannelNode = !!channel || nodeId === "main" || nodeId?.startsWith("channel_")

    $: channelData = $audioChannelsData[nodeId] || {}
    $: rawVolume = Number(channelData.volume ?? 1)
    $: volumeValue = rawVolume > 5 ? rawVolume / 100 : rawVolume
    $: dbValue = Math.max(MIN_DB, Math.min(6, gainToDb(volumeValue)))
    $: muted = !!channelData.isMuted

    $: delayMs = Number(channelData.delay ?? 0)

    function updateIcecast(key: string, value: any) {
        special.update((a) => {
            if (!a.icecast) a.icecast = {}
            a.icecast[key] = value
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
    <MaterialToggleSwitch label="settings.enabled" checked={$special.icecast?.enabled ?? true} on:change={(e) => updateIcecast("enabled", e.detail)} />
    <InputRow>
        <MaterialTextInput label="IP" value={$special.icecast?.host || "localhost"} on:change={(e) => updateIcecast("host", e.detail)} />
        <MaterialNumberInput label="settings.port" value={$special.icecast?.port ?? 8000} max={65535} min={1} step={1} on:change={(e) => updateIcecast("port", e.detail)} />
    </InputRow>
    <MaterialTextInput label="Mountpoint" value={$special.icecast?.mount || "/stream.opus"} on:change={(e) => updateIcecast("mount", e.detail)} />
    <MaterialTextInput label="remote.password" type="password" value={$special.icecast?.password ?? "hackme"} defaultValue="hackme" on:change={(e) => updateIcecast("password", e.detail)} />
{:else if isChannelNode}
    <!-- this is the same options we find in the audio drawer -->
    <InputRow>
        <MaterialNumberInput label="media.volume (dB)" value={Number(dbValue.toFixed(1))} min={MIN_DB} max={6} step={0.5} defaultValue={0} on:change={(e) => updateChannelData("volume", dbToGain(e.detail))} showSlider />
        <MaterialButton variant="outlined" icon={muted ? "muted" : "volume"} title="actions.{muted ? 'unmute' : 'mute'}" on:click={() => updateChannelData("isMuted", !muted)} red={muted} />
    </InputRow>

    <MaterialNumberInput label="audio.delay (ms)" value={delayMs} min={0} max={5000} step={10} defaultValue={0} on:change={(e) => updateChannelData("delay", e.detail)} showSlider />
{/if}
