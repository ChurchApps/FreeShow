<script lang="ts">
  import { GET_SCREENS } from "../../../types/Channels"
  import { outBackground } from "../../stores"
  import Capture from "./Capture.svelte"

  let screens: any[] = []
  window.api.send(GET_SCREENS, ["screen", "window"])
  window.api.receive(GET_SCREENS, (data: any) => {
    // let appScreen
    // data.forEach((s: any, i: number) => {
    //   console.log(s.name)

    //   if (s.name === "FreeShow") {
    //     appScreen = data[i]
    //     data.splice(i, 1)
    //   }
    // })
    // if (appScreen) data.push(appScreen)

    screens = data
  })
</script>

{#each screens as screen}
  <Capture {screen} on:click={() => outBackground.set({ id: screen.id, type: "screen" })} />
{/each}
