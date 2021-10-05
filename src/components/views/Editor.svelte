<script>
  import { activeShow, activeSlide } from "../../stores";
  import ShowSlides from "./ShowSlides.svelte";
  import SlideEditor from "./SlideEditor.svelte";

  let seIndex = $activeSlide?.index || 0;
</script>

{#if $activeShow}
  {#if $activeShow.type === 'video'}
    <!--  -->
  {:else if $activeShow.type === 'image'}
    <!--  -->
  {:else if $activeShow.type === 'audio'}
    <!--  -->
  {:else}
    <ShowSlides editor={true} />
    <SlideEditor {seIndex} />
  {/if}
{:else}
  No active show
{/if}

<style>

</style>