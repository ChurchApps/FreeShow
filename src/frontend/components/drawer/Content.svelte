<script lang="ts">
  import { drawerTabsData } from "../../stores"
  import Cameras from "./live/Cameras.svelte"
  import Microphones from "./live/Microphones.svelte"
  import Windows from "./live/Windows.svelte"
  import Overlays from "./Overlays.svelte"
  import Scripture from "./bible/Scripture.svelte"
  import Backgrounds from "./media/Backgrounds.svelte"
  import Shows from "./Shows.svelte"
  import Web from "./Web.svelte"
  import Player from "./player/Player.svelte"
  import Screens from "./live/Screens.svelte"

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

    streams.forEach((stream: any) => {
      stream.getTracks().forEach((track: any) => {
        console.log(track)
        track.stop()
      })
    })
  }
</script>

<div class="main">
  {#if id === "shows"}
    <Shows {id} {active} {searchValue} bind:firstMatch />
  {:else if id === "backgrounds"}
    <Backgrounds {active} />
  {:else if id === "overlays"}
    <!-- <div class="grid"> -->
    <Overlays />
    <!-- </div> -->
  {:else if id === "scripture"}
    <Scripture {active} bind:bible />
  {:else if id === "player"}
    <Player {active} />
  {:else if id === "web"}
    <Web {active} {searchValue} />
  {:else if id === "live"}
    <div class="grid">
      <!-- live -->
      <!-- screens -->
      {#if active === "screens"}
        <Screens bind:streams />
      {:else if active === "windows"}
        <Windows bind:streams />
      {:else if active === "cameras"}
        <Cameras bind:streams />
      {:else if active === "microphones"}
        <Microphones bind:streams />
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
