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
  import { autoSize } from "./tools/autoSize"

  $: currentShow = $activeShow!.id
  // $: layoutSlides = GetLayout(currentShow)
  // TODO: overlay editor
  // $: Slide = $activeEdit.slide !== null && $showsCache[currentShow] ? $showsCache[currentShow].slides[GetLayout(currentShow)[$activeEdit.slide]?.id] : null

  $: if (currentShow && $showsCache[currentShow] && $activeEdit.slide === null && _show([currentShow]).slides().get().length) activeEdit.set({ slide: 0, items: [] })
  $: Slide =
    $activeEdit.slide !== null && $showsCache[currentShow]
      ? _show([currentShow])
          .slides([_show([currentShow]).layouts("active").ref()[0][$activeEdit.slide]?.id])
          .get()[0]
      : null

  // $: if (currentShow) {
  //   console.log($activeEdit.slide, _show([currentShow]).layouts("active").slides().get()[0], _show([currentShow]).layouts("active").ref()[0][$activeEdit.slide!]?.id)
  // }

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
    if (Object.keys(newStyles).length && active.length) {
      let items = $showsCache[$activeShow?.id!].slides[GetLayout($activeShow?.id!)[$activeEdit.slide!]?.id].items
      let values: any[] = []
      // let oldValues: any[] = []
      active.forEach((id) => {
        let item = items[id]
        let styles: any = getStyles(item.style)
        Object.entries(newStyles).forEach(([key, value]: any) => (styles[key] = value))

        let textStyles: string = ""
        Object.entries(styles).forEach((obj) => (textStyles += obj[0] + ":" + obj[1] + ";"))

        // TODO: move multiple!
        values.push(textStyles)
        // oldValues.push(item.style)
      })

      history({
        id: "setStyle",
        // oldData: { key: "style", values: oldValues },
        newData: { key: "style", values },
        location: { page: "edit", show: $activeShow!, slide: GetLayout()[$activeEdit.slide!].id, items: active },
      })
    } else if (!active.length) newStyles = {}
  }

  $: if (Object.keys(newStyles).length && $showsCache[$activeShow?.id!] && active.length) {
    let items = $showsCache[$activeShow?.id!].slides[GetLayout($activeShow?.id!)[$activeEdit.slide!]?.id].items
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
