<script lang="ts">
  import type { Resolution } from "../../../../types/Settings"
  import { mediaCache, screen, videoExtensions } from "../../../stores"
  import Camera from "../../output/Camera.svelte"
  import { getStyleResolution } from "../../slide/getStyleResolution"
  // import Image from "./Image.svelte"

  export let name: any = ""
  export let path: string
  export let filter: any = ""
  export let flipped: boolean = false
  export let type: null | "media" | "image" | "video" | "camera" | "screen" | "audio" = null
  export let hover: boolean = false
  export let loaded: boolean = type === "image"
  export let duration: number = 0
  export let videoElem: any = null

  // TODO: update
  $: if ((!type || type === "image") && canvas) {
    duration = 0

    // image cache
    loadImage()
  }

  // const thumbnailSize = {width: 240, height: 135}
  const thumbnailSize = { width: 160, height: 90 }
  // const thumbnailSize = { width: 80, height: 45 }

  function loadImage() {
    img = new Image()

    let cache = $mediaCache[path]
    let src: string = path
    if (cache) src = cache.data
    console.log(name)

    img.src = src
    canvas.width = thumbnailSize.width
    canvas.height = thumbnailSize.height

    if (cache) checkIfCacheLoaded()
    else checkIfLoaded()
  }

  let img: any = null
  function checkIfLoaded(): any {
    if (!img.complete) return setTimeout(checkIfLoaded, 100)

    let width = img.naturalWidth || thumbnailSize.width
    let height = img.naturalHeight || thumbnailSize.height
    let x = 0
    let y = 0

    if (width / height > 16 / 9) {
      height = height / (width / thumbnailSize.width)
      width = thumbnailSize.width
      y = (thumbnailSize.height - height) / 2
    } else {
      width = width / (height / thumbnailSize.height)
      height = thumbnailSize.height
      x = (thumbnailSize.width - width) / 2
    }

    // canvas?.getContext("2d").drawImage(img, 0, 0, 160, 90)
    setTimeout(() => {
      canvas?.getContext("2d").drawImage(img, x, y, width, height)
      setTimeout(() => {
        if (canvas) {
          mediaCache.update((a) => {
            a[path] = { data: canvas.toDataURL() }
            // a[path] = { data: canvas.toDataURL(), width, height, x, y }
            return a
          })
          // canvas?.getContext("2d").clearRect(0, 0, 160, 90)
          // canvas?.getContext("2d").drawImage(img, x, y, width, height)
        }
      }, 100)
    }, 50)
  }

  function checkIfCacheLoaded(): any {
    if (!img.complete) return setTimeout(checkIfCacheLoaded, 100)

    // let cache = $mediaCache[path]
    // canvas?.getContext("2d").drawImage(img, cache.x, cache.y, cache.width, cache.height)
    canvas?.getContext("2d").drawImage(img, 0, 0, 160, 90)
  }

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
    if (loaded || !videoElem) return

    // check cache
    let cache: any = $mediaCache[path]
    if (cache) {
      // TODO: cache
      var img = new window.Image()
      // console.log(cache)
      img.src = cache.data

      canvas.width = cache.width
      canvas.height = cache.height
      setTimeout(() => {
        canvas?.getContext("2d").drawImage(img, 0, 0, cache.width, cache.height)
        // canvas.getContext("2d").drawImage(videoElem, 0, 0, cache.width, cache.height)
      }, 200)

      duration = videoElem.duration
      videoElem.currentTime = duration / 2
      time = true

      loaded = true
      return
    }

    if (!time) {
      duration = videoElem.duration
      videoElem.currentTime = duration / 2
      time = true
    } else {
      let width = videoElem.offsetWidth
      let height = videoElem.offsetHeight
      canvas.width = width
      canvas.height = height
      canvas.getContext("2d").drawImage(videoElem, 0, 0, width, height)

      // set cache
      setTimeout(() => {
        mediaCache.update((a: any) => {
          a[path] = { data: canvas.toDataURL(), width, height }
          return a
        })
      }, 100)

      loaded = true
    }
  }

  let width: number = 0
  let height: number = 0

  let resolution: Resolution = $screen.resolution
</script>

<div class="main" style="aspect-ratio: {resolution.width}/{resolution.height};" bind:offsetWidth={width} bind:offsetHeight={height}>
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
      <!-- {getStyleResolution({ width: canvas?.width || 0, height: canvas?.height || 0 }, width, height, 'cover')}; -->
      <canvas style="width: 100%;height: 100%;filter: {filter};{flipped ? 'transform: scaleX(-1);' : ''}" bind:this={canvas} />
      <!-- <Image src={path} alt={name} style="filter: {filter};{flipped ? 'transform: scaleX(-1);' : ''}" /> -->
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
