<script lang="ts">
  import { GET_SCREENS } from "../../../../types/Channels"
  import { outBackground } from "../../../stores"
  import Capture from "./Capture.svelte"

  let screens: any[] = []
  export let streams: any[]
  window.api.send(GET_SCREENS)
  window.api.receive(GET_SCREENS, (data: any) => (screens = data))
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
