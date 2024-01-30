<script lang="ts">
    import { showsCache } from "../../../stores"
    import { _show } from "../../helpers/shows"

    export let currentSlide: any
    export let next: boolean = false
    export let autoSize: number = 100

    $: index = currentSlide && currentSlide.index !== undefined ? currentSlide.index + (next ? 1 : 0) : null
    $: slideId = index !== null && currentSlide ? _show(currentSlide.id).layouts("active").ref()[0]?.[index!]?.id || null : null
    $: slide = currentSlide && slideId ? $showsCache[currentSlide.id].slides[slideId] : null
    $: notes = slide?.notes ? slide.notes.replaceAll("\n", "<br>") : ""
</script>

{#if slide}
    <div style="font-size: {autoSize}px;">
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
