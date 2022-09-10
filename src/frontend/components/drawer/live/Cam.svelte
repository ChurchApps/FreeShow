<script lang="ts">
  import { onDestroy, onMount } from "svelte"
  import { outputs } from "../../../stores"
  import { findMatchingOut, getResolution } from "../../helpers/output"
  import SelectElem from "../../system/SelectElem.svelte"
  import Card from "../Card.svelte"

  interface Cam {
    id: string
    name: string
    group: string
  }
  export let cam: Cam

  let loaded: boolean = false
  // $: active = $outBackground?.type === "camera" && $outBackground.id === cam.id

  let videoElem: any

  $: console.log(cam)

  let constraints: any = {
    video: {
      devideId: cam.id,
      groupId: cam.group,
      width: { ideal: getResolution().width },
      height: { ideal: getResolution().height },
      // aspectRatio: 1.777777778,
      // frameRate: { max: 30 },
      // facingMode: { exact: "user" }
    },
  }

  let error: null | string = null

  onMount(() => {
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((mediaStream) => {
        videoElem.srcObject = mediaStream
        loaded = true
        videoElem.play()
      })
      .catch((err) => {
        let msg: string = err.message
        if (err.name === "NotReadableError") msg += "<br />Maybe it's in use by another program."
        error = err.name + ":<br />" + msg
        loaded = true
      })
  })

  onDestroy(() => {
    videoElem.srcObject?.getTracks()?.forEach((track: any) => track.stop())
    videoElem.srcObject = null
  })
</script>

<Card
  class="context #live_card"
  {loaded}
  outlineColor={findMatchingOut(cam.id, $outputs)}
  active={findMatchingOut(cam.id, $outputs) !== null}
  on:click
  label={cam.name}
  icon="camera"
  white={!cam.id.includes("cam")}
>
  <SelectElem id="camera" data={{ id: cam.id, type: "camera", name: cam.name, cameraGroup: cam.group }} draggable>
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
