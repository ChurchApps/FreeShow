<script lang="ts">
  import type { Resolution } from "../../../types/Settings"

  import { activeShow, shows, screen, activeEdit } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import { history } from "../helpers/history"
  import { getStyles } from "../helpers/style"
  import { getStyleResolution } from "../slide/getStyleResolution"
  import Zoomed from "../slide/Zoomed.svelte"
  import Center from "../system/Center.svelte"
  import Snaplines from "../system/Snaplines.svelte"
  import Textedit from "./Textedit.svelte"

  $: currentShow = $activeShow!.id
  // $: layoutSlides = GetLayout(currentShow)
  // TODO: overlay editor
  $: Slide = $activeEdit.slide !== null ? $shows[currentShow].slides[GetLayout(currentShow)[$activeEdit.slide]?.id] : null

  // interface Mouse {
  //   x: number
  //   y: number
  //   offset: {
  //     x: number
  //     y: number
  //     width: number
  //     height: number
  //   }
  //   // offsetWidth: number
  //   // offsetHeight: number
  //   e: any
  // }
  let lines: [string, number][] = []
  let mouse: any = null
  let newStyles: any = {}
  $: active = $activeEdit.items

  let width: number = 0
  let height: number = 0
  let resolution: Resolution = Slide ? $shows[currentShow].settings.resolution! : $screen.resolution
  // TODO: zoom more in...

  let ratio: number = 1

  $: {
    if (Object.keys(newStyles).length && active.length) {
      let items = $shows[$activeShow?.id!].slides[GetLayout($activeShow?.id!)[$activeEdit.slide!]?.id].items
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
      history({ id: "itemStyle", oldData, newData, location: { page: "edit", show: $activeShow!, slide: GetLayout()[$activeEdit.slide!].id, items: active } })
    } else if (!active.length) newStyles = {}
  }
</script>

<div class="parent" bind:offsetWidth={width} bind:offsetHeight={height}>
  {#if Slide}
    <Zoomed style={getStyleResolution(resolution, width, height)} bind:ratio hideOverflow={false} center>
      <Snaplines bind:lines bind:newStyles bind:mouse {ratio} {active} />
      {#each Slide.items as item, index}
        <Textedit {item} {index} {ratio} bind:mouse />
      {/each}
    </Zoomed>
  {:else}
    <Center size={2} faded>[[[No slide]]]</Center>
  {/if}
</div>

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
</style>
