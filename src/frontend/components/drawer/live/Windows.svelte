<script lang="ts">
  import { GET_SCREENS } from "../../../../types/Channels"
  import { outBackground } from "../../../stores"
  import Capture from "./Capture.svelte"

  let windows: any[] = []
  export let streams: any[]
  window.api.send(GET_SCREENS, ["window"])
  window.api.receive(GET_SCREENS, (data: any) => {
    // set freeshow last
    let index = data.findIndex((a: any) => a.name === "FreeShow")
    console.log(index)

    if (index >= 0) {
      let thisWindow = data.splice(index, 1)
      data = [...data, ...thisWindow]
    }
    console.log(data)
    windows = data
  })
</script>

{#each windows as window}
  <Capture
    bind:streams
    screen={window}
    on:click={() => {
      if ($outBackground?.id === window.id) outBackground.set(null)
      else outBackground.set({ id: window.id, type: "screen" })
    }}
  />
{/each}
