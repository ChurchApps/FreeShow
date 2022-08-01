<script lang="ts">
  import { playingAudio } from "../../../stores"
  import Button from "../../inputs/Button.svelte"

  function clearAudio(id: string) {
    playingAudio.update((a) => {
      a[id].audio.pause()
      delete a[id]
      return a
    })
  }
</script>

<span class="name" style="justify-content: space-between;">
  {#each Object.entries($playingAudio) as [id, audio]}
    <Button on:click={() => clearAudio(id)} center red>
      <p>{audio.name || "—"}</p>
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
