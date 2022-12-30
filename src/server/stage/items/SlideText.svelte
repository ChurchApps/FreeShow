<script lang="ts">
  import Textbox from "../components/Textbox.svelte"
  import { getAutoSize } from "../helpers/autoSize"

  export let slide: any
  export let parent: any
  export let autoSize: number = 0

  export let style: boolean = false

  $: autoSize = autoSize && slide ? getAutoSize(slide.items[0], parent) : 1

  $: items = style ? slide.items : combineSlideItems()

  function combineSlideItems() {
    let oneItem: any = null
    if (!slide?.items) return []
    JSON.parse(JSON.stringify(slide.items)).forEach((item: any) => {
      if (item.lines) {
        if (!oneItem) oneItem = item
        else oneItem.lines.push(...item.lines)
      }
    })

    return oneItem ? [oneItem] : []
  }
</script>

{#if slide}
  {#each items as item}
    <Textbox {item} {style} {autoSize} />
  {/each}
{/if}
