<script lang="ts">
    import { AudioMicrophone } from "../../../audio/audioMicrophone"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { dbToGain, gainToDb, MIN_DB } from "../../../audio/dBUtils"
    import { audioChannelsData, audioRouting, popupData, special } from "../../../stores"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    const popupInfo = $popupData
    const nodeId = popupInfo?.nodeId
    const nodeType = popupInfo?.type
    const initialChannels = popupInfo?.channels
    popupData.set({})

    $: channel = $audioRouting?.channels?.find((c) => c.id === nodeId)
    $: isChannelNode = !!channel || nodeId === "main" || nodeId?.startsWith("channel_")
    // mic
    $: isMicNode = nodeType === "mic" || nodeId?.startsWith("mic_sub_")
    $: deviceId = isMicNode ? (nodeId?.startsWith("mic_sub_") ? nodeId.slice(8) : nodeId) : ""
    $: configuredItem = $audioRouting?.inputs?.find((i) => i.id === nodeId || i.id === deviceId || i.deviceId === deviceId)
    $: micChannels = configuredItem?.channels ?? initialChannels ?? 2

    $: channelData = $audioChannelsData[nodeId] || {}
    $: rawVolume = Number(channelData.volume ?? 1)
    $: volumeValue = rawVolume > 5 ? rawVolume / 100 : rawVolume
    $: dbValue = Math.max(MIN_DB, Math.min(6, gainToDb(volumeValue)))
    $: muted = !!channelData.isMuted

    $: fadeDuration = Number(channelData.fadeDuration ?? 250)

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

    function updateMicChannels(count: number) {
        const val = Math.max(1, Math.min(32, Math.round(count) || 2))
        audioRouting.update((c) => {
            if (!c) c = { channels: [], connections: [] }
            if (!c.inputs) c.inputs = []
            const existing = c.inputs.find((i) => i.id === nodeId || i.id === deviceId || i.deviceId === deviceId)
            if (existing) {
                existing.channels = val
            } else {
                c.inputs.push({
                    id: nodeId,
                    name: popupInfo?.name || "Microphone",
                    type: "mic",
                    deviceId,
                    channels: val
                })
            }
            return { ...c }
        })
        if (deviceId) {
            AudioMicrophone.setChannelCount(deviceId, val)
        }
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

    <MaterialNumberInput label="audio.volume_fade_duration (ms)" value={fadeDuration} min={0} max={5000} step={50} defaultValue={250} on:change={(e) => updateChannelData("fadeDuration", e.detail)} showSlider />

    <MaterialNumberInput label="audio.delay (ms)" value={delayMs} min={0} max={5000} step={10} defaultValue={0} on:change={(e) => updateChannelData("delay", e.detail)} showSlider />
{:else if isMicNode}
    <MaterialNumberInput label="audio.channels" value={micChannels} min={1} max={32} step={1} defaultValue={2} on:change={(e) => updateMicChannels(e.detail)} />
{/if}
