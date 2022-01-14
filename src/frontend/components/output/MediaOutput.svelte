<script lang="ts">
  import { fade } from "svelte/transition"
  import { OUTPUT } from "../../../types/Channels"
  import type { Transition } from "../../../types/Show"
  import { mediaFolders, outBackground, outputWindow, videoExtensions } from "../../stores"
  import { getStyleResolution } from "../slide/getStyleResolution"
  import Camera from "./Camera.svelte"
  import Window from "./Window.svelte"

  export let transition: Transition
  export let path: string = ""
  export let id: string = ""
  export let name: string = ""
  export let type: string = "media"
  export let startAt: number = 0
  export let video: any
  export let videoData: any
  export let videoTime: any

  $: if (!path.length && type === "media") path = $mediaFolders[id].path + "/" + name || ""
  $: extension = path.match(/\.[0-9a-z]+$/i)?.[0]! || ""
  $: isVideo = $videoExtensions.includes(extension.substring(1))

  // $: if ($outputWindow && !videoData.muted) videoData.muted = $outputWindow
  let alt = "Could not find image!"

  let width: number = 0
  let height: number = 0

  // outBackground.subscribe((_a) => {
  //   videoTime = startAt
  //   window.api.send(OUTPUT, { channel: "VIDEO_TIME", data: videoTime })
  // })

  let filter: string = ""

  let hasLoaded: boolean = false
  let autoMute: boolean = false
  function loaded() {
    if (!$outputWindow) {
      console.log("LOADED")
      hasLoaded = true

      if ($outBackground?.muted !== undefined) videoData.muted = $outBackground.muted
      if ($outBackground?.loop !== undefined) videoData.loop = $outBackground.loop
      // if ($outBackground?.filter !== undefined) filter = $outBackground.filter
      else videoData.muted = false

      if (!videoData.muted) {
        autoMute = true
        videoData.muted = true
      }
    }
  }
  function playing() {
    if (hasLoaded && !$outputWindow) {
      console.log("PLAYING")
      videoData.paused = true
      setTimeout(() => {
        videoTime = startAt || 0
        window.api.send(OUTPUT, { channel: "VIDEO_TIME", data: videoTime })
        setTimeout(() => window.api.send(OUTPUT, { channel: "VIDEO_TIME", data: videoTime }), 100)

        if (autoMute) {
          autoMute = false
          videoData.muted = false
        }
        videoData.paused = false
        startAt = 0
      }, 50)
      hasLoaded = false
    }
  }

  $: if ($outBackground) setUpdater()
  // let bg: any = null
  let oldFilter: string = ""
  setUpdater()
  function setUpdater() {
    let temp: any = { ...$outBackground }
    if (temp.filter !== undefined) {
      filter = temp.filter
      delete temp.filter
    }

    if (oldFilter === filter) videoTime = 0
    else oldFilter = filter
  }
</script>

<!-- TODO: display image stretch / scale -->
<div transition:fade={transition} bind:clientWidth={width} bind:clientHeight={height}>
  {#if type === "media"}
    {#if isVideo}
      <!-- {#key bg} -->
      <!-- TODO: autoplay.... -->
      <video
        class="media"
        style="{getStyleResolution({ width: video?.videoWidth || 0, height: video?.videoHeight || 0 }, width, height, 'cover')};filter: {filter};"
        bind:this={video}
        on:loadedmetadata={loaded}
        on:playing={playing}
        bind:currentTime={videoTime}
        bind:paused={videoData.paused}
        bind:duration={videoData.duration}
        bind:muted={videoData.muted}
        src={path}
        autoplay
        loop={videoData.loop || false}
      >
        <track kind="captions" />
      </video>
      <!-- {/key} -->
    {:else}
      <!-- style={getStyleResolution({ width: image?.naturalWidth || 0, height: image?.naturalHeight || 0 }, width, height, "cover")} -->
      <img class="media" style="object-fit: contain;width: 100%;height: 100%;filter: {filter};" src={path} {alt} />
    {/if}
  {:else if type === "screen"}
    <Window {id} class="media" />
  {:else if type === "camera"}
    <Camera {id} class="media" />
  {/if}
</div>

<style>
  /* hide alt text */
  img {
    text-indent: 100%;
    white-space: nowrap;
    overflow: hidden;
  }

  div {
    /* position: relative; */
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  div :global(.media) {
    max-width: 100%;
    max-height: 100%;
  }
</style>
