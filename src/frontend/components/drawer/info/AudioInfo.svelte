<script lang="ts">
    import { onMount } from "svelte"
    import type { TabsObj } from "../../../../types/Tabs"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { AudioPlaylist } from "../../../audio/audioPlaylist"
    import { audioPlaylists, dictionary, drawerTabsData, playingMetronome, special } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import Tabs from "../../main/Tabs.svelte"
    import AudioMix from "../audio/AudioMix.svelte"
    import Metronome from "../audio/Metronome.svelte"

    let tabs: TabsObj = {
        mixer: { name: "audio.mixer", icon: "options" },
        metronome: { name: "audio.metronome", icon: "metronome" },
        // effects: { name: "items.effect", icon: "image" },
    }
    let active = Object.keys(tabs)[0]

    let settingsOpened: boolean = false

    const isChecked = (e: any) => e.target.checked

    function updateSpecial(value, key) {
        special.update((a) => {
            a[key] = value
            return a
        })

        if (!value && key === "allowGaining") AudioPlayer.updateVolume()
    }

    // WIP add once electron is updated to >24
    // let audioOutputs: any = []
    // async function getAudioOutputs() {
    //     const devices = await navigator.mediaDevices.enumerateDevices()
    //     let outputs = devices.filter((device) => device.kind === "audiooutput")

    //     let defaultGroupId = outputs.find((a) => a.deviceId === "default")?.groupId
    //     if (defaultGroupId) outputs = outputs.filter((a) => a.groupId !== defaultGroupId || a.deviceId === "default")

    //     audioOutputs = [{ id: "", name: "—" }, ...outputs.map((device) => ({ id: device.deviceId, name: device.label }))]
    // }

    // playlist
    $: activeTab = $drawerTabsData.audio?.activeSubTab || ""
    $: activePlaylist = $audioPlaylists[activeTab] || null
    $: isPlaylist = !!activePlaylist

    // metronome
    $: metronomeActive = $playingMetronome
    $: if (metronomeActive) active = "metronome"

    // audio outputs
    let audioOutputs: any[] = []
    onMount(() => {
        navigator.mediaDevices
            .enumerateDevices()
            .then((devices) => {
                // only get audio outputs & not "default" becuase that does not work
                const outputDevices = devices.filter((device) => device.kind === "audiooutput" && device.deviceId !== "default")
                audioOutputs = [{ id: "", name: "—" }, ...outputDevices.map((a) => ({ id: a.deviceId, name: a.label }))]
            })
            .catch((err) => {
                console.log(`${err.name}: ${err.message}`)
            })
    })
</script>

<!-- TODO: effects?: https://alemangui.github.io/pizzicato/ -->

{#if settingsOpened}
    <main style="flex: 1;overflow-x: hidden;padding: 10px;">
        <CombinedInput>
            <p title={$dictionary.settings?.audio_fade_duration}><T id="settings.audio_fade_duration" /></p>
            <NumberInput value={$special.audio_fade_duration ?? 1.5} max={30} step={0.5} decimals={1} fixed={1} on:change={(e) => updateSpecial(e.detail, "audio_fade_duration")} />
        </CombinedInput>

        <CombinedInput textWidth={70}>
            <p title={$dictionary.audio?.mute_when_video_plays}><T id="audio.mute_when_video_plays" /></p>
            <div class="alignRight">
                <Checkbox checked={$special.muteAudioWhenVideoPlays || false} on:change={(e) => updateSpecial(isChecked(e), "muteAudioWhenVideoPlays")} />
            </div>
        </CombinedInput>

        <CombinedInput textWidth={70}>
            <p title={$dictionary.audio?.allow_gaining_tip}><T id="audio.allow_gaining" /></p>
            <div class="alignRight">
                <Checkbox checked={$special.allowGaining || false} on:change={(e) => updateSpecial(isChecked(e), "allowGaining")} />
            </div>
        </CombinedInput>

        <CombinedInput textWidth={70}>
            <p title={$dictionary.audio?.pre_fader_volume_meter}><T id="audio.pre_fader_volume_meter" /></p>
            <div class="alignRight">
                <Checkbox checked={$special.preFaderVolumeMeter || false} on:change={(e) => updateSpecial(isChecked(e), "preFaderVolumeMeter")} />
            </div>
        </CombinedInput>

        <CombinedInput>
            <p title={$dictionary.audio?.custom_output}><T id="audio.custom_output" /></p>
            <Dropdown style="width: 100%;" options={audioOutputs} value={audioOutputs.find((a) => a.id === $special.audioOutput)?.name || "—"} on:click={(e) => updateSpecial(e.detail?.id, "audioOutput")} />
        </CombinedInput>

        {#if isPlaylist}
            <h5 style="border-bottom: 1px solid var(--secondary);margin-top: 10px;"><T id="audio.playlist_settings" /></h5>
            <!-- <h6><T id="audio.playlist_settings" /></h6> -->
            <CombinedInput>
                <p><T id="settings.audio_crossfade" /></p>
                <NumberInput value={activePlaylist?.crossfade || 0} max={30} step={0.5} decimals={1} fixed={1} on:change={(e) => AudioPlaylist.update(activeTab, "crossfade", e.detail)} />
            </CombinedInput>

            <!-- <CombinedInput>
                <p><T id="settings.custom_audio_output" /></p>
                <Dropdown options={audioOutputs} value={audioOutputs.find((a) => a.id === $special.audioOutput)?.name || "—"} on:click={(e) => updateSpecial(e.detail.id, "audioOutput")} />
            </CombinedInput> -->
        {/if}
    </main>
{:else}
    <Tabs {tabs} bind:active style="flex: 1;" />

    {#if active === "metronome"}
        <Metronome {audioOutputs} />
    {:else}
        <AudioMix />
    {/if}
{/if}

<Button style="width: 100%;" on:click={() => (settingsOpened = !settingsOpened)} center dark>
    <Icon id="settings" white={settingsOpened} right />
    <T id="audio.settings" />
    <!-- <Icon id="options" white={settingsOpened} right />
    <T id="edit.options" /> -->
</Button>

<style>
    h5 {
        overflow: visible;
        text-align: center;
        padding: 5px;
        background-color: var(--primary-darkest);
        color: var(--text);
        font-size: 0.8em;
        text-transform: uppercase;
    }

    /* h6 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    } */
</style>
