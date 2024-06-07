<script lang="ts">
    import type { TabsObj } from "../../../types/Tabs"
    import { activeShow, labelsDisabled, showsCache } from "../../stores"
    import { _show } from "../helpers/shows"
    import Tabs from "../main/Tabs.svelte"
    import Media from "./tools/Media.svelte"
    import Metadata from "./tools/Metadata.svelte"
    import Notes from "./tools/Notes.svelte"
    import SlideGroups from "./tools/SlideGroups.svelte"

    const tabs: TabsObj = {
        groups: { name: "tools.groups", icon: "groups" },
        media: { name: "tools.media", icon: "media", disabled: true },
        metadata: { name: "tools.metadata", icon: "info", overflow: true },
        notes: { name: "tools.notes", icon: "notes", overflow: true },
    }
    let active: string = Object.keys(tabs)[0]

    $: showId = $activeShow?.id
    $: show = $showsCache[showId || ""]
    let currentLayout: any = null
    let note: string = ""
    $: if (showId && show?.settings?.activeLayout !== currentLayout) updateNote()

    // let previousShow = showId
    function updateNote() {
        if (!showId) return
        note = showId ? _show().layouts("active").get("notes")[0] || "" : ""
        currentLayout = show?.settings?.activeLayout

        // if (note.length && previousShow !== showId && active === "groups") active = "notes"
        // else if (!note.length && previousShow !== showId && active === "notes") active = "groups"
        // previousShow = showId
    }

    function edit(e: any) {
        if (!showId || show.layouts[show.settings.activeLayout].notes === e.detail) return
        _show().layouts("active").set({ key: "notes", value: e.detail })
    }

    // media
    // || $midiIn
    $: if (show) checkMedia()
    function checkMedia() {
        let refs = _show("active").layouts().ref()

        if (refs.find((ref) => ref.find((slide) => slide.data.background))) return (tabs.media.disabled = false)
        if (refs.find((ref) => ref.find((slide) => slide.data.audio))) return (tabs.media.disabled = false)
        if (refs.find((ref) => ref.find((slide) => slide.data.mics))) return (tabs.media.disabled = false)
        if (refs.find((ref) => ref.find((slide) => slide.data.actions?.slideActions?.length))) return (tabs.media.disabled = false)

        // if (Object.keys(show?.midi || {}).length) return (tabs.media.disabled = false)
        // if (Object.values($midiIn).find((value: any) => value.shows?.find((a) => a.id === $activeShow?.id))) return (tabs.media.disabled = false)

        return (tabs.media.disabled = true)
    }
</script>

<svelte:window on:mousedown={updateNote} />

<div class="main border" class:labels={!$labelsDisabled}>
    <Tabs {tabs} bind:active />

    {#if show}
        {#if active === "groups"}
            <SlideGroups />
        {:else if active === "media"}
            <div class="content">
                <Media />
            </div>
            <!-- {:else if active === "audio"}
      <div class="content">
        <Audio />
      </div> -->
        {:else if active === "metadata"}
            <div class="content">
                <Metadata />
            </div>
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
        /* overflow-x: hidden; */
    }

    .content {
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
    }

    /* .main.labels :global(.tabs button) {
        min-width: 50%;
    } */
</style>
