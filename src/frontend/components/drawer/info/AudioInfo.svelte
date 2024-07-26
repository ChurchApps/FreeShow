<script lang="ts">
    import { onMount } from "svelte"
    import { audioPlaylists, dictionary, drawerTabsData, playingMetronome, special } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { updatePlaylist } from "../../helpers/audio"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import AudioMix from "../audio/AudioMix.svelte"
    import Metronome from "../audio/Metronome.svelte"

    let openedPage: "default" | "settings" | "metronome" = "default"
    function togglePage(pageId) {
        if (openedPage === pageId) openedPage = "default"
        else openedPage = pageId
    }

    const isChecked = (e: any) => e.target.checked

    function updateSpecial(value, key) {
        special.update((a) => {
            a[key] = value
            return a
        })
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
    $: active = $drawerTabsData.audio?.activeSubTab || ""
    $: activePlaylist = $audioPlaylists[active] || null
    $: isPlaylist = !!activePlaylist

    // metronome
    $: metronomeActive = !!$playingMetronome
    $: if (metronomeActive) openedPage = "metronome"

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

{#if openedPage === "settings"}
    <main style="flex: 1;overflow-x: hidden;">
        <CombinedInput>
            <p title={$dictionary.settings?.audio_fade_duration}><T id="settings.audio_fade_duration" /></p>
            <NumberInput value={$special.audio_fade_duration ?? 1.5} max={30} step={0.5} decimals={1} fixed={1} on:change={(e) => updateSpecial(e.detail, "audio_fade_duration")} />
        </CombinedInput>

        <CombinedInput>
            <p title={$dictionary.audio?.mute_when_video_plays}><T id="audio.mute_when_video_plays" /></p>
            <div class="alignRight">
                <Checkbox checked={$special.muteAudioWhenVideoPlays || false} on:change={(e) => updateSpecial(isChecked(e), "muteAudioWhenVideoPlays")} />
            </div>
        </CombinedInput>

        <CombinedInput>
            <p title={$dictionary.audio?.custom_output}><T id="audio.custom_output" /></p>
            <Dropdown style="width: 100%;" options={audioOutputs} value={audioOutputs.find((a) => a.id === $special.audioOutput)?.name || "—"} on:click={(e) => updateSpecial(e.detail?.id, "audioOutput")} />
        </CombinedInput>
    </main>
{:else if isPlaylist}
    <main style="flex: 1;">
        <CombinedInput>
            <p><T id="settings.audio_crossfade" /></p>
            <NumberInput value={activePlaylist?.crossfade || 0} max={30} step={0.5} decimals={1} fixed={1} on:change={(e) => updatePlaylist(active, "crossfade", e.detail)} />
        </CombinedInput>

        <!-- <CombinedInput>
        <p><T id="settings.custom_audio_output" /></p>
        <Dropdown options={audioOutputs} value={audioOutputs.find((a) => a.id === $special.audioOutput)?.name || "—"} on:click={(e) => updateSpecial(e.detail.id, "audioOutput")} />
    </CombinedInput> -->
    </main>
{:else if openedPage === "metronome"}
    <Metronome />
{:else}
    <AudioMix />
{/if}

{#if !isPlaylist}
    <Button style="width: 100%;" on:click={() => togglePage("metronome")} center dark>
        <Icon id="metronome" white={openedPage === "metronome"} right />
        <T id="audio.toggle_metronome" />
    </Button>
{/if}

<Button style="width: 100%;" on:click={() => togglePage("settings")} center dark>
    <Icon id="options" white={openedPage === "settings"} right />
    <T id="audio.settings" />
</Button>
