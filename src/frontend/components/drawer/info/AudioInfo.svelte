<script lang="ts">
    import { onMount } from "svelte"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { activeAudioEffects, activePopup, special } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import AudioEffects from "../audio/AudioEffects.svelte"
    import AudioMixers from "../audio/AudioMixers.svelte"

    // export let optionsOpen: boolean
    let settingsOpened = false

    function updateSpecial(value: any, key: any) {
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
        <MaterialDropdown label="audio.channel" style="margin-bottom: 10px;" options={audioChannels} value={$special.audioChannel || ""} defaultValue="" on:change={(e) => updateSpecial(e.detail, "audioChannel")} />

        <InputRow arrow={$special.icecastEnabled}>
            <MaterialToggleSwitch label="Icecast" style="width: 100%;" checked={$special.icecastEnabled || false} on:change={(e) => updateSpecial(e.detail, "icecastEnabled")} />
            <div slot="menu">
                <InputRow>
                    <MaterialTextInput label="IP" value={$special.icecastHost || "localhost"} on:change={(e) => updateSpecial(e.detail, "icecastHost")} />
                    <MaterialNumberInput label="settings.port" value={$special.icecastPort ?? 8000} max={65535} min={1} step={1} on:change={(e) => updateSpecial(e.detail, "icecastPort")} />
                </InputRow>
                <MaterialTextInput label="Mountpoint" value={$special.icecastMount || "/stream.opus"} on:change={(e) => updateSpecial(e.detail, "icecastMount")} />
                <MaterialTextInput label="remote.password" type="password" value={$special.icecastPassword || ""} on:change={(e) => updateSpecial(e.detail, "icecastPassword")} />
            </div>
        </InputRow>

        <MaterialButton variant="outlined" style="width: 100%;margin-top: 10px;" on:click={() => activePopup.set("now_playing")}>
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
