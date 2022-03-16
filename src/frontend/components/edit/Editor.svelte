<script lang="ts">
  import { activeEdit, activeShow } from "../../stores"
  import SlideEditor from "../edit/SlideEditor.svelte"
  import OverlayEditor from "../edit/OverlayEditor.svelte"
  import Splash from "../main/Splash.svelte"

  // $: if ($activeShow && $activeEdit.id) activeEdit.set({ slide: 0, items: [] })
</script>

<!-- TODO: activeEdit, edit overlays, templates, ... -->
{#if $activeEdit.id}
  {#if $activeEdit.type === "overlay"}
    <OverlayEditor />
  {/if}
{:else if $activeShow}
  {#if $activeShow.type === "video"}
    <!--  -->
  {:else if $activeShow.type === "image"}
    <!--  -->
  {:else if $activeShow.type === "audio"}
    <!--  -->
  {:else}
    <SlideEditor />
  {/if}
{:else}
  <Splash />
{/if}

<style>
</style>
