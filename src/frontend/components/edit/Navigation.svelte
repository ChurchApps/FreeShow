<script lang="ts">
  import { activeShow } from "../../stores"

  import ShowPreview from "../slide/ShowPreview.svelte"
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
  {/if}
{:else}
  No active show
{/if}
