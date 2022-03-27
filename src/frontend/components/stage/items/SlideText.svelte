<script lang="ts">
  import { outSlide, showsCache } from "../../../stores"
  import { _show } from "../../helpers/shows"
  import Textbox from "../../slide/Textbox.svelte"

  export let next: boolean = false
  export let style: boolean = false
  export let ref: { type?: "show" | "stage" | "overlay" | "template"; showId?: string; id: string }

  $: index = $outSlide ? $outSlide.index + (next ? 1 : 0) : null
  $: slideId = index !== null && $outSlide ? _show("active").layouts("active").ref()[0][index!].id : null
  $: slide = $outSlide && slideId ? $showsCache[$outSlide.id].slides[slideId] : null

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
    <Textbox {item} {style} {ref} />
  {/each}
{/if}
