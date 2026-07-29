<script lang="ts">
    import { audioRouting } from "../../../stores"
    import AudioChannelMixer from "./AudioChannelMixer.svelte"

    $: mergers = $audioRouting?.mergers || [{ id: "main", name: "Main Bus" }]
</script>

<div class="mixers">
    {#each mergers as merger (merger.id)}
        <AudioChannelMixer channelId={merger.id} label={merger.name} />
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
