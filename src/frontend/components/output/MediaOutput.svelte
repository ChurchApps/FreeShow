<script lang="ts">
  import { fade } from "svelte/transition"
  import type { Transition } from "../../../types/Show"
  import { mediaFolders, outputWindow } from "../../stores"
  import { getStyleResolution } from "../slide/getStyleResolution"
  import Camera from "./Camera.svelte"
  import Window from "./Window.svelte"

  export let transition: Transition
  export let url: string = ""
  export let id: string = ""
  export let name: string = ""
  export let type: string = "media"
  export let video: any
  export let videoData: any
  export let videoTime: any

  $: {
    if (!url.length && type === "media") url = $mediaFolders[id].url + "/" + name || ""
  }
  $: extension = url.match(/\.[0-9a-z]+$/i)?.[0]! || ""
  $: isVideo = extension.includes("mp4") || extension.includes("mov")

  let image: any
  $: console.log(image?.width, image?.height)
  $: console.log(image?.naturalWidth, image?.naturalHeight)

  let muted = $outputWindow ? true : false
  let loop = true
  let alt = "Could not find image!"
</script>

<!-- TODO: display image stretch / scale -->
<div transition:fade={transition}>
  {#if type === "media"}
    {#if isVideo}
      <!-- TODO: autoplay.... -->
      <video
        class="media"
        style={getStyleResolution({ width: video?.videoWidth || 0, height: video?.videoHeight || 0 }, window.innerWidth, window.innerHeight, "cover")}
        bind:this={video}
        bind:currentTime={videoTime}
        bind:paused={videoData.paused}
        bind:duration={videoData.duration}
        src={url}
        autoplay
        {loop}
        {muted}
      >
        <track kind="captions" />
      </video>
    {:else}
      <img
        class="media"
        style={getStyleResolution({ width: image?.naturalWidth || 0, height: image?.naturalHeight || 0 }, window.innerWidth, window.innerHeight, "cover")}
        bind:this={image}
        src={url}
        {alt}
      />
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
