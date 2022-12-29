<script lang="ts">
  import Textbox from "../components/Textbox.svelte"
  import { getAutoSize } from "../helpers/autoSize"

  export let slides: any
  export let parent: any
  export let autoSize: number = 0

  export let next: boolean = false
  export let style: boolean = false
  $: slide = slides[next ? 1 : 0]

  // $: {
  //   text = ""
  //   if (slide) {
  //     slide.items.forEach((item: any) => {
  //       item.lines?.forEach((line: any) => {
  //         // if (text.length) text += "<br />"
  //         text += line.text.map((t: any) => t.value).join("")
  //       })
  //     })
  //   }
  // }

  $: autoSize = autoSize && slide ? getAutoSize(slide.items[0], parent) : 1
</script>

{#if slide}
  {#each slide.items as item}
    <Textbox {item} {style} {autoSize} />
  {/each}
{/if}
