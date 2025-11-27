<script lang="ts">
    import { drawerTabsData } from "../../stores"
    import T from "../helpers/T.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import Audio from "./audio/Audio.svelte"
    import Scripture from "./bible/Scripture.svelte"
    import Calendar from "./calendar/Calendar.svelte"
    import Media from "./media/Media.svelte"
    import Actions from "./pages/Actions.svelte"
    import Overlays from "./pages/Overlays.svelte"
    import Shows from "./pages/Shows.svelte"
    import Templates from "./pages/Templates.svelte"
    import Triggers from "./pages/Triggers.svelte"
    import Variables from "./pages/Variables.svelte"
    import Timers from "./timers/Timers.svelte"

    export let id: string
    export let searchValue: string
    export let firstMatch: null | string
    $: active = $drawerTabsData[id]?.activeSubTab || null

    // search active warning
    let searchTab: string | null = null
    $: if (searchValue) updateTab()
    function updateTab() {
        searchTab = id + active
    }

    let streams: MediaStream[] = []
    $: if (id !== "media" || active) stopStreams()

    function stopStreams() {
        streams.forEach(stream => {
            stream.getTracks().forEach(track => {
                track.enabled = false
                track.stop()
            })
        })
    }
</script>

<div class="main">
    {#if searchValue && active !== "all" && searchTab !== id + active && id !== "scripture"}
        <div class="warning">
            <p style="padding: 6px 8px;"><T id="main.search_active" />: <span style="color: var(--secondary);font-weight: bold;">{searchValue}</span></p>
            <MaterialButton icon="close" style="padding: 6px 16px;" on:click={() => (searchValue = "")}>
                <p><T id="clear.search" /></p>
            </MaterialButton>
        </div>
    {/if}

    {#if id === "shows"}
        <Shows {active} {searchValue} bind:firstMatch />
    {:else if id === "media"}
        <Media {active} {searchValue} bind:streams />
    {:else if id === "audio"}
        <Audio {active} {searchValue} />
    {:else if id === "overlays"}
        <Overlays {active} {searchValue} />
    {:else if id === "templates"}
        <Templates {active} {searchValue} />
    {:else if id === "scripture"}
        <Scripture {active} bind:searchValue />
    {:else if id === "calendar"}
        <Calendar {active} {searchValue} />
    {:else if id === "functions"}
        {#if active === "actions"}
            <Actions {searchValue} />
        {:else if active === "timer"}
            <Timers {searchValue} />
        {:else if active === "variables"}
            <Variables {searchValue} />
        {:else if active === "triggers"}
            <Triggers {searchValue} />
        {/if}
    {/if}
</div>

<style>
    .main {
        position: relative;

        overflow-y: auto;

        display: flex;
        flex-direction: column;
        flex: 1;

        background-color: var(--primary-darker);
    }

    .warning {
        display: flex;
        justify-content: space-between;
        background-color: var(--primary-darkest);
    }
</style>
