<script lang="ts">
  import { outBackground } from "../../stores"

  import Cam from "./Cam.svelte"

  let cams: any[] = []
  navigator.mediaDevices.enumerateDevices().then(function (devices) {
    console.log(devices)

    devices.forEach((d) => {
      if (d.kind === "videoinput") cams = [...cams, { name: d.label, id: d.deviceId, group: d.groupId }]
    })
  })
</script>

{#each cams as cam}
  <Cam {cam} on:click={() => outBackground.set({ id: cam.id, type: "camera" })} />
{/each}
