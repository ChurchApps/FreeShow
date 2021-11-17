<script lang="ts">
  import { outBackground } from "../../../stores"
  import Card from "../Card.svelte"
  import Label from "../Label.svelte"

  interface Screen {
    id: string
    name: string
  }
  export let screen: Screen

  let loaded = false
  $: active = $outBackground?.type === "screen" && $outBackground?.id === screen.id

  let canvas: any
  let videoElem: any

  function ready() {
    if (!loaded && videoElem) {
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

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      videoElem.srcObject = stream
      videoElem.onloadedmetadata = function () {
        videoElem?.play()
        setTimeout(ready, 1000)
      }
    })
    .catch(function (err) {
      console.log(err.name + ": " + err.message)
    })
</script>

<Card {loaded} {active} on:click>
  <canvas bind:this={canvas} />
  {#if !loaded}
    <video bind:this={videoElem}>
      <track kind="captions" />
    </video>
  {/if}

  <Label label={screen.name} icon={screen.id.includes("screen") ? "screen" : "window"} white={!screen.id.includes("screen")} />
</Card>

<style>
  video {
    /* TODO: fix positioning */
    position: absolute;
  }
</style>
