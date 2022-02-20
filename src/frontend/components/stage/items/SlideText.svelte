<script lang="ts">
  import { activeShow, outSlide, showsCache } from "../../../stores"
  import { GetLayout } from "../../helpers/get"
  import Textbox from "../../slide/Textbox.svelte"

  export let next: boolean = false
  export let style: boolean = false

  $: index = $outSlide ? $outSlide.index + (next ? 1 : 0) : null
  $: slideId = index !== null && $activeShow && index < GetLayout().length ? GetLayout()[index].id : null
  $: slide = $outSlide?.id && slideId ? $showsCache[$outSlide.id].slides[slideId] : null

  // $: {
  //   if (slide?.items) {
  //     text = ""
  //     slide.items.forEach((item) => {
  //       item.lines?.forEach((line) => {
  //         // if (text.length) text += "<br />"
  //         text += line.text.map((t) => t.value).join("")
  //       })
  //     })
  //   }
  // }
</script>

{#if slide}
  {#each slide.items as item}
    <Textbox {item} {style} />
  {/each}
{/if}
