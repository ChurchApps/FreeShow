<script lang="ts">
  import { outBackground } from "../../../stores"
  import SelectElem from "../../system/SelectElem.svelte"
  import Card from "../Card.svelte"

  interface Cam {
    id: string
    name: string
  }
  export let cam: Cam
  export let streams: any[]

  let loaded: boolean = false
  $: active = $outBackground?.type === "camera" && $outBackground.id === cam.id

  let videoElem: any

  $: console.log(cam.id)

  let constraints: any = {
    video: {
      devideId: cam.id,
      // width: { min: 640, ideal: 1280, max: 1920 },
      // height: { min: 480, ideal: 720, max: 1080 },
      // width: { ideal: 1280 },
      // height: { ideal: 720 },
      // // width: { min: 640, ideal: 1920, max: 1920 },
      // height: { min: 400, ideal: 1080 },
      // aspectRatio: 1.777777778,
      // frameRate: { max: 30 },
      // facingMode: { exact: "user" }
    },
  }
  if (cam.id === "a2b27f8ca8089f307ba980dea8f39128bc43eaf4c8a677fd6ad67350ed9f04be") constraints.video.width = { ideal: 1280 }
  console.log(constraints)

  let error: null | string = null

  console.log(navigator.mediaDevices.getUserMedia(constraints))

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((mediaStream) => {
      streams.push(mediaStream)
      console.log(mediaStream)

      videoElem.srcObject = mediaStream
      // videoElem.width = 1920
      // videoElem.height = 1080
      loaded = true
      videoElem.play()
    })
    .catch((err) => {
      // console.error(err.name + ": " + err.message)
      let msg: string = err.message
      if (err.name === "NotReadableError") msg += "<br />Maybe it's in use by another program."
      error = err.name + ":<br />" + msg
      loaded = true
    })
</script>

<Card class="context #live_card" {loaded} {active} on:click label={cam.name} icon="camera" white={!cam.id.includes("cam")}>
  <SelectElem id="camera" data={{ id: cam.id, type: "camera" }} draggable>
    {#if error}
      <div class="error">
        {@html error}
      </div>
    {:else}
      <video bind:this={videoElem}>
        <track kind="captions" />
      </video>
    {/if}
  </SelectElem>
</Card>

<style>
  /* video {
    -webkit-transform: scaleX(-1);
    transform: scaleX(-1);
  } */

  .error {
    align-self: center;
    text-align: center;
    color: #ff9a9a;
  }
</style>
