<script lang="ts">
  import type { Resolution } from "../../../types/Settings"
  import { activeEdit, activeShow, screen, showsCache } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import { history } from "../helpers/history"
  import { _show } from "../helpers/shows"
  import { getStyles } from "../helpers/style"
  import T from "../helpers/T.svelte"
  import { getStyleResolution } from "../slide/getStyleResolution"
  import Zoomed from "../slide/Zoomed.svelte"
  import Center from "../system/Center.svelte"
  import Snaplines from "../system/Snaplines.svelte"
  import Editbox from "./Editbox.svelte"
  import { autoSize } from "./scripts/autoSize"

  // TODO: overlay editor

  $: currentShow = $activeShow!.id
  $: if (currentShow && $showsCache[currentShow] && $activeEdit.slide === null && _show("active").slides().get().length) activeEdit.set({ slide: 0, items: [] })
  $: ref = $showsCache[currentShow] ? _show("active").layouts("active").ref()[0] : null
  $: Slide = $activeEdit.slide !== null && ref ? _show("active").slides([ref[$activeEdit.slide!]?.id]).get()[0] : null

  // showsCache.subscribe((a) => {
  //   console.log(a)

  //   if (
  //     $activeEdit.slide !== null &&
  //     JSON.stringify(Slide) !==
  //       JSON.stringify(
  //         _show([currentShow])
  //           .slides([_show([currentShow]).layouts("active").ref()[0][$activeEdit.slide]?.id])
  //           .get()[0]
  //       )
  //   )
  //     Slide = _show([currentShow])
  //       .slides([_show([currentShow]).layouts("active").ref()[0][$activeEdit.slide]?.id])
  //       .get()[0]
  // })

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
  let resolution: Resolution = Slide ? $showsCache[currentShow].settings.resolution! : $screen.resolution
  // TODO: zoom more in...

  let ratio: number = 1

  $: {
    if (active.length) updateStyles()
    else newStyles = {}
  }

  function updateStyles() {
    if (!Object.keys(newStyles).length) return

    let items = $showsCache[$activeShow?.id!].slides[GetLayout($activeShow?.id!)[$activeEdit.slide!]?.id].items
    let values: any[] = []
    active.forEach((id) => {
      let item = items[id]
      let styles: any = getStyles(item.style)
      let textStyles: string = ""

      Object.entries(newStyles).forEach(([key, value]: any) => (styles[key] = value))
      Object.entries(styles).forEach((obj) => (textStyles += obj[0] + ":" + obj[1] + ";"))

      // TODO: move multiple!
      values.push(textStyles)
    })

    history({
      id: "setStyle",
      newData: { key: "style", values },
      location: { page: "edit", show: $activeShow!, slide: ref[$activeEdit.slide!].id, items: active },
      // location: { page: "edit", show: $activeShow!, slide: GetLayout()[$activeEdit.slide!].id, items: active },
    })
  }

  $: if (Object.keys(newStyles).length && $showsCache[$activeShow?.id!] && active.length) {
    let items = $showsCache[$activeShow?.id!].slides[ref[$activeEdit.slide!].id].items
    // let items = $showsCache[$activeShow?.id!].slides[GetLayout($activeShow?.id!)[$activeEdit.slide!]?.id].items
    if (items) autoSize(active, items)
  }
</script>

<div class="parent" bind:offsetWidth={width} bind:offsetHeight={height}>
  {#if Slide}
    <Zoomed style={getStyleResolution(resolution, width, height)} bind:ratio hideOverflow={false} center>
      <Snaplines bind:lines bind:newStyles bind:mouse {ratio} {active} />
      {#each Slide.items as item, index}
        <Editbox {item} {index} {ratio} bind:mouse />
      {/each}
    </Zoomed>
  {:else}
    <Center size={2} faded>
      <T id="empty.slide" />
    </Center>
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
