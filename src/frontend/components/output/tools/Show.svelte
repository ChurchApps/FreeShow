<script lang="ts">
  import { outSlide, showsCache } from "../../../stores"
  import T from "../../helpers/T.svelte"

  $: name = $outSlide && $showsCache[$outSlide.id] ? $showsCache[$outSlide.id].name : "—"

  let length: number = 0
  $: {
    if ($outSlide?.id) {
      length = 0
      $showsCache[$outSlide.id]?.layouts[$outSlide.layout]?.slides.forEach((s: any) => {
        length++
        if ($showsCache[$outSlide!.id].slides[s.id].children) length += $showsCache[$outSlide!.id].slides[s.id].children!.length
      })
    }
  }
</script>

{#if $outSlide}
  <span class="name" style="justify-content: space-between;">
    <p>
      {#if name.length}
        {name}
      {:else}
        <T id="main.unnamed" />
      {/if}
    </p>
    <!-- TODO: update -->
    <span style="opacity: 0.6;">{$outSlide.index + 1}/{length}</span>
  </span>
{/if}

<style>
  .name {
    display: flex;
    justify-content: center;
    padding: 10px;
    opacity: 0.8;
  }
</style>
