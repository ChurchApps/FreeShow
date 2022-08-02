<script lang="ts">
  import { activeShow, playingAudio } from "../../../stores"
  import Button from "../../inputs/Button.svelte"

  function getName(id: string) {
    console.log(id)
    return "test"
    // return id.slice((id.lastIndexOf("\\") || id.lastIndexOf("//")) + 1, id.length)
  }
</script>

<span class="name" style="justify-content: space-between;">
  {#each Object.entries($playingAudio) as [id, audio]}
    {@const name = audio.name || getName(id)}
    <Button title={name} on:click={() => activeShow.set({ id, type: "audio" })} active={$activeShow?.id === id} bold={false} center>
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
