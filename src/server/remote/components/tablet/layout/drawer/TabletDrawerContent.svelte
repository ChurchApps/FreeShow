<script lang="ts">
    import { createEventDispatcher } from "svelte"

    export let id: string
    export let searchValue: string

    const dispatch = createEventDispatcher()

    const handleScriptureSearchClear = () => dispatch("search-clear")
    
    // Track which tabs have been loaded (session cache)
    let loaded: string[] = []
    $: if (!loaded.includes(id)) loaded = [...loaded, id]

    // Component cache - store loaded components
    let TabletDrawerShows: any = null
    let TabletDrawerMedia: any = null
    let TabletDrawerAudio: any = null
    let TabletDrawerOverlays: any = null
    let TabletDrawerTemplates: any = null
    let TabletDrawerCalendar: any = null
    let TabletDrawerFunctions: any = null
    let Scripture: any = null

    // Lazy load components on first access
    $: if (loaded.includes("shows") && !TabletDrawerShows) {
        import("./pages/TabletDrawerShows.svelte").then(m => TabletDrawerShows = m.default)
    }
    $: if (loaded.includes("media") && !TabletDrawerMedia) {
        import("./pages/TabletDrawerMedia.svelte").then(m => TabletDrawerMedia = m.default)
    }
    $: if (loaded.includes("audio") && !TabletDrawerAudio) {
        import("./pages/TabletDrawerAudio.svelte").then(m => TabletDrawerAudio = m.default)
    }
    $: if (loaded.includes("overlays") && !TabletDrawerOverlays) {
        import("./pages/TabletDrawerOverlays.svelte").then(m => TabletDrawerOverlays = m.default)
    }
    $: if (loaded.includes("templates") && !TabletDrawerTemplates) {
        import("./pages/TabletDrawerTemplates.svelte").then(m => TabletDrawerTemplates = m.default)
    }
    $: if (loaded.includes("calendar") && !TabletDrawerCalendar) {
        import("./pages/TabletDrawerCalendar.svelte").then(m => TabletDrawerCalendar = m.default)
    }
    $: if (loaded.includes("functions") && !TabletDrawerFunctions) {
        import("./pages/TabletDrawerFunctions.svelte").then(m => TabletDrawerFunctions = m.default)
    }
    $: if (loaded.includes("scripture") && !Scripture) {
        import("../../../pages/Scripture.svelte").then(m => Scripture = m.default)
    }
</script>

<div class="main">
    {#if loaded.includes("shows")}
        <div style="display: {id === 'shows' ? 'contents' : 'none'}">
            {#if TabletDrawerShows}
                <svelte:component this={TabletDrawerShows} {searchValue} />
            {/if}
        </div>
    {/if}

    {#if loaded.includes("media")}
        <div style="display: {id === 'media' ? 'contents' : 'none'}">
            {#if TabletDrawerMedia}
                <svelte:component this={TabletDrawerMedia} />
            {/if}
        </div>
    {/if}

    {#if loaded.includes("audio")}
        <div style="display: {id === 'audio' ? 'contents' : 'none'}">
            {#if TabletDrawerAudio}
                <svelte:component this={TabletDrawerAudio} />
            {/if}
        </div>
    {/if}

    {#if loaded.includes("overlays")}
        <div style="display: {id === 'overlays' ? 'contents' : 'none'}">
            {#if TabletDrawerOverlays}
                <svelte:component this={TabletDrawerOverlays} {searchValue} />
            {/if}
        </div>
    {/if}

    {#if loaded.includes("templates")}
        <div style="display: {id === 'templates' ? 'contents' : 'none'}">
            {#if TabletDrawerTemplates}
                <svelte:component this={TabletDrawerTemplates} {searchValue} />
            {/if}
        </div>
    {/if}

    {#if loaded.includes("scripture")}
        <div style="height: 100%; overflow: hidden; display: {id === 'scripture' ? 'flex' : 'none'}; flex-direction: column;">
            {#if Scripture}
                <svelte:component this={Scripture} tablet searchValueFromDrawer={searchValue} on:search-clear={handleScriptureSearchClear} />
            {/if}
        </div>
    {/if}

    {#if loaded.includes("calendar")}
        <div style="display: {id === 'calendar' ? 'contents' : 'none'}">
            {#if TabletDrawerCalendar}
                <svelte:component this={TabletDrawerCalendar} />
            {/if}
        </div>
    {/if}

    {#if loaded.includes("functions")}
        <div style="display: {id === 'functions' ? 'contents' : 'none'}">
            {#if TabletDrawerFunctions}
                <svelte:component this={TabletDrawerFunctions} />
            {/if}
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
