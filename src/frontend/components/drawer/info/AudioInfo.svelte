<script lang="ts">
    import { onMount } from "svelte"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { activeAudioEffects, activePopup, special } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import AudioEffects from "../audio/AudioEffects.svelte"
    import AudioMixers from "../audio/AudioMixers.svelte"

    let settingsOpened = false

    function updateSpecial(value, key) {
        special.update((a) => {
            a[key] = value
            return a
        })

        // if (!value && key === "allowGaining") AudioPlayer.updateVolume()
    }

    // WIP add once electron is updated to >24
    // let audioOutputs = []
    // async function getAudioOutputs() {
    //     const devices = await navigator.mediaDevices.enumerateDevices()
    //     let outputs = devices.filter((device) => device.kind === "audiooutput")

    //     let defaultGroupId = outputs.find((a) => a.deviceId === "default")?.groupId
    //     if (defaultGroupId) outputs = outputs.filter((a) => a.groupId !== defaultGroupId || a.deviceId === "default")

    //     audioOutputs = [{ id: "", name: "—" }, ...outputs.map((device) => ({ id: device.deviceId, name: device.label }))]
    // }

    // audio outputs
    let audioOutputs: { value: string; label: string }[] = []
    onMount(async () => {
        audioOutputs = await AudioPlayer.getOutputs()
    })

    const audioChannels = [
        { value: "", label: "Stereo" },
        { value: "mono_left", label: "Mono left" },
        { value: "mono_right", label: "Mono right" }
    ]
</script>

<!-- TODO: effects?: https://alemangui.github.io/pizzicato/ -->

{#if settingsOpened}
    <main style="flex: 1;overflow-x: hidden;padding: 10px;">
        <MaterialNumberInput label="settings.audio_fade_duration (s)" value={$special.audio_fade_duration ?? 1.5} max={30} step={0.5} on:change={(e) => updateSpecial(e.detail, "audio_fade_duration")} />

        <!-- defaultValue={false}  -->
        <MaterialToggleSwitch label="audio.mute_when_video_plays" checked={$special.muteAudioWhenVideoPlays || false} on:change={(e) => updateSpecial(e.detail, "muteAudioWhenVideoPlays")} />
        <!-- <MaterialToggleSwitch label="audio.allow_gaining" checked={$special.allowGaining || false} on:change={(e) => updateSpecial(e.detail, "allowGaining")} /> -->
        <!-- ReplayGain enabled always as it uses audio metadata info -->
        <!-- <MaterialToggleSwitch label="ReplayGain" checked={$special.replayGain || false} on:change={(e) => updateSpecial(e.detail, "replayGain")} /> -->

        <MaterialDropdown label="audio.custom_output" options={audioOutputs} value={$special.audioOutput || ""} on:change={(e) => updateSpecial(e.detail, "audioOutput")} allowEmpty />
        <MaterialDropdown label="audio.channel" options={audioChannels} value={$special.audioChannel || ""} defaultValue="" on:change={(e) => updateSpecial(e.detail, "audioChannel")} />

        <MaterialButton variant="outlined" style="width: 100%;" on:click={() => activePopup.set("now_playing")}>
            <Icon id="document" />
            <T id="popup.now_playing" />
        </MaterialButton>
    </main>
{:else if $activeAudioEffects}
    <AudioEffects />
{:else}
    <AudioMixers />
{/if}

{#if !$activeAudioEffects}
    <FloatingInputs round>
        <MaterialButton isActive={settingsOpened} title="audio.settings" on:click={() => (settingsOpened = !settingsOpened)}>
            <Icon size={1.1} id="options" white={!settingsOpened} />
        </MaterialButton>
    </FloatingInputs>
{/if}
