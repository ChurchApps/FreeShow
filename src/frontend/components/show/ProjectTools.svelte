<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import { activeProject, projects } from "../../stores"
  import Tabs from "../main/Tabs.svelte"
  import Resizeable from "../system/Resizeable.svelte"
  import Notes from "./tools/Notes.svelte"
  import Timers from "./tools/Timers.svelte"

  const tabs: TabsObj = {
    notes: { name: "tools.notes", icon: "notes" },
    // schedule: { name: "tools.schedule", icon: "schedule" }, // program
    timers: { name: "tools.timers", icon: "timer" },
    // actions: { name: "tools.actions", icon: "actions" }, // ... (start video at 10:00)
  }
  let active: string = Object.keys(tabs)[0]

  let note: string = ""
  let currentProject: any = null
  $: if ($activeProject !== currentProject) updateNote()

  function updateNote() {
    note = $projects[$activeProject!].notes
    currentProject = $activeProject
  }

  function edit(e: any) {
    if ($projects[$activeProject!].notes === e.detail) return

    projects.update((a) => {
      a[$activeProject!].notes = e.detail
      return a
    })
  }
</script>

<svelte:window on:mousedown={updateNote} />

<Resizeable id="projectTools" side="bottom" width={150} maxWidth={window.innerHeight * 0.75}>
  <!-- minWidth={80} -->
  <div class="main">
    <Tabs {tabs} bind:active />
    <div class="content">
      {#if active === "notes"}
        <Notes value={note} on:edit={edit} />
      {:else if active === "timers"}
        <Timers />
      {/if}
    </div>
  </div>
</Resizeable>

<style>
  .main {
    /* height: 50%; */
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    /* border-top: 3px solid var(--primary-lighter); */
  }

  .content {
    overflow-y: auto;
    /* flex: 1; */
    height: 100%;
  }
</style>
