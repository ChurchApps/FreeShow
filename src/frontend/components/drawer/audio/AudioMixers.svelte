<script lang="ts">
    import { audioRouting } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import AudioChannelMixer from "./AudioChannelMixer.svelte"

    $: channels = $audioRouting?.channels || [{ id: "main", name: translateText("audio.main") }]
</script>

<div class="mixers">
    {#each channels as channel (channel.id)}
        <AudioChannelMixer channelId={channel.id} label={channel.name} />
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
