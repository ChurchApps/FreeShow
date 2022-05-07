<script lang="ts">
  import { outSlide, showsCache } from "../../../stores"
  import { _show } from "../../helpers/shows"
  import Textbox from "../../slide/Textbox.svelte"

  export let next: boolean = false
  export let style: boolean = false
  export let ref: { type?: "show" | "stage" | "overlay" | "template"; showId?: string; id: string }

  $: index = $outSlide ? $outSlide.index + (next ? 1 : 0) : null
  $: slideId = index !== null && $outSlide ? _show($outSlide.id).layouts("active").ref()[0][index!]?.id || null : null
  $: slide = $outSlide && slideId ? $showsCache[$outSlide.id].slides[slideId] : null
</script>

{#if slide}
  {#each slide.items as item}
    <Textbox {item} {style} {ref} />
  {/each}
{/if}
