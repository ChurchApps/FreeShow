<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import Tabs from "../main/Tabs.svelte"
  import Notes from "./tools/Notes.svelte"

  const tabs: TabsObj = {
    notes: { name: "tools.notes", icon: "notes" },
    schedule: { name: "tools.schedule", icon: "schedule" }, // program
    timers: { name: "tools.timers", icon: "timers" },
    actions: { name: "tools.actions", icon: "actions" }, // ... (start video at 10:00)
  }
  let active: string = Object.keys(tabs)[0]

  // let elem: any
  // let height: number = elem?.closest(".left").offsetHeight / 2
  // // bind:this={elem} style="height: {height}px;"
</script>

<div class="main">
  <Tabs {tabs} bind:active />
  <div class="content">
    {#if active === "notes"}
      <Notes />
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
    border-top: 3px solid var(--primary-lighter);
  }

  .content {
    overflow-y: auto;
    /* flex: 1; */
    height: 100%;
  }
</style>
