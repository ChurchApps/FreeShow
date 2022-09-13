<script lang="ts">
  import { outputs } from "../../../stores"
  import { getActiveOutputs, setOutput } from "../../helpers/output"
  import Cam from "./Cam.svelte"

  let cams: any[] = []
  navigator.mediaDevices.enumerateDevices().then((devices) => {
    cams = devices.filter((a) => a.kind === "videoinput").map((a) => ({ name: a.label, id: a.deviceId, group: a.groupId }))
  })

  $: currentOutput = $outputs[getActiveOutputs()[0]]
</script>

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
