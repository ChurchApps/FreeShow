<script lang="ts">
  import { fade } from "svelte/transition"

  import type { Transition } from "../../../types/Show"

  import { mediaFolders, outputWindow } from "../../stores"

  export let transition: Transition
  export let id: string
  export let name: string
  export let video: any
  export let videoData: any

  $: console.log($mediaFolders, id, name)

  $: url = $mediaFolders[id].url + "/" + name || ""
  $: extension = url.match(/\.[0-9a-z]+$/i)?.[0]!
  $: isVideo = extension.includes("mp4") || extension.includes("mov")

  let muted = $outputWindow ? true : false
  let loop = true
  let alt = "Could not find image!"
</script>

<!-- TODO: display image stretch / scale -->
<div transition:fade={transition}>
  {#if isVideo}
    <!-- TODO: autoplay.... -->
    <video bind:this={video} bind:currentTime={videoData.time} bind:paused={videoData.paused} bind:duration={videoData.duration} src={url} autoplay {loop} {muted}>
      <track kind="captions" />
    </video>
  {:else}
    <img src={url} {alt} />
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

  img,
  video {
    max-width: 100%;
    max-height: 100%;
  }
</style>
