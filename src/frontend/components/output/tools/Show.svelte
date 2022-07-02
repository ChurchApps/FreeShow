<script lang="ts">
  import { activeShow, outSlide, showsCache } from "../../../stores"
  import T from "../../helpers/T.svelte"

  $: name = $outSlide && $showsCache[$outSlide.id] ? $showsCache[$outSlide.id].name : "—"

  let length: number = 0
  $: {
    if ($outSlide?.id) {
      length = 0
      if ($outSlide?.id === "temp") length = 1
      else {
        $showsCache[$outSlide.id]?.layouts[$outSlide.layout!]?.slides.forEach((s: any) => {
          length++
          if ($showsCache[$outSlide!.id].slides[s.id].children) length += $showsCache[$outSlide!.id].slides[s.id].children!.length
        })
      }
    }
  }

  function openShow() {
    if (!$outSlide) return

    if ($outSlide?.layout)
      showsCache.update((a: any) => {
        a[$outSlide!.id].settings.activeLayout = $outSlide?.layout
        return a
      })

    activeShow.set({ id: $outSlide.id })
  }
</script>

{#if $outSlide}
  <span class="name" style="justify-content: space-between;" on:click={openShow}>
    <p>
      {#if name.length}
        {name}
      {:else}
        <T id="main.unnamed" />
      {/if}
    </p>
    <!-- TODO: update -->
    <span style="opacity: 0.6;">{($outSlide.index || 0) + 1}/{length}</span>
  </span>
{/if}

<style>
  .name {
    display: flex;
    justify-content: center;
    padding: 10px;
    opacity: 0.8;

    cursor: pointer;
  }

  .name:hover {
    background-color: var(--primary-darker);
  }
</style>
