<script lang="ts">
  import { dictionary, overlays } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
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

  function setLocked(id: string, setLocked: boolean) {
    overlays.update((a) => {
      a[id].locked = setLocked
      return a
    })
  }
</script>

{#if currentOutput?.out?.overlays?.length}
  <span class="name" style="justify-content: space-between;">
    {#each activeOverlays as overlay}
      {@const locked = $overlays[overlay.id].locked}
      <div class="overlay">
        <!-- disabled={locked} red={!locked} -->
        <Button style="flex: 1;" on:click={() => removeOverlay(overlay.id)} center red>
          <p>{overlay.name || "—"}</p>
        </Button>
        <Button on:click={() => setLocked(overlay.id, !locked)} title={locked ? $dictionary.preview?.unlock : $dictionary.preview?.lock} red={locked}>
          <Icon id={locked ? "locked" : "unlocked"} />
        </Button>
      </div>
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

  .overlay {
    display: flex;
  }
</style>
