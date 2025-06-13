<script lang="ts">
    import type { Bible } from "../../../types/Scripture"
    import { drawerTabsData } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
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
    export let bibles: Bible[]
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
        streams.forEach((stream) => {
            stream.getTracks().forEach((track) => {
                track.enabled = false
                track.stop()
            })
        })
    }
</script>

<div class="main">
    {#if searchValue && searchTab !== id + active && id !== "scripture"}
        <div class="warning">
            <p style="padding: 6px 8px;"><T id="main.search_active" />: <span style="color: var(--secondary);font-weight: bold;">{searchValue}</span></p>
            <Button on:click={() => (searchValue = "")} dark>
                <Icon id="close" right />
                <p><T id="clear.search" /></p>
            </Button>
        </div>
    {/if}

    {#if id === "shows"}
        <Shows {id} {active} {searchValue} bind:firstMatch />
    {:else if id === "media"}
        <Media {active} {searchValue} bind:streams />
    {:else if id === "audio"}
        <Audio {active} {searchValue} />
    {:else if id === "overlays"}
        <Overlays {active} {searchValue} />
    {:else if id === "templates"}
        <Templates {active} {searchValue} />
    {:else if id === "scripture"}
        <Scripture {active} bind:searchValue bind:bibles />
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
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        background-color: var(--primary-darker);
        flex: 1;
    }

    .warning {
        display: flex;
        justify-content: space-between;
        background-color: var(--primary-darkest);
    }
</style>
