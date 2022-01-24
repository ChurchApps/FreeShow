<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import { shows, activeShow } from "../../stores"
  import Tabs from "../main/Tabs.svelte"
  import Audio from "./tools/Audio.svelte"
  import Backgrounds from "./tools/Backgrounds.svelte"
  import Metadata from "./tools/Metadata.svelte"
  import Notes from "./tools/Notes.svelte"
  import SlideGroups from "./tools/SlideGroups.svelte"
  import Transitions from "./tools/Transitions.svelte"

  const tabs: TabsObj = {
    groups: { name: "tools.groups", icon: "groups" },
    metadata: { name: "tools.metadata", icon: "info" },
    backgrounds: { name: "tools.backgrounds", icon: "media" },
    audio: { name: "tools.audio", icon: "audio" },
    transitions: { name: "tools.transitions", icon: "transition" },
    notes: { name: "tools.notes", icon: "notes" },
  }
  let active: string = Object.keys(tabs)[0]

  $: showId = $activeShow?.id
  let a: any = null
  let note: string = ""
  $: {
    if (showId && $shows[showId].settings.activeLayout !== a) {
      note = showId ? $shows[showId]?.layouts[$shows[showId].settings.activeLayout].notes : ""
      a = $shows[showId].settings.activeLayout
    }
  }

  function edit(e: any) {
    if (showId && $shows[showId].layouts[$shows[showId].settings.activeLayout].notes !== e.detail) {
      shows.update((a) => {
        a[showId!].layouts[$shows[showId!].settings.activeLayout].notes = e.detail
        return a
      })
    }
  }
</script>

<div class="main">
  <Tabs {tabs} bind:active />

  {#if showId && $shows[showId]}
    {#if active === "groups"}
      <div class="content">
        <SlideGroups />
      </div>
    {:else if active === "metadata"}
      <div class="content">
        <Metadata />
      </div>
    {:else if active === "backgrounds"}
      <div class="content">
        <Backgrounds />
      </div>
    {:else if active === "audio"}
      <div class="content">
        <Audio />
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
