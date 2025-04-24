<script lang="ts">
    import type { OutSlide } from "../../../../types/Show"
    import { showsCache } from "../../../stores"
    import { getLayoutRef } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import { getStageTextLayoutOffset } from "../stage"

    export let currentSlide: OutSlide
    export let slideOffset = 0
    export let autoSize = 100

    $: showRef = currentSlide ? getLayoutRef(currentSlide.id) : []

    $: slideIndex = currentSlide && currentSlide.index !== undefined && currentSlide.id !== "temp" ? currentSlide.index : null
    $: customOffset = getStageTextLayoutOffset(showRef, slideOffset, slideIndex)

    $: slideId = customOffset !== null && currentSlide ? showRef[customOffset]?.id || null : null
    $: slide = currentSlide && slideId ? $showsCache[currentSlide.id].slides[slideId] : null
    $: notes = slide?.notes ? slide.notes.replaceAll("\n", "<br>") : ""
</script>

{#if slide}
    <div class="autoFontSize" style="font-size: {autoSize}px;">
        {@html notes}
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
