<script lang="ts">
    import { audioRouting, outputs } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { keysToID } from "../../helpers/array"
    import AudioChannelMixer from "./AudioChannelMixer.svelte"

    $: channels = $audioRouting?.channels || [{ id: "main", name: translateText("audio.main") }]
    $: connections = $audioRouting?.connections || []

    $: inactiveOutputIds = keysToID($outputs).filter((a) => !a.enabled)
</script>

<div class="mixers">
    {#each channels as channel (channel.id)}
        {@const disabledOutput = inactiveOutputIds.some((a) => `channel_${a.id}` === channel.id)}
        {@const unconnectedChannel = !connections.some((c) => c.from === channel.id || c.from.startsWith(`${channel.id}_`))}

        {#if !disabledOutput}
            <AudioChannelMixer channelId={channel.id} label={channel.name} color={channel.color} inactive={unconnectedChannel} />
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
