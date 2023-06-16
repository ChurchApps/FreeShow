<script lang="ts">
    import { drawerTabsData, mediaOptions } from "../../stores"
    import Timers from "./timers/Timers.svelte"
    import Audio from "./audio/Audio.svelte"
    import Scripture from "./bible/Scripture.svelte"
    import Cameras from "./live/Cameras.svelte"
    import Microphones from "./live/Microphones.svelte"
    import Screens from "./live/Screens.svelte"
    import Windows from "./live/Windows.svelte"
    import Media from "./media/Media.svelte"
    import Overlays from "./Overlays.svelte"
    import Player from "./player/Player.svelte"
    import Shows from "./Shows.svelte"
    import Templates from "./Templates.svelte"
    import Effects from "./effects/Effects.svelte"

    export let id: string
    export let bibles: any
    export let searchValue: string
    export let firstMatch: null | string
    $: active = $drawerTabsData[id]?.activeSubTab || null

    let streams: any = []
    $: {
        if (id !== "live" || active) stopStreams()
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

    let nextScrollTimeout: any = null
    function wheel(e: any) {
        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout) return

        mediaOptions.set({ ...$mediaOptions, columns: Math.max(2, Math.min(10, $mediaOptions.columns + (e.deltaY < 0 ? -100 : 100) / 100)) })

        // don't start timeout if scrolling with mouse
        if (e.deltaY > 100 || e.deltaY < -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }
</script>

<div class="main">
    {#if id === "shows"}
        <Shows {id} {active} {searchValue} bind:firstMatch />
    {:else if id === "media"}
        <Media {active} {searchValue} />
    {:else if id === "overlays"}
        <Overlays {active} {searchValue} />
    {:else if id === "audio"}
        <Audio {active} {searchValue} />
    {:else if id === "effects"}
        <Effects {active} {searchValue} />
    {:else if id === "scripture"}
        <Scripture {active} bind:searchValue bind:bibles />
    {:else if id === "templates"}
        <Templates {active} {searchValue} />
    {:else if id === "player"}
        <Player {active} {searchValue} />
    {:else if id === "timers"}
        <Timers {active} {searchValue} />
        <!-- {:else if id === "web"}
    <Web {active} {searchValue} /> -->
    {:else if id === "live"}
        <div class="grid" on:wheel={wheel}>
            <!-- live -->
            <!-- screens -->
            {#if active === "screens"}
                <Screens bind:streams />
            {:else if active === "windows"}
                <Windows bind:streams {searchValue} />
            {:else if active === "cameras"}
                <Cameras />
            {:else if active === "microphones"}
                <Microphones />
            {/if}
        </div>
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

    .grid {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        padding: 5px;
        place-content: flex-start;
    }
</style>
