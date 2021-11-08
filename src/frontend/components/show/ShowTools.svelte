<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import Tabs from "../main/Tabs.svelte"
  import SlidesList from "./tools/SlidesList.svelte"

  const tabs: TabsObj = {
    groups: { name: "tools.groups", icon: "groups" },
    transitions: { name: "tools.transitions", icon: "transition" },
    backgrounds: { name: "tools.backgrounds", icon: "backgrounds" },
  }
  let active: string = Object.keys(tabs)[0]
</script>

<div class="main">
  <!-- TODO: if type !== "video" -->
  <Tabs {tabs} bind:active />

  <div class="content">
    {#if active === "groups"}
      <SlidesList />
    {:else}
      {active}
    {/if}
  </div>
</div>

<style>
  .main {
    height: 50%;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    border-top: 3px solid var(--primary-lighter);
  }

  .content {
    /* display: flex; */
    overflow-y: auto;
    /* flex: 1; */
    height: 100%;
  }
</style>
