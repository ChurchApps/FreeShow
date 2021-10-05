<script>
  import { activeShow } from "../../stores";
  import ShowSlides from "./ShowSlides.svelte";

  // $: show = $activeShow?.type ? false : true;
  // $: console.log($activeShow, show);
</script>

<div>
  {#if $activeShow}
  
    {#if $activeShow.type === 'video'}
      <!--  -->
    {:else if $activeShow.type === 'image'}
      <!--  -->
    {:else if $activeShow.type === 'audio'}
      <!--  -->
    {:else}
      <ShowSlides />
    {/if}
  {:else}
    No active show
  {/if}
</div>