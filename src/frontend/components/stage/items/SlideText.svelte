<script lang="ts">
  import { activeShow, outSlide, shows } from "../../../stores"
  import { GetLayout } from "../../helpers/get"
  import Textbox from "../../slide/Textbox.svelte"

  export let next: boolean = false
  export let style: boolean = false
  let text: string = ""

  $: index = $outSlide ? $outSlide.index + (next ? 1 : 0) : null
  $: slideId = index !== null && $activeShow && index < GetLayout().length ? GetLayout()[index].id : null
  $: slide = $outSlide?.id && slideId ? $shows[$outSlide.id].slides[slideId] : null

  $: {
    if (slide?.items) {
      text = ""
      slide.items.forEach((item) => {
        if (item.text?.length) {
          if (text.length) text += "<br />"
          text += item.text.map((t) => t.value).join("")
        }
      })
    }
  }
</script>

{#if style}
  {#if slide}
    {#each slide.items as item}
      <Textbox {item} />
    {/each}
  {/if}
{:else}
  {@html text}
{/if}
