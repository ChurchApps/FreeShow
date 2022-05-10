<script lang="ts">
  import { videoExtensions } from "../../../stores"
  import Camera from "../../output/Camera.svelte"
  import { getStyleResolution } from "../../slide/getStyleResolution"
  import Image from "./Image.svelte"

  export let name: any = ""
  export let path: string
  export let filter: any = ""
  export let flipped: boolean = false
  export let type: null | "media" | "image" | "video" | "camera" | "screen" = null
  export let hover: boolean = false
  export let loaded: boolean = type === "image"
  export let duration: number = 0
  export let videoElem: any = null

  // TODO: update
  $: if (!type || type === "image") duration = 0

  // type
  $: {
    if (type === null) {
      const extension = path.slice(path.lastIndexOf(".") + 1, path.length) || ""
      if ($videoExtensions.includes(extension)) type = "video"
    }
  }

  $: if (path && type === "video") loaded = false

  let canvas: any

  let time = false
  function ready() {
    if (!loaded && videoElem) {
      if (!time) {
        duration = videoElem.duration
        videoElem.currentTime = duration / 2
        time = true
      } else {
        canvas.width = videoElem.offsetWidth
        canvas.height = videoElem.offsetHeight
        canvas.getContext("2d").drawImage(videoElem, 0, 0, videoElem.offsetWidth, videoElem.offsetHeight)
        loaded = true
      }
    }
  }

  let width: number = 0
  let height: number = 0
</script>

<div class="main" bind:offsetWidth={width} bind:offsetHeight={height}>
  {#key path}
    {#if type === "video"}
      <div class="video" style="filter: {filter};{flipped ? 'transform: scaleX(-1);' : ''}">
        <canvas style={getStyleResolution({ width: canvas?.width || 0, height: canvas?.height || 0 }, width, height, "cover")} bind:this={canvas} />
        {#if !loaded || hover}
          <video style="position: absolute;" bind:this={videoElem} src={path} on:canplaythrough={ready}>
            <track kind="captions" />
          </video>
        {/if}
      </div>
    {:else if type === "camera"}
      <div bind:clientWidth={width} bind:clientHeight={height} style="height: 100%;">
        <!-- TODO: media height -->
        <Camera
          id={path}
          class="media"
          style="{getStyleResolution({ width: videoElem?.videoWidth || 0, height: videoElem?.videoHeight || 0 }, width, height, 'cover')};"
          bind:videoElem
        />
      </div>
    {:else}
      <!-- <img loading="lazy" src={path} alt={name} /> -->
      <Image src={path} alt={name} style="filter: {filter};{flipped ? 'transform: scaleX(-1);' : ''}" />
    {/if}
  {/key}
</div>

<style>
  .main,
  .video {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  /* canvas,
  .main :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  } */
</style>
