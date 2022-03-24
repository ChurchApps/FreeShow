<script lang="ts">
  import { MAIN } from "../../../../types/Channels"
  import { outBackground } from "../../../stores"
  import { receive, send } from "../../../utils/request"
  import Capture from "./Capture.svelte"

  let windows: any[] = []
  export let streams: any[]
  send(MAIN, ["GET_WINDOWS"])
  receive(MAIN, {
    GET_WINDOWS: (d: any) => {
      // set freeshow last
      // let index = d.findIndex((a: any) => a.name === "FreeShow")
      // if (index >= 0) {
      //   let thisWindow = d.splice(index, 1)
      //   d = [...d, ...thisWindow]
      // }
      windows = d
    },
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
