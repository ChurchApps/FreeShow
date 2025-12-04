<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import TabletDrawerShows from "./pages/TabletDrawerShows.svelte"
    import TabletDrawerMedia from "./pages/TabletDrawerMedia.svelte"
    import TabletDrawerAudio from "./pages/TabletDrawerAudio.svelte"
    import TabletDrawerOverlays from "./pages/TabletDrawerOverlays.svelte"
    import TabletDrawerTemplates from "./pages/TabletDrawerTemplates.svelte"
    import TabletDrawerCalendar from "./pages/TabletDrawerCalendar.svelte"
    import TabletDrawerFunctions from "./pages/TabletDrawerFunctions.svelte"
    import Scripture from "../../../pages/Scripture.svelte"

    export let id: string
    export let searchValue: string

    const dispatch = createEventDispatcher()

    const handleScriptureSearchClear = () => dispatch("search-clear")
    let loaded: string[] = []
    $: if (!loaded.includes(id)) loaded = [...loaded, id]
</script>

<div class="main">
    {#if loaded.includes("shows")}
        <div style="display: {id === 'shows' ? 'contents' : 'none'}">
            <TabletDrawerShows {searchValue} />
        </div>
    {/if}

    {#if loaded.includes("media")}
        <div style="display: {id === 'media' ? 'contents' : 'none'}">
            <TabletDrawerMedia />
        </div>
    {/if}

    {#if loaded.includes("audio")}
        <div style="display: {id === 'audio' ? 'contents' : 'none'}">
            <TabletDrawerAudio />
        </div>
    {/if}

    {#if loaded.includes("overlays")}
        <div style="display: {id === 'overlays' ? 'contents' : 'none'}">
            <TabletDrawerOverlays {searchValue} />
        </div>
    {/if}

    {#if loaded.includes("templates")}
        <div style="display: {id === 'templates' ? 'contents' : 'none'}">
            <TabletDrawerTemplates {searchValue} />
        </div>
    {/if}

    {#if loaded.includes("scripture")}
        <div style="height: 100%; overflow: hidden; display: {id === 'scripture' ? 'flex' : 'none'}; flex-direction: column;">
            <Scripture tablet searchValueFromDrawer={searchValue} on:search-clear={handleScriptureSearchClear} />
        </div>
    {/if}

    {#if loaded.includes("calendar")}
        <div style="display: {id === 'calendar' ? 'contents' : 'none'}">
            <TabletDrawerCalendar />
        </div>
    {/if}

    {#if loaded.includes("functions")}
        <div style="display: {id === 'functions' ? 'contents' : 'none'}">
            <TabletDrawerFunctions />
        </div>
    {/if}
</div>

<style>
    .main {
        position: relative;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        flex: 1;
        background-color: var(--primary-darkest);
    }
</style>
