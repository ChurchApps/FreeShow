<script lang="ts">
  import { videoExtensions } from "../../../stores"
  import { getStyleResolution } from "../../slide/getStyleResolution"
  import Image from "./Image.svelte"

  export let name: any = ""
  export let path: string
  export let type: null | "media" | "image" | "video" | "camera" | "screen" = null
  export let hover: boolean = false
  export let loaded: boolean = type === "image"
  export let duration: number = 0
  export let videoElem: any = null

  // type
  $: {
    if (type === null) {
      const [extension] = path.substring(path.lastIndexOf("\\") + 1).match(/\.[0-9a-z]+$/i) || [""]
      if ($videoExtensions.includes(extension.substring(1))) type = "video"
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
      <div class="video">
        <canvas style={getStyleResolution({ width: canvas?.width || 0, height: canvas?.height || 0 }, width, height, "cover")} bind:this={canvas} />
        {#if !loaded || hover}
          <video style="position: absolute;" bind:this={videoElem} src={path} on:canplaythrough={ready}>
            <track kind="captions" />
          </video>
        {/if}
      </div>
    {:else}
      <!-- <img loading="lazy" src={path} alt={name} /> -->
      <Image src={path} alt={name} />
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
