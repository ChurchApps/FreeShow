<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import { activeShow, labelsDisabled, showsCache } from "../../stores"
  import { _show } from "../helpers/shows"
  import Tabs from "../main/Tabs.svelte"
  import Audio from "./tools/Audio.svelte"
  import Layout from "./tools/Layout.svelte"
  import Media from "./tools/Media.svelte"
  import Metadata from "./tools/Metadata.svelte"
  import Notes from "./tools/Notes.svelte"
  import SlideGroups from "./tools/SlideGroups.svelte"

  const tabs: TabsObj = {
    groups: { name: "tools.groups", icon: "groups" },
    layout: { name: "tools.layout", icon: "layout" },
    media: { name: "tools.media", icon: "media" },
    // audio: { name: "tools.audio", icon: "audio" },
    metadata: { name: "tools.metadata", icon: "info" },
    notes: { name: "tools.notes", icon: "notes" },
  }
  let active: string = Object.keys(tabs)[0]

  $: showId = $activeShow?.id
  let currentLayout: any = null
  let note: string = ""
  $: if (showId && $showsCache[showId]?.settings?.activeLayout !== currentLayout) updateNote()

  function updateNote() {
    if (!showId) return
    note = showId ? _show("active").layouts("active").get("notes")[0] : ""
    currentLayout = $showsCache[showId]?.settings?.activeLayout
  }

  function edit(e: any) {
    if (!showId || $showsCache[showId].layouts[$showsCache[showId].settings.activeLayout].notes === e.detail) return
    _show("active").layouts("active").set({ key: "notes", value: e.detail })
  }
</script>

<svelte:window on:mousedown={updateNote} />

<div class="main border" class:labels={!$labelsDisabled}>
  <Tabs {tabs} bind:active />

  {#if showId && $showsCache[showId]}
    {#if active === "groups"}
      <div class="content">
        <SlideGroups />
      </div>
    {:else if active === "layout"}
      <Layout />
    {:else if active === "media"}
      <div class="content">
        <Media />
      </div>
    {:else if active === "audio"}
      <div class="content">
        <Audio />
      </div>
    {:else if active === "metadata"}
      <div class="content">
        <Metadata />
      </div>
    {:else if active === "notes"}
      <div class="content">
        <Notes on:edit={edit} value={note} update={active} />
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
    /* overflow-x: hidden; */
  }

  .content {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .main.labels :global(.tabs button) {
    min-width: 50%;
  }
</style>
