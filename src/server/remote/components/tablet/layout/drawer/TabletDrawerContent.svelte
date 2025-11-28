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
</script>

<div class="main">
    {#if id === "shows"}
        <TabletDrawerShows {searchValue} />
    {:else if id === "media"}
        <TabletDrawerMedia />
    {:else if id === "audio"}
        <TabletDrawerAudio />
    {:else if id === "overlays"}
        <TabletDrawerOverlays {searchValue} />
    {:else if id === "templates"}
        <TabletDrawerTemplates />
    {:else if id === "scripture"}
        <div style="height: 100%; overflow: hidden; display: flex; flex-direction: column;">
            <Scripture tablet searchValueFromDrawer={searchValue} on:search-clear={handleScriptureSearchClear} />
        </div>
    {:else if id === "calendar"}
        <TabletDrawerCalendar />
    {:else if id === "functions"}
        <TabletDrawerFunctions />
    {:else}
        <div style="padding: 20px; text-align: center; opacity: 0.5;">
            Content for {id} not implemented yet
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
