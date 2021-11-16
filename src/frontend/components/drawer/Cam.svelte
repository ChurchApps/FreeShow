<script lang="ts">
  import { outBackground } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import Loader from "../main/Loader.svelte"

  interface Cam {
    id: string
    name: string
  }
  export let cam: Cam

  let hasLoaded = false
  let columns: number = 4
  $: active = $outBackground?.type === "camera" && $outBackground.id === cam.id

  let videoElem: any

  let constraints: any = {
    video: {
      devideId: cam.id,
      width: { min: 1024, ideal: 1280, max: 1920 },
      height: { min: 576, ideal: 720, max: 1080 },
      // // width: { min: 640, ideal: 1920, max: 1920 },
      // height: { min: 400, ideal: 1080 },
      // aspectRatio: 1.777777778,
      // frameRate: { max: 30 },
      // facingMode: { exact: "user" }
    },
  }

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(function (mediaStream) {
      videoElem.srcObject = mediaStream
      hasLoaded = true
      videoElem.play()
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
  <video bind:this={videoElem}>
    <track kind="captions" />
  </video>

  <div class="label">
    {#if cam.id.includes("cam")}
      <!-- main -->
      <Icon id="camera" class="icon" size={1.2} />
    {:else}
      <!-- exernal -->
      <Icon id="window" class="icon" size={1.2} style="fill: var(--text);" />
    {/if}
    <span>
      {cam.name}
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

  .item video {
    max-width: 100%;
    max-height: 100%;
    align-self: center;
    pointer-events: none;
    -webkit-transform: scaleX(-1);
    transform: scaleX(-1);
  }

  .loader {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
</style>
