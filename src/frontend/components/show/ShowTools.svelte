<script lang="ts">
    import type { TabsObj } from "../../../types/Tabs"
    import { activeShow, labelsDisabled, showsCache } from "../../stores"
    import { _show } from "../helpers/shows"
    import Tabs from "../main/Tabs.svelte"
    import Media from "./tools/Media.svelte"
    import Metadata from "./tools/Metadata.svelte"
    import SlideGroups from "./tools/SlideGroups.svelte"

    const tabs: TabsObj = {
        groups: { name: "tools.groups", icon: "groups" },
        metadata: { name: "tools.metadata", icon: "info" },
        media: { name: "tools.media", icon: "media", remove: true }
    }
    let active: string = Object.keys(tabs)[0]

    $: showId = $activeShow?.id
    $: currentShow = $showsCache[showId || ""]

    // media
    // || $actions
    $: if (currentShow) checkMedia()
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
    }

    $: reference = currentShow?.reference?.type
</script>

<div class="main border" class:labels={!$labelsDisabled}>
    {#if reference === "lessons"}
        <!-- nothing needed -->
    {:else}
        <Tabs {tabs} bind:active />

        {#if currentShow}
            {#if active === "groups"}
                <SlideGroups />
            {:else if active === "media"}
                <div class="content">
                    <Media />
                </div>
            {:else if active === "metadata"}
                <div class="content">
                    <Metadata />
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
