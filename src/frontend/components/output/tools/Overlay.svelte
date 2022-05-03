<script lang="ts">
  import { outOverlays, overlays } from "../../../stores"
  import Button from "../../inputs/Button.svelte"

  $: activeOverlays = $outOverlays.map((id) => ({ id, ...$overlays[id] }))

  function removeOverlay(id: string) {
    outOverlays.set($outOverlays.filter((a) => a !== id))
  }
</script>

<span class="name" style="justify-content: space-between;">
  {#each activeOverlays as overlay}
    <Button on:click={() => removeOverlay(overlay.id)} center red>
      {overlay.name || "—"}
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
