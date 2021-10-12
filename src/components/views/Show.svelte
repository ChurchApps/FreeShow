<script lang="ts">
  import { activeShow } from "../../stores"
  import ShowPreview from "../slide/ShowPreview.svelte"

  // $: show = $activeShow?.type ? false : true;
  // $: console.log($activeShow, show);
</script>

<div>
  {#if $activeShow}
    {#if $activeShow.type === "video"}
      <!--  -->
    {:else if $activeShow.type === "image"}
      <!--  -->
    {:else if $activeShow.type === "audio"}
      <!--  -->
    {:else}
      <ShowPreview />
    {/if}
  {:else}
    No active show
  {/if}
</div>
