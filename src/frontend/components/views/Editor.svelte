<script lang="ts">
  import { activeShow, output } from "../../stores"
  import ShowPreview from "../slide/ShowPreview.svelte"
  import SlideEditor from "../slide/SlideEditor.svelte"

  let seIndex = $output?.slide.index || 0
</script>

{#if $activeShow}
  {#if $activeShow.type === "video"}
    <!--  -->
  {:else if $activeShow.type === "image"}
    <!--  -->
  {:else if $activeShow.type === "audio"}
    <!--  -->
  {:else}
    <ShowPreview editor={true} />
    <SlideEditor {seIndex} />
  {/if}
{:else}
  No active show
{/if}

<style>
</style>
