<script lang="ts">
  import { outputs } from "../../../stores"
  import { findMatchingOut } from "../../helpers/output"
  import Card from "../Card.svelte"

  interface Screen {
    id: string
    name: string
  }
  export let screen: Screen
  export let streams: any[]

  let loaded = false
  // $: currentOutput = $outputs[getActiveOutputs()[0]]
  // $: active = currentOutput.out?.background?.type === "screen" && currentOutput.out?.background?.id === screen.id

  let canvas: any
  let videoElem: any

  function ready() {
    if (!loaded && videoElem) {
      console.log(screen.name)
      canvas.width = videoElem.offsetWidth
      canvas.height = videoElem.offsetHeight
      canvas.getContext("2d").drawImage(videoElem, 0, 0, videoElem.offsetWidth, videoElem.offsetHeight)
      loaded = true
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

  // let timeout: number = 0
  // if (screen.name === "FreeShow") timeout = 1000
  // setTimeout(() => {
  //   console.log(screen.name)

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      streams.push(stream)
      videoElem.srcObject = stream
      videoElem.onloadedmetadata = () => {
        videoElem?.play()
        setTimeout(ready, 1000)
      }
    })
    .catch(function (err) {
      console.log(err.name + ": " + err.message)
    })
  // }, timeout)
</script>

<Card
  class="context #live_card"
  {loaded}
  outlineColor={findMatchingOut(screen.id, $outputs)}
  active={findMatchingOut(screen.id, $outputs) !== null}
  on:click
  label={screen.name}
  icon={screen.id.includes("screen") ? "screen" : "window"}
  white={!screen.id.includes("screen")}
>
  <canvas bind:this={canvas} />
  {#if !loaded}
    <video bind:this={videoElem}>
      <track kind="captions" />
    </video>
  {/if}
</Card>

<style>
  video {
    /* TODO: fix positioning */
    position: absolute;
  }

  canvas {
    width: 100%;
    height: 100%;
  }
</style>
