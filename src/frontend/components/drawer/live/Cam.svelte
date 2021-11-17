<script lang="ts">
  import { outBackground } from "../../../stores"
  import Card from "../Card.svelte"
  import Label from "../Label.svelte"

  interface Cam {
    id: string
    name: string
  }
  export let cam: Cam

  let loaded: boolean = false
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
      loaded = true
      videoElem.play()
    })
    .catch(function (err) {
      console.log(err.name + ": " + err.message)
    })
</script>

<Card {loaded} {active} on:click>
  <video bind:this={videoElem}>
    <track kind="captions" />
  </video>

  <Label label={cam.name} icon={cam.id.includes("cam") ? "camera" : "window"} white={!cam.id.includes("cam")} />
</Card>

<style>
  video {
    -webkit-transform: scaleX(-1);
    transform: scaleX(-1);
  }
</style>
