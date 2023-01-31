<script lang="ts">
  import { outputs, showsCache } from "../../../stores";
  import { getAutoSize } from "../../edit/scripts/autoSize";
  import { getActiveOutputs } from "../../helpers/output";
  import { _show } from "../../helpers/shows";
  import Textbox from "../../slide/Textbox.svelte";

  export let next: boolean = false;
  export let chords: boolean = false;
  export let style: boolean = false;
  export let autoSize: number = 0;
  export let parent: any;
  export let ref: {
    type?: "show" | "stage" | "overlay" | "template";
    showId?: string;
    id: string;
  };

  $: currentSlide = $outputs[getActiveOutputs()[0]].out?.slide;
  $: index =
    currentSlide &&
    currentSlide.index !== undefined &&
    currentSlide.id !== "temp"
      ? currentSlide.index + (next ? 1 : 0)
      : null;
  $: slideId =
    index !== null && currentSlide
      ? _show(currentSlide.id).layouts("active").ref()[0][index!]?.id || null
      : null;
  $: slide =
    currentSlide && slideId
      ? $showsCache[currentSlide.id].slides[slideId]
      : null;
  $: items = slide
    ? slide.items.filter((item) => !item.type || item.type === "text")
    : [];

  $: autoSize = autoSize && items[0] ? getAutoSize(items[0], parent) : 0;
</script>

{#if slide}
  {#each items as item}
    <Textbox {item} {style} {chords} {ref} {autoSize} />
  {/each}
{/if}
