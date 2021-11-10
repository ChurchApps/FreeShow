<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import { activeEdit, activeShow } from "../../stores"
  import Tabs from "../main/Tabs.svelte"
  import TextStyle from "./tools/TextStyle.svelte"

  const tabs: TabsObj = {
    text: { name: "tools.text", icon: "text" },
    schedule: { name: "tools.schedule", icon: "schedule" },
    timers: { name: "tools.timers", icon: "timers" },
    actions: { name: "tools.actions", icon: "actions" },
  }
  let active: string = Object.keys(tabs)[0]
</script>

<div class="main editTools">
  {#if $activeShow && $activeEdit.slide !== null}
    <Tabs {tabs} bind:active />
    <div class="content">
      {#if active === "text"}
        {"text"}
        <TextStyle />
      {/if}
    </div>
    <!-- add shapes, text edit, arrange layers, transitions... -->
  {/if}
</div>

<style>
  .main {
    height: 50%;
    overflow-y: auto;
    overflow-x: hidden;
    border-top: 3px solid var(--secondary);
  }
</style>
