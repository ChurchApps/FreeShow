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
    meta: { name: "tools.meta", icon: "meta" },
    backgrounds: { name: "tools.backgrounds", icon: "backgrounds" },
    audio: { name: "tools.audio", icon: "audio" },
    transitions: { name: "tools.transitions", icon: "transition" },
    notes: { name: "tools.notes", icon: "notes" },
  }
  let active: string = Object.keys(tabs)[0]

  $: showId = $activeShow!.id
  let note: string = ""
  $: {
    let n = $shows[showId]?.layouts[$shows[showId].settings.activeLayout].notes
    if (note !== n) note = n
    // if (note.length && $shows[showId]) {
    //   $shows[showId].layouts[$shows[showId].settings.activeLayout].notes = note
    // }
  }

  function edit(e: any) {
    if ($shows[showId].layouts[$shows[showId].settings.activeLayout].notes !== e.detail) {
      shows.update((a) => {
        a[showId].layouts[$shows[showId].settings.activeLayout].notes = e.detail
        return a
      })
    }
  }
</script>

<div class="main">
  <Tabs {tabs} bind:active />

  {#if $shows[showId]}
    {#if active === "groups"}
      <div class="content">
        <SlideGroups />
      </div>
    {:else if active === "backgrounds"}
      <div class="content">
        <Backgrounds />
      </div>
    {:else if active === "transitions"}
      <Transitions />
    {:else if active === "notes"}
      <div class="content">
        <Notes on:edit={edit} value={note} />
      </div>
    {/if}
  {/if}
</div>

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
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
