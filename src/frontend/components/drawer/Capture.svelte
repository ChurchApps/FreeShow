<script lang="ts">
  import { outBackground } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import Loader from "../main/Loader.svelte"

  interface Screen {
    id: string
    name: string
  }
  export let screen: Screen

  let hasLoaded = false
  let columns: number = 4
  $: active = $outBackground?.type === "screen" && $outBackground?.id === screen.id

  let canvas: any
  let videoElem: any

  function loaded() {
    if (!hasLoaded && videoElem) {
      canvas.width = videoElem.offsetWidth
      canvas.height = videoElem.offsetHeight
      canvas.getContext("2d").drawImage(videoElem, 0, 0, videoElem.offsetWidth, videoElem.offsetHeight)
      hasLoaded = true
    }
  }

  let constraints: any = {
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: screen.id,
        maxWidth: 1920,
        maxHeight: 1080,
        // maxAspectRatio: 16/9,
        maxFrameRate: 60,
      },
    },
  }

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      videoElem.srcObject = stream
      videoElem.onloadedmetadata = function () {
        videoElem?.play()
        setTimeout(loaded, 1000)
      }
    })
    .catch(function (err) {
      console.log(err.name + ": " + err.message)
    })
</script>

<div class="item" style="width: calc({100 / columns}% - 8px)" class:active on:click>
  {#if !hasLoaded}
    <div class="loader">
      <Loader />
    </div>
  {/if}
  <canvas bind:this={canvas} />
  {#if !hasLoaded}
    <video bind:this={videoElem}>
      <track kind="captions" />
    </video>
  {/if}

  <div class="label">
    {#if screen.id.includes("screen")}
      <Icon id="screen" class="icon" size={1.2} />
    {:else}
      <Icon id="window" class="icon" size={1.2} style="fill: var(--text);" />
    {/if}
    <span>
      {screen.name}
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
