<script lang="ts">
  import { activeShow } from "../../stores"

  import Slides from "./Slides.svelte"
</script>

{#if $activeShow}
  {#if $activeShow.type === "video"}
    <!--  -->
  {:else if $activeShow.type === "image"}
    <!--  -->
  {:else if $activeShow.type === "audio"}
    <!--  -->
  {:else}
    <Slides />
  {/if}
{:else}
  <div class="center">Select a slide to edit</div>
{/if}

<style>
  .center {
    display: flex;
    height: 100%;
    opacity: 0.7;
    justify-content: center;
    align-items: center;
  }
</style>
