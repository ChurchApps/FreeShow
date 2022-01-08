<script lang="ts">
  import { drawerTabsData } from "../../stores"
  import Cameras from "./live/Cameras.svelte"
  import Microphones from "./live/Microphones.svelte"
  import Windows from "./live/Windows.svelte"
  import Overlays from "./Overlays.svelte"
  import Scripture from "./bible/Scripture.svelte"
  import Backgrounds from "./media/Backgrounds.svelte"
  import Shows from "./Shows.svelte"

  export let id: string
  export let bible: any
  export let searchValue: string
  export let firstMatch: null | string
  console.log(firstMatch)
  $: active = $drawerTabsData[id].activeSubTab
</script>

<div class="main">
  {#if id === "shows"}
    <Shows {id} {active} {searchValue} />
  {:else if id === "backgrounds"}
    <Backgrounds {active} />
  {:else if id === "overlays"}
    <div class="grid">
      <Overlays />
    </div>
  {:else if id === "scripture"}
    <Scripture {active} bind:bible />
  {:else if id === "live"}
    <div class="grid">
      <!-- live -->
      <!-- screens -->
      {#if active === "windows"}
        <Windows />
      {:else if active === "cameras"}
        <Cameras />
      {:else if active === "microphones"}
        <Microphones />
      {/if}
    </div>
  {/if}
</div>

<style>
  .main {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    background-color: var(--primary-darker);
    flex: 1;
  }

  .grid {
    display: flex;
    flex-wrap: wrap;
    flex: 1;
    gap: 10px;
    padding: 10px;
  }
</style>
