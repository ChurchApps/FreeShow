<script lang="ts">
  import { outSlide, showsCache } from "../../../stores"
  import { _show } from "../../helpers/shows"

  export let next: boolean = false

  $: index = $outSlide ? $outSlide.index + (next ? 1 : 0) : null
  $: slideId = index !== null && $outSlide ? _show("active").layouts("active").ref()[0][index!]?.id || null : null
  $: slide = $outSlide && slideId ? $showsCache[$outSlide.id].slides[slideId] : null
</script>

{#if slide}
  <div>
    {slide.notes}
  </div>
{/if}

<style>
  div {
    font-size: 100px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
