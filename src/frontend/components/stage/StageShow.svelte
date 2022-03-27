<script lang="ts">
  import { activeStage, connections, stageShows } from "../../stores"
  import { history } from "../helpers/history"
  import { getStyles } from "../helpers/style"
  import T from "../helpers/T.svelte"
  import { getStyleResolution } from "../slide/getStyleResolution"
  import Zoomed from "../slide/Zoomed.svelte"
  import Center from "../system/Center.svelte"
  import Main from "../system/Main.svelte"
  import Snaplines from "../system/Snaplines.svelte"
  import Stagebox from "./Stagebox.svelte"

  let lines: [string, number][] = []
  let mouse: any = null
  let newStyles: any = {}
  $: active = $activeStage.items

  let ratio: number = 1

  $: {
    if (active.length) {
      if (Object.keys(newStyles).length) setStyles()
    } else newStyles = {}
  }

  function setStyles() {
    let items: any = $stageShows[$activeStage.id!].items
    let newData: any[] = []
    let oldData: any[] = []

    active.forEach((id) => {
      let styles: any = getStyles(items[id].style)
      Object.entries(newStyles).forEach(([key, value]: any) => (styles[key] = value))

      let textStyles: string = ""
      Object.entries(styles).forEach((obj) => (textStyles += obj[0] + ":" + obj[1] + ";"))

      // TODO: move multiple!
      newData.push(textStyles)
      oldData.push(items[id].style)
    })

    history({ id: "stageItemStyle", oldData, newData, location: { page: "stage", slide: $activeStage.id!, items: active } })
  }
</script>

<Main slide={$activeStage.id ? $stageShows[$activeStage.id] : null} let:width let:height let:resolution>
  <div class="parent">
    {#if $activeStage.id}
      <Zoomed style={getStyleResolution(resolution, width, height)} bind:ratio disableStyle hideOverflow={false} center>
        <!-- TODO: snapping to top left... -->
        <Snaplines bind:lines bind:newStyles bind:mouse {ratio} {active} />
        <!-- {#key Slide} -->
        {#each Object.entries($stageShows[$activeStage.id].items) as [id, item]}
          {#if item.enabled}
            <Stagebox edit {id} {item} {ratio} bind:mouse />
          {/if}
        {/each}
        <!-- {/key} -->
      </Zoomed>
    {:else}
      <Center size={2} faded>
        <T id="empty.stage_show" />
      </Center>
    {/if}
  </div>
  <div class="bar">
    <!-- TODO: get already connected... -->
    Connections: {Object.keys($connections.STAGE).length}
  </div>
</Main>

<style>
  .parent {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px;
    overflow: auto;
  }

  .bar {
    display: flex;
    justify-content: space-between;
    width: 100%;
    background-color: var(--primary);
    border-top: 2px solid var(--primary-lighter);
  }
</style>
