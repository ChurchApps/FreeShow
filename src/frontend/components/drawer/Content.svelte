<script lang="ts">
    import type { Bible } from "../../../types/Scripture"
    import { drawerTabsData } from "../../stores"
    import Audio from "./audio/Audio.svelte"
    import Scripture from "./bible/Scripture.svelte"
    import Calendar from "./calendar/Calendar.svelte"
    import Effects from "./effects/Effects.svelte"
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
        {:else if active === "effects"}
            <Effects {active} {searchValue} />
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
</style>
