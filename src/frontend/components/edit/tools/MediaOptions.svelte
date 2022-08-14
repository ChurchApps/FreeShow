<script lang="ts">
  import { activeEdit, activeShow, media, outputs } from "../../../stores"
  import { getActiveOutputs, setOutput } from "../../helpers/output"
  import T from "../../helpers/T.svelte"
  import Checkbox from "../../inputs/Checkbox.svelte"
  import Center from "../../system/Center.svelte"

  $: mediaId = $activeEdit.id || $activeShow!.id
  $: flipped = $media[mediaId]?.flipped

  function setFlipped(e: any) {
    media.update((a) => {
      if (!$media[mediaId]) a[mediaId] = { filter: {} }
      a[mediaId].flipped = e.target.checked
      return a
    })

    let currentOutput: any = $outputs[getActiveOutputs()[0]]
    if (currentOutput.out?.background && currentOutput.out?.background.path === mediaId) {
      let bg = currentOutput.out.background
      bg.flipped = flipped
      setOutput("background", bg)
    }
  }
</script>

<!-- TODO: media options -->
<!-- fit/fill / ... -->
<!-- flip -->
<!-- loop/muted ? -->

<div class="main border">
  <!-- <h2 style="text-align: center;">
    <T id="export.options" />
  </h2> -->
  <span style="display: flex;align-items: center;margin: 2px 0;display:none;">
    <span style="flex: 1;"><T id="media.flip" /></span>
    <Checkbox checked={flipped} on:change={(e) => setFlipped(e)} />
  </span>

  <Center>TBA</Center>
</div>

<style>
  .main {
    display: flex;
    flex-direction: column;
    overflow: auto;
    height: 100%;
    padding: 10px;
  }
</style>
