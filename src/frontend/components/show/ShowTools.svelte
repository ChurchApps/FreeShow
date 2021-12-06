<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import { shows, activeShow } from "../../stores"
  import Tabs from "../main/Tabs.svelte"
  import Notes from "./tools/Notes.svelte"
  import SlideGroups from "./tools/SlideGroups.svelte"

  const tabs: TabsObj = {
    groups: { name: "tools.groups", icon: "groups" },
    transitions: { name: "tools.transitions", icon: "transition" },
    backgrounds: { name: "tools.backgrounds", icon: "backgrounds" },
    notes: { name: "tools.notes", icon: "notes" },
  }
  let active: string = Object.keys(tabs)[0]

  $: showId = $activeShow!.id
  let note: string = $shows[$activeShow!.id].layouts[$shows[$activeShow!.id].settings.activeLayout].notes
  $: {
    if (note.length) {
      $shows[showId].layouts[$shows[showId].settings.activeLayout].notes = note
    }
  }
</script>

<div class="main">
  <!-- TODO: if type !== "video" -->
  <Tabs {tabs} bind:active />

  <div class="content">
    {#if active === "groups"}
      <SlideGroups />
    {:else if active === "notes"}
      <Notes bind:value={note} />
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
    overflow-y: auto;
    height: 100%;
  }
</style>
