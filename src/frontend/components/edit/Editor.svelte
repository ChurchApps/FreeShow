<script lang="ts">
  import { activeShow, output } from "../../stores"
  import SlideEditor from "../edit/SlideEditor.svelte"

  let seIndex = $output?.slide?.index || 0
</script>

{#if $activeShow}
  {#if $activeShow.type === "video"}
    <!--  -->
  {:else if $activeShow.type === "image"}
    <!--  -->
  {:else if $activeShow.type === "audio"}
    <!--  -->
  {:else}
    <SlideEditor {seIndex} />
  {/if}
{:else}
  No active show
{/if}

<style>
</style>
