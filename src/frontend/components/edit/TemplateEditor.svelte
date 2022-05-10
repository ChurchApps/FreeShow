<script lang="ts">
  import type { Resolution } from "../../../types/Settings"
  import { activeEdit, screen, templates } from "../../stores"
  import { _show } from "../helpers/shows"
  import { getStyles } from "../helpers/style"
  import T from "../helpers/T.svelte"
  import { getStyleResolution } from "../slide/getStyleResolution"
  import Zoomed from "../slide/Zoomed.svelte"
  import Center from "../system/Center.svelte"
  import Snaplines from "../system/Snaplines.svelte"
  import Editbox from "./Editbox.svelte"
  import { autoSize } from "./scripts/autoSize"

  // TODO: template editor

  $: currentId = $activeEdit.id!
  $: Slide = $templates[currentId]
  templates.subscribe((a) => (Slide = a[currentId]))

  let lines: [string, number][] = []
  let mouse: any = null
  let newStyles: any = {}
  $: active = $activeEdit.items

  let width: number = 0
  let height: number = 0
  let resolution: Resolution = $screen.resolution

  let ratio: number = 1

  $: {
    if (active.length) updateStyles()
    else newStyles = {}
  }

  function updateStyles() {
    if (!Object.keys(newStyles).length) return

    let items = Slide.items
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

    // TODO: history
    templates.update((a) => {
      active.forEach((index) => {
        a[$activeEdit.id!].items[index].style = values[index] || values[0]
      })
      return a
    })
  }

  $: if (Object.keys(newStyles).length && $templates[$activeEdit.id!] && active.length) {
    let items = Slide.items
    if (items) autoSize(active, items)
  }

  $: console.log(Slide)
</script>

<div class="parent" bind:offsetWidth={width} bind:offsetHeight={height}>
  {#if Slide}
    <Zoomed style={getStyleResolution(resolution, width, height)} bind:ratio hideOverflow={false} center>
      <Snaplines bind:lines bind:newStyles bind:mouse {ratio} {active} />
      {#each Slide.items as item, index}
        <Editbox ref={{ type: "template", id: currentId }} {item} {index} {ratio} bind:mouse />
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
