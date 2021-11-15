<script lang="ts">
  import { mediaFolders, outBackground } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import Loader from "../main/Loader.svelte"

  let columns: number = 4
  export let id: string
  export let name: string
  let url: string = $mediaFolders[id].url + "/" + name
  let extension: string = url.match(/\.[0-9a-z]+$/i)?.[0]!
  $: video = extension.includes("mp4") || extension.includes("mov")

  $: active = $outBackground?.id === id && $outBackground?.name === name

  let hover: boolean = false

  let canvas: any
  let videoElem: any
  let duration: number = 0

  let hasLoaded = false
  let time = false
  function loaded() {
    if (!hasLoaded && videoElem) {
      if (!time) {
        duration = videoElem.duration
        videoElem.currentTime = duration / 2
        time = true
      } else {
        canvas.width = videoElem.offsetWidth
        canvas.height = videoElem.offsetHeight
        canvas.getContext("2d").drawImage(videoElem, 0, 0, videoElem.offsetWidth, videoElem.offsetHeight)
        hasLoaded = true
      }
    }
  }

  // videoElem.preload = "metadata"
  // videoElem.src = url
  // // Load video in Safari / IE11
  // videoElem.muted = true
  // videoElem.playsInline = true
  // videoElem.play()

  function setBackground() {
    outBackground.set({ id, name })
  }

  function move(e: any) {
    if (hasLoaded && videoElem) {
      let percentage: number = e.offsetX / e.target.offsetWidth
      let steps: number = 10

      // let time = duration * percentage
      let time = duration * ((Math.floor(percentage * steps) * steps + steps) / 100)
      videoElem.currentTime = time
    }
  }
</script>

<div
  class="item"
  style="width: calc({100 / columns}% - 8px)"
  class:active
  on:click={setBackground}
  on:mouseenter={() => (hover = true)}
  on:mousemove={move}
  on:mouseleave={() => (hover = false)}
>
  {#if video}
    {#if !hasLoaded}
      <div class="loader">
        <Loader />
      </div>
    {/if}
    <canvas bind:this={canvas} />
    {#if !hasLoaded || hover}
      <video bind:this={videoElem} src={url} on:canplaythrough={loaded}>
        <track kind="captions" />
      </video>
    {/if}
  {:else}
    <img src={url} alt={name} />
  {/if}
  <div class="label">
    {#if video}
      <Icon id="movie" class="icon" size={1.2} />
    {:else}
      <Icon id="image" class="icon" size={1.2} style="fill: var(--text);" />
    {/if}
    <span>
      {name}
    </span>
  </div>
</div>

<style>
  .item {
    display: flex;
    position: relative;
    /* flex-direction: column; */
    justify-content: center;
    /* aspect-ratio: 16/9; */
    aspect-ratio: 16/10.3;
    background-color: var(--primary);
    padding-bottom: 25px;
  }

  .item.active {
    outline: 2px solid var(--secondary);
    outline-offset: 0px;
  }

  .item .label {
    display: flex;
    align-items: center;

    padding: 4px 6px;
    background-color: var(--primary-lighter);
    font-size: 0.8em;
    /* font-weight: bold; */
    height: 25px;

    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;

    position: absolute;
    bottom: 25px;
    transform: translateY(100%);
    width: 100%;
    text-align: center;
  }
  .label :global(.icon) {
    position: absolute;
  }
  .label span {
    width: 100%;
    margin: 0 24px;
    text-align: center;
    overflow-x: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item img,
  .item video,
  .item canvas {
    max-width: 100%;
    max-height: 100%;
    align-self: center;
    pointer-events: none;
  }

  .item video {
    /* TODO: fix positioning */
    position: absolute;
  }

  .loader {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
</style>
