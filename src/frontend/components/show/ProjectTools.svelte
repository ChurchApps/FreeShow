<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import Tabs from "../main/Tabs.svelte"

  const tabs: TabsObj = {
    notes: { name: "tools.notes", icon: "notes" },
    schedule: { name: "tools.schedule", icon: "schedule" }, // program
    timers: { name: "tools.timers", icon: "timers" },
    calendar: { name: "tools.calendar", icon: "calendar" },
    actions: { name: "tools.actions", icon: "actions" }, // ... (start video at 10:00)
  }
  let active: string = Object.keys(tabs)[0]
</script>

<div class="main">
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
  }

  .content {
    display: flex;
  }
</style>
