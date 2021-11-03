<script lang="ts">
  import { activeShow } from "../../stores"
  import Layouts from "../slide/Layouts.svelte"
  import Slides from "./Slides.svelte"
  import Splash from "../main/Splash.svelte"

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
    {:else if $activeShow.type === "private"}
      Private
    {:else}
      <Slides />
      <Layouts />
    {/if}
  {:else}
    <Splash />
  {/if}
</div>

<style>
  div {
    height: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
</style>
