<script lang="ts">
  import { overlays } from "../../../stores"
  import { setOutput } from "../../helpers/output"
  import Button from "../../inputs/Button.svelte"

  export let currentOutput: any

  // $: if (!currentOutput?.out?.overlays?.length) {
  //   // get all overlays
  //   let outs = getActiveOutputs().map((id) => $outputs[id])
  //   currentOutput = outs.find((output) => output.out?.overlays)
  // }

  $: activeOverlays = currentOutput?.out?.overlays?.map((id: any) => ({ id, ...$overlays[id] }))

  function removeOverlay(id: string) {
    setOutput(
      "overlays",
      currentOutput.out.overlays.filter((a: any) => a !== id)
    )
  }
</script>

{#if currentOutput?.out?.overlays?.length}
  <span class="name" style="justify-content: space-between;">
    {#each activeOverlays as overlay}
      <Button on:click={() => removeOverlay(overlay.id)} center red>
        <p>{overlay.name || "—"}</p>
      </Button>
    {/each}
  </span>
{/if}

<style>
  .name {
    display: flex;
    flex-direction: column;
    justify-content: center;
    max-height: 50px;
    overflow-y: auto;
  }
</style>
