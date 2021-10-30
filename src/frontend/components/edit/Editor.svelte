<script lang="ts">
  import { activeShow } from "../../stores"
  import SlideEditor from "../edit/SlideEditor.svelte"
  import Splash from "../main/Splash.svelte"
</script>

{#if $activeShow}
  {#if $activeShow.type === "video"}
    <!--  -->
  {:else if $activeShow.type === "image"}
    <!--  -->
  {:else if $activeShow.type === "audio"}
    <!--  -->
  {:else}
    <SlideEditor />
  {/if}
{:else}
  <Splash />
{/if}

<style>
</style>
