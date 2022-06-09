<script lang="ts">
  import { drawerTabsData, mediaOptions } from "../../stores"
  import Cameras from "./live/Cameras.svelte"
  import Microphones from "./live/Microphones.svelte"
  import Windows from "./live/Windows.svelte"
  import Overlays from "./Overlays.svelte"
  import Scripture from "./bible/Scripture.svelte"
  import Shows from "./Shows.svelte"
  import Web from "./Web.svelte"
  import Player from "./player/Player.svelte"
  import Screens from "./live/Screens.svelte"
  import Center from "../system/Center.svelte"
  import Templates from "./Templates.svelte"
  import Media from "./media/Media.svelte"

  export let id: string
  export let bible: any
  export let searchValue: string
  export let firstMatch: null | string
  $: active = $drawerTabsData[id].activeSubTab

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

    console.log("STOP")

    streams.forEach((stream: any) => {
      stream.getTracks().forEach((track: any) => {
        console.log(track)
        track.enabled = false
        track.stop()
      })
    })
  }

  function wheel(e: any) {
    if (e.ctrlKey || e.metaKey) mediaOptions.set({ ...$mediaOptions, columns: Math.max(2, Math.min(10, $mediaOptions.columns + e.deltaY / 100)) })
  }
</script>

<div class="main">
  {#if id === "shows"}
    <Shows {id} {active} {searchValue} bind:firstMatch />
  {:else if id === "media"}
    <Media {active} />
  {:else if id === "overlays"}
    <Overlays {active} />
  {:else if id === "templates"}
    <Templates {active} />
  {:else if id === "audio"}
    <Center>WIP</Center>
  {:else if id === "scripture"}
    <Scripture {active} bind:searchValue bind:bible />
  {:else if id === "player"}
    <Player {active} />
  {:else if id === "web"}
    <Web {active} {searchValue} />
  {:else if id === "live"}
    <div class="grid" on:wheel={wheel}>
      <!-- live -->
      <!-- screens -->
      {#if active === "screens"}
        <Screens bind:streams />
      {:else if active === "windows"}
        <Windows bind:streams />
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
