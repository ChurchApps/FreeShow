<script lang="ts">
    import type { TabsObj } from "../../../types/Tabs"
    import { activeShow, labelsDisabled, showsCache } from "../../stores"
    import { translateText } from "../../utils/language"
    import { _show } from "../helpers/shows"
    import Tabs from "../main/Tabs.svelte"
    import Media from "./tools/Media.svelte"
    import Metadata from "./tools/Metadata.svelte"
    import Notes from "./tools/Notes.svelte"
    import Recording from "./tools/Recording.svelte"
    import SlideGroups from "./tools/SlideGroups.svelte"

    const tabs: TabsObj = {
        groups: { name: "tools.groups", icon: "groups" },
        media: { name: "tools.media", icon: "media", remove: true },
        metadata: { name: "tools.metadata", icon: "info", overflow: true },
        recording: { name: "example.recording", icon: "record", overflow: true, tooltip: translateText("recording.tip") },
        notes: { name: "tools.notes", icon: "notes", overflow: true }
    }
    let active: string = Object.keys(tabs)[0]

    $: showId = $activeShow?.id
    $: show = $showsCache[showId || ""]
    let currentLayout: string | null = null
    let note = ""
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
    // || $actions
    $: if (show) checkMedia()
    function checkMedia() {
        let refs = _show().layouts().ref()

        let disableMedia = true

        if (refs.some((ref) => ref.some((slide) => slide.data.background))) disableMedia = false
        else if (refs.some((ref) => ref.some((slide) => slide.data.audio))) disableMedia = false
        else if (refs.some((ref) => ref.some((slide) => slide.data.mics))) disableMedia = false
        else if (refs.some((ref) => ref.some((slide) => slide.data.actions?.slideActions?.length))) disableMedia = false
        // else if (Object.keys(show?.midi || {}).length) disableMedia = false
        // else if (Object.values($actions).find((value: any) => value.shows?.find((a) => a.id === $activeShow?.id))) disableMedia = false

        tabs.media.remove = disableMedia
        // could change page back, but could be useful to keep it open in some cases
        // if (disableMedia && active === "media") active = Object.keys(tabs)[0]

        // show metadata tab if media is disabled
        tabs.metadata.overflow = !disableMedia
    }

    $: reference = show?.reference?.type
</script>

<svelte:window on:mousedown={updateNote} />

<div class="main border" class:labels={!$labelsDisabled}>
    {#if reference === "lessons"}
        <Tabs tabs={{ notes: { name: "tools.notes", icon: "notes" } }} active="notes" />

        <div class="content" style="background-color: var(--primary-darker);">
            <Notes on:edit={edit} value={note} />
        </div>
    {:else}
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
            {:else if active === "recording"}
                {#key showId}
                    <Recording showId={showId || ""} />
                {/key}
            {:else if active === "notes"}
                <div class="content" style="background-color: var(--primary-darker);">
                    <Notes on:edit={edit} value={note} />
                </div>
            {/if}
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
