<script lang="ts">
    import { activeShow, playingAudio } from "../../../stores"
    import { getFileName, removeExtension } from "../../helpers/media"
    import Button from "../../inputs/Button.svelte"

    function getName(id: string) {
        return removeExtension(getFileName(id)) || id
    }
</script>

<span class="name" style="justify-content: space-between;">
    {#each Object.entries($playingAudio) as [id, audio]}
        {@const name = audio.name || getName(id)}
        <Button title={name} on:click={() => activeShow.set({ id, type: "audio", data: { isMic: audio.mic } })} active={$activeShow?.id === id} bold={false} center>
            <p>{name}</p>
        </Button>
    {/each}
</span>

<style>
    .name {
        display: flex;
        flex-direction: column;
        justify-content: center;
        max-height: 50px;
        overflow-y: auto;
    }
</style>
