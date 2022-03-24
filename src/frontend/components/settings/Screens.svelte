<script lang="ts">
  import { MAIN, OUTPUT } from "../../../types/Channels"
  import { outputDisplay, outputScreen } from "../../stores"
  import { receive, send } from "../../utils/request"
  import T from "../helpers/T.svelte"
  import Dropdown from "../inputs/Dropdown.svelte"

  let screens: any[] = []
  let options: any[] = []
  send(MAIN, ["GET_DISPLAYS"])
  receive(MAIN, {
    GET_DISPLAYS: (d: any) => {
      screens = d
      options = screens.map((screen) => ({ name: screen.id.toString(), id: screen.id }))
    },
    SET_SCREEN: (d: any) => {
      if (!$outputScreen) outputScreen.set(d.id.toString())
    },
  })

  function changeOutputScreen(e: any) {
    outputScreen.set(e.detail.id.toString())
    if ($outputDisplay) send(OUTPUT, ["DISPLAY"], { enabled: true, screen: $outputScreen })
  }
</script>

{#if options.length}
  {#key options}
    <Dropdown value={$outputScreen ? $outputScreen : "—"} {options} on:click={changeOutputScreen} style="width: 200px;" />
  {/key}
{:else}
  <T id="remote.loading" />
{/if}
