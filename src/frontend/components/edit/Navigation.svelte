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
  No active show
{/if}
