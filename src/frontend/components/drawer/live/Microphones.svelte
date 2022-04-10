<script lang="ts">
  import Mic from "./Mic.svelte"

  interface Mics {
    [key: string]: {
      [key: string]: string
    }
  }

  let mics: Mics = {}
  navigator.mediaDevices.enumerateDevices().then(function (devices) {
    devices.forEach((d) => {
      if (d.kind === "audioinput") {
        if (!mics[d.groupId]) mics[d.groupId] = {}
        mics[d.groupId][d.deviceId] = d.label
        // mics.push({ name: d.label, id: d.deviceId, group: d.groupId })
      }
    })
  })

  // $: console.log(mics)
</script>

<div class="row">
  {#each Object.values(mics) as mic}
    <div class="row">
      {#each Object.entries(mic) as m}
        <Mic mic={{ id: m[0], name: m[1] }} />
      {/each}
    </div>
  {/each}
</div>

<style>
  .row {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
</style>
