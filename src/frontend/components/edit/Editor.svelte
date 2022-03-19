<script lang="ts">
  import { activeEdit, activeShow } from "../../stores"
  import SlideEditor from "../edit/SlideEditor.svelte"
  import OverlayEditor from "../edit/OverlayEditor.svelte"
  import Splash from "../main/Splash.svelte"

  // $: if ($activeShow && $activeEdit.id) activeEdit.set({ slide: 0, items: [] })
  // TODO: check if slide 0 exists
  $: if ($activeShow && ($activeShow.type === undefined || $activeShow.type === "show") && ($activeEdit.slide === null || $activeEdit.slide === undefined) && !$activeEdit.id)
    activeEdit.set({ slide: 0, items: [] })
</script>

<!-- TODO: activeEdit, edit overlays, templates, ... -->
{#if $activeEdit.type === "overlay"}
  <OverlayEditor />
{:else if $activeEdit.type === "media" || $activeShow?.type === "video" || $activeShow?.type === "image"}
  <!--  -->
{:else if $activeEdit.type === "audio" || $activeShow?.type === "audio"}
  <!--  -->
{:else if $activeEdit.slide !== undefined && $activeEdit.slide !== null}
  <SlideEditor />
{:else}
  <Splash />
{/if}

<style>
</style>
