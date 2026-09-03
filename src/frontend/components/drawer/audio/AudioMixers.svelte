<script lang="ts">
    import { audioRouting, outputs } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { keysToID } from "../../helpers/array"
    import { AudioRoutingManager } from "../../../audio/routing/audioRoutingManager"
    import AudioChannelMixer from "./AudioChannelMixer.svelte"

    $: sortedConfig = AudioRoutingManager.sortChannels($audioRouting || { channels: [{ id: "main", name: translateText("audio.main") }], connections: [] })
    $: channels = sortedConfig.channels
    // $: connections = sortedConfig.connections

    $: inactiveOutputIds = keysToID($outputs).filter((a) => !a.enabled)
</script>

<div class="mixers">
    {#each channels as channel (channel.id)}
        {@const disabledOutput = inactiveOutputIds.some((a) => `channel_${a.id}` === channel.id)}
        <!-- we don't need to disable unconnected channels now that we can Record audio channels -->
        <!-- {@const unconnectedChannel = !connections.some((c) => c.from === channel.id || c.from.startsWith(`${channel.id}_`))} -->

        {#if !disabledOutput}
            <!-- inactive={unconnectedChannel} -->
            <AudioChannelMixer channelId={channel.id} label={channel.name} color={channel.color} />
        {/if}
    {/each}
</div>

<style>
    .mixers {
        display: flex;
        flex-direction: column;
        gap: 5px;

        margin: 10px;
    }
</style>
