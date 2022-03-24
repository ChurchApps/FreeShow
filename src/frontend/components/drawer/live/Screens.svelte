<script lang="ts">
  import { MAIN } from "../../../../types/Channels"
  import { outBackground } from "../../../stores"
  import { receive, send } from "../../../utils/request"
  import Capture from "./Capture.svelte"

  let screens: any[] = []
  export let streams: any[]
  send(MAIN, ["GET_SCREENS"])
  receive(MAIN, { GET_SCREENS: (d: any) => (screens = d) })
</script>

{#each screens as screen}
  <Capture
    bind:streams
    {screen}
    on:click={() => {
      if ($outBackground?.id === screen.id) outBackground.set(null)
      else outBackground.set({ id: screen.id, type: "screen" })
    }}
  />
{/each}
