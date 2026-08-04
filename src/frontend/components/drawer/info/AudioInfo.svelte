<script lang="ts">
    import { activeAudioEffects, activePopup, special } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import AudioEffects from "../audio/AudioEffects.svelte"
    import AudioMixers from "../audio/AudioMixers.svelte"

    // export let optionsOpen: boolean
    let settingsOpened = false

    function updateSpecial(value, key) {
        special.update((a) => {
            a[key] = value
            return a
        })

        // if (!value && key === "allowGaining") AudioPlayer.updateVolume()
    }
</script>

{#if settingsOpened}
    <main style="flex: 1;overflow-x: hidden;padding: 10px;">
        <MaterialNumberInput label="settings.audio_fade_duration (s)" value={$special.audio_fade_duration ?? 1.5} max={30} step={0.5} on:change={(e) => updateSpecial(e.detail, "audio_fade_duration")} />

        <!-- defaultValue={false}  -->
        <MaterialToggleSwitch label="audio.mute_when_video_plays" checked={$special.muteAudioWhenVideoPlays || false} on:change={(e) => updateSpecial(e.detail, "muteAudioWhenVideoPlays")} />
        <!-- <MaterialToggleSwitch label="audio.allow_gaining" checked={$special.allowGaining || false} on:change={(e) => updateSpecial(e.detail, "allowGaining")} /> -->
        <!-- ReplayGain enabled always as it uses audio metadata info -->
        <!-- <MaterialToggleSwitch label="ReplayGain" checked={$special.replayGain || false} on:change={(e) => updateSpecial(e.detail, "replayGain")} /> -->

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
