<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import { shows, activeShow } from "../../stores"
  import Tabs from "../main/Tabs.svelte"
  import Backgrounds from "./tools/Backgrounds.svelte"
  import Notes from "./tools/Notes.svelte"
  import SlideGroups from "./tools/SlideGroups.svelte"
  import Transitions from "./tools/Transitions.svelte"

  const tabs: TabsObj = {
    groups: { name: "tools.groups", icon: "groups" },
    backgrounds: { name: "tools.backgrounds", icon: "backgrounds" },
    transitions: { name: "tools.transitions", icon: "transition" },
    notes: { name: "tools.notes", icon: "notes" },
  }
  let active: string = Object.keys(tabs)[0]

  $: showId = $activeShow!.id
  let note: string = $shows[$activeShow!.id].layouts[$shows[$activeShow!.id].settings.activeLayout].notes
  $: {
    if ($shows[showId]?.settings.activeLayout) note = $shows[showId].layouts[$shows[showId].settings.activeLayout].notes
    if (note.length && $shows[showId]) {
      $shows[showId].layouts[$shows[showId].settings.activeLayout].notes = note
    }
  }
</script>

<!-- <Resizeable id="showTools" side="bottom" maxWidth={window.innerHeight / 2}> -->
<div class="main">
  <!-- TODO: if type !== "video" -->
  <Tabs {tabs} bind:active />

  {#if $shows[showId]}
    <div class="content">
      {#if active === "groups"}
        <SlideGroups />
      {:else if active === "backgrounds"}
        <Backgrounds />
      {:else if active === "transitions"}
        <Transitions />
      {:else if active === "notes"}
        <Notes bind:value={note} />
      {:else}
        {active}
      {/if}
    </div>
  {/if}
</div>

<!-- </Resizeable> -->
<style>
  .main {
    display: flex;
    flex-direction: column;
    /* flex: 1;
    overflow-y: auto; */
    overflow: hidden;
    height: 100%;
    border-top: 2px solid var(--primary-lighter);
    /* overflow-x: hidden; */
  }

  .content {
    overflow-y: auto;
    height: 100%;
  }
</style>
