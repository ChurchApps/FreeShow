<script lang="ts">
    import { drawerTabsData } from "../../stores"
    import Calendar from "../calendar/Calendar.svelte"
    import Overlays from "./Overlays.svelte"
    import Shows from "./Shows.svelte"
    import Templates from "./Templates.svelte"
    import Triggers from "./Triggers.svelte"
    import Variables from "./Variables.svelte"
    import Audio from "./audio/Audio.svelte"
    import Scripture from "./bible/Scripture.svelte"
    import Effects from "./effects/Effects.svelte"
    import Media from "./media/Media.svelte"
    import Timers from "./timers/Timers.svelte"

    export let id: string
    export let bibles: any
    export let searchValue: string
    export let firstMatch: null | string
    $: active = $drawerTabsData[id]?.activeSubTab || null

    let streams: any = []
    $: {
        if (id !== "media" || active) stopStreams()
    }
    function stopStreams() {
        //     // TODO: check if in output!!
        // navigator.mediaDevices
        //   .getUserMedia({
        //     audio: true,
        //     video: true,
        //   })
        //   .then((stream: any) => {
        //     console.log(stream)
        //     stream.getTracks().forEach((track: any) => {
        //       console.log(track)
        //       track.stop()
        //     })
        //   })

        // console.log("STOP")

        streams.forEach((stream: any) => {
            stream.getTracks().forEach((track: any) => {
                console.log(track)
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
    {:else if id === "overlays"}
        {#if active === "variables"}
            <Variables {searchValue} />
        {:else if active === "triggers"}
            <Triggers {searchValue} />
        {:else}
            <Overlays {active} {searchValue} />
        {/if}
    {:else if id === "audio"}
        <Audio {active} {searchValue} />
    {:else if id === "effects"}
        <Effects {active} {searchValue} />
    {:else if id === "scripture"}
        <Scripture {active} bind:searchValue bind:bibles />
    {:else if id === "calendar"}
        {#if active === "timer"}
            <Timers {searchValue} />
        {:else}
            <Calendar {active} {searchValue} />
        {/if}
    {:else if id === "templates"}
        <Templates {active} {searchValue} />
        <!-- {:else if id === "web"}
    <Web {active} {searchValue} /> -->
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
