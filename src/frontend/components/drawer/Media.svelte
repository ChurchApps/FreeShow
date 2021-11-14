<script lang="ts">
  import { mediaFolders } from "../../stores"

  let columns: number = 4
  export let id: string
  export let name: string
  let url: string = $mediaFolders[id].url + "/" + name
  let extension: string = url.match(/\.[0-9a-z]+$/i)?.[0]!
  $: video = extension.includes("mp4") || extension.includes("mov")

  let canvas: any
  let videoElem: any

  let hasLoaded = false
  let time = false
  function loaded() {
    if (!hasLoaded) {
      if (!time) {
        videoElem.currentTime = videoElem.duration / 2
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
    console.log(id)
  }
</script>

<div class="item" style="width: calc({100 / columns}% - 8px)">
  {#if video}
    <!-- TODO: mouseover -->
    <canvas bind:this={canvas} on:click={setBackground} />
    {#if !hasLoaded}
      <video bind:this={videoElem} src={url} on:canplaythrough={loaded}>
        <track kind="captions" />
      </video>
    {/if}
  {:else}
    <img src={url} alt={name} on:click={setBackground} />
  {/if}
  <span>{name}</span>
</div>

<style>
  .item {
    display: flex;
    position: relative;
    /* flex-direction: column; */
    justify-content: center;
    aspect-ratio: 16/9;
    background-color: var(--primary);
    margin-bottom: 20px;
  }

  .item span {
    padding: 4px 10px;
    background-color: var(--secondary);
    font-size: 0.8em;
    /* font-weight: bold; */

    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;

    position: absolute;
    bottom: 0;
    transform: translateY(100%);
    width: 100%;
    text-align: center;
  }

  .item img,
  .item video,
  .item canvas {
    max-width: 100%;
    max-height: 100%;
    align-self: center;
  }

  .item video {
    position: absolute;
  }
</style>
