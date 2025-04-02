<script lang="ts">
    import type { OutSlide } from "../../../types/Show"
    import { getLayoutRef } from "../helpers/show"
    import { showsCache } from "../util/stores"

    export let currentSlide: OutSlide | null
    export let slideOffset: number = 0
    export let autoSize: number = 100

    $: showRef = currentSlide ? getLayoutRef(currentSlide.id) : []

    // GET CORRECT INDEX OFFSET, EXCLUDING DISABLED SLIDES
    $: slideIndex = currentSlide && currentSlide.index !== undefined && currentSlide.id !== "temp" ? currentSlide.index : null
    $: if (slideOffset > 0 && slideIndex !== null && showRef) {
        let layoutOffset = slideIndex
        let offsetFromCurrentExcludingDisabled = 0
        while (offsetFromCurrentExcludingDisabled < slideOffset && layoutOffset <= showRef.length) {
            layoutOffset++
            if (!showRef[layoutOffset]?.data?.disabled) offsetFromCurrentExcludingDisabled++
        }
        slideIndex = layoutOffset
    } else if (slideOffset < 0 && slideIndex !== null && showRef) {
        let layoutOffset = slideIndex
        let offsetFromCurrentExcludingDisabled = 0
        while (offsetFromCurrentExcludingDisabled > slideOffset && layoutOffset >= 0) {
            layoutOffset--
            if (!showRef[layoutOffset]?.data?.disabled) offsetFromCurrentExcludingDisabled--
        }
        slideIndex = layoutOffset
    }

    $: slideId = slideIndex !== null && currentSlide ? showRef[slideIndex]?.id || null : null
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
