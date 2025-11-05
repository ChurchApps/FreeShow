<script lang="ts">
    import { outputs } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getActiveOutputs } from "../../helpers/output"
    import AudioChannelMixer from "./AudioChannelMixer.svelte"
    import AudioMixersGroup from "./AudioMixersGroup.svelte"

    const outputIds = getActiveOutputs($outputs, false, true, true)

    const mixerGroups = [
        {
            icon: "display_settings",
            label: "settings.display_settings",
            channels: outputIds.map((id) => ({ id, label: $outputs[id]?.name || id }))
        }
    ]
</script>

<div class="mixers">
    <AudioChannelMixer channelId="main" label={translateText("audio.main")} />

    {#each mixerGroups as group}
        <AudioMixersGroup label={group.label} icon={group.icon} channels={group.channels} />
    {/each}

    <!-- WIP microphones / audio streams / metronome / playing playlists -->
    <!-- music / sound effects -->
</div>

<style>
    .mixers {
        display: flex;
        flex-direction: column;
        gap: 5px;

        margin: 10px;
    }
</style>
