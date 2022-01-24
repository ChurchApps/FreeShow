<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import { activeProject, projects } from "../../stores"
  import Tabs from "../main/Tabs.svelte"
  import Center from "../system/Center.svelte"
  import Resizeable from "../system/Resizeable.svelte"
  import Notes from "./tools/Notes.svelte"

  const tabs: TabsObj = {
    notes: { name: "tools.notes", icon: "notes" },
    // schedule: { name: "tools.schedule", icon: "schedule" }, // program
    timers: { name: "tools.timers", icon: "timer" },
    // actions: { name: "tools.actions", icon: "actions" }, // ... (start video at 10:00)
  }
  let active: string = Object.keys(tabs)[0]

  // let elem: any
  // let height: number = elem?.closest(".left").offsetHeight / 2
  // // bind:this={elem} style="height: {height}px;"

  let note: string = ""
  let a: any = null
  $: {
    if ($activeProject !== a) {
      note = $projects[$activeProject!].notes
      a = $activeProject
    }
  }

  function edit(e: any) {
    if ($projects[$activeProject!].notes !== e.detail) {
      projects.update((a) => {
        a[$activeProject!].notes = e.detail
        return a
      })
    }
  }
</script>

<Resizeable id="projectTools" side="bottom" maxWidth={window.innerHeight * 0.75}>
  <!-- minWidth={80} -->
  <div class="main">
    <Tabs {tabs} bind:active />
    <div class="content">
      {#if active === "notes"}
        <Notes value={note} on:edit={edit} />
      {:else if active === "timers"}
        <Center>WIP</Center>
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
