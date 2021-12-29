<script lang="ts">
  import type { Resolution } from "../../../types/Settings"

  import { activeStage, screen, stageShows } from "../../stores"
  import { history } from "../helpers/history"
  import { getStyles } from "../helpers/style"
  import { getStyleResolution } from "../slide/getStyleResolution"

  import Zoomed from "../slide/Zoomed.svelte"
  import Center from "../system/Center.svelte"
  import Snaplines from "../system/Snaplines.svelte"
  import Stagebox from "./Stagebox.svelte"

  $: Slide = $activeStage.id !== null ? $stageShows[$activeStage.id] : null

  let width: number = 0
  let height: number = 0
  let resolution: Resolution = Slide && Slide.settings.resolution ? Slide.settings.size! : $screen.resolution

  let lines: [string, number][] = []
  let mouse: any = null
  let newStyles: any = {}
  $: active = $activeStage.items

  let ratio: number = 1

  $: {
    if (Object.keys(newStyles).length && active.length) {
      let items: any = $stageShows[$activeStage.id!].items
      let newData: any[] = []
      let oldData: any[] = []
      active.forEach((id) => {
        let item = items[id]
        let styles: any = getStyles(item.style)
        Object.entries(newStyles).forEach(([key, value]: any) => (styles[key] = value))

        let textStyles: string = ""
        Object.entries(styles).forEach((obj) => (textStyles += obj[0] + ":" + obj[1] + ";"))

        // TODO: move multiple!
        newData.push(textStyles)
        oldData.push(item.style)
      })
      history({ id: "stageItemStyle", oldData, newData, location: { page: "stage", slide: $activeStage.id!, items: active } })
    } else if (!active.length) newStyles = {}
  }
</script>

<div class="main" bind:offsetWidth={width} bind:offsetHeight={height}>
  <div class="parent">
    {#if Slide}
      <Zoomed style={getStyleResolution(resolution, width, height)} bind:ratio hideOverflow={false} center>
        <Snaplines bind:lines bind:newStyles bind:mouse {ratio} {active} />
        {#each Object.entries(Slide.items) as [id, item]}
          {#if item.enabled}
            <Stagebox edit {id} {item} {ratio} bind:mouse />
          {/if}
        {/each}
      </Zoomed>
    {:else}
      <Center size={2} faded>[[[No stage show]]]</Center>
    {/if}
  </div>
  <div class="bar">
    Connections: {0}
  </div>
</div>

<style>
  .main {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

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
