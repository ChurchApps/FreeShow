<script lang="ts">
  import { outputs } from "../../../stores"
  import { getActiveOutputs, setOutput } from "../../helpers/output"
  import Cam from "./Cam.svelte"

  // export let streams: any[]

  // var socket = io()
  // let webcam: boolean = false
  // let player: any

  // let webcams: { [key: string]: any } = {}
  // window.api.receive("WEBCAM", (msg: any) => {
  //   if (msg.channel === "STREAM") {
  //     webcams[msg.id] = { name: msg.name, src: msg.data }
  //   }
  // })
  // socket.on("stream", (image) => {
  //   webcam = true
  //   player.setAttribute("src", image)
  //   // $('#logger').text(image);
  // })

  let cams: any[] = []
  navigator.mediaDevices.enumerateDevices().then(function (devices) {
    console.log(devices)

    cams = devices.filter((a) => a.kind === "videoinput").map((a) => ({ name: a.label, id: a.deviceId, group: a.groupId }))
    // console.log(cams)

    // cams = [cams[1]]

    // devices.forEach((d) => {
    //   if (d.kind === "videoinput") cams = [...cams, { name: d.label, id: d.deviceId, group: d.groupId }]
    // })
  })

  $: currentOutput = $outputs[getActiveOutputs()[0]]
</script>

<!-- TODO: showing the same preview..... -->
{#each cams as cam}
  <Cam
    {cam}
    on:click={() => {
      if (currentOutput.out?.background?.id === cam.id) setOutput("background", null)
      else setOutput("background", { name: cam.name, id: cam.id, type: "camera" })
    }}
  />
{/each}

<!-- {#if Object.keys(webcams).length}
  {#each Object.values(webcams) as cam}
    <Card {active} on:click label={cam.name} icon={"camera"} white>
      <img id="play" alt="cam" src={cam.src} style="transform: scaleX(-1);" />
    </Card>
  {/each}
{/if} -->
