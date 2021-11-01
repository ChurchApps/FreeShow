<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import Tabs from "../main/Tabs.svelte"

  const tabs: TabsObj = {
    slides: { name: "tools.slides", icon: "slides" },
    transitions: { name: "tools.transitions", icon: "transition" },
    backgrounds: { name: "tools.backgrounds", icon: "backgrounds" },
  }
  let active: string = Object.keys(tabs)[0]
</script>

<div class="main">
  <!-- TODO: if type !== "video" -->
  <Tabs {tabs} bind:active />

  <div class="content">
    {active}
  </div>
</div>

<style>
  .main {
    height: 50%;
    overflow-y: auto;
    overflow-x: hidden;
    border-top: 3px solid var(--primary-lighter);
  }
</style>
