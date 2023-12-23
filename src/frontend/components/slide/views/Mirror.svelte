<script lang="ts">
    import { currentWindow, stageShows } from "../../../stores"
    import { loadShows } from "../../helpers/setShow"
    import { _show } from "../../helpers/shows"
    import { getStyles } from "../../helpers/style"
    import Stagebox from "../../stage/Stagebox.svelte"
    import Textbox from "../Textbox.svelte"
    import Zoomed from "../Zoomed.svelte"

    export let item
    export let index: number
    export let ratio: number = 1
    export let edit: boolean = false
    export let ref: {
        type?: "show" | "stage" | "overlay" | "template"
        showId?: string
        slideId?: string
        id: string
    }

    $: stageEnabled = item.mirror?.enableStage
    $: nextSlide = item.mirror?.nextSlide

    $: slideId = ref.slideId || ""
    function getMirroredItem() {
        let showId = item.mirror!.show
        if (!nextSlide && showId === ref.showId) return

        let slideIndex = item.mirror.useSlideIndex !== false ? index : item.mirror.index || 0

        if (nextSlide) {
            showId = ref.showId
            slideIndex = index + 1
        }

        let newSlideRef: any = _show(showId).layouts("active").ref()[0]?.[slideIndex]
        console.log(newSlideRef)
        if (!newSlideRef) return
        slideId = newSlideRef.id

        let newItem: any = _show(showId).slides([slideId]).items([0]).get()[0]?.[0]
        if (!newItem) return
        newItem.style = "width: 100%;height: 100%;"
        if (!edit) newItem.style += "pointer-events: none;"

        return newItem
    }

    let itemStyle: any = {}
    $: itemStyle = getStyles(item.style) || {}
    $: currentRatio = itemStyle.width / itemStyle.height
</script>

<Zoomed ratio={currentRatio} center style="height: 100%;" background="transparent" disableStyle showMirror>
    {#if stageEnabled}
        {#if item.mirror?.stage}
            {#key item.mirror?.stage}
                {#each Object.entries($stageShows[item.mirror?.stage]?.items || {}) as [id, stageItem]}
                    {#if stageItem.enabled}
                        <Stagebox {id} show={$stageShows[item.mirror?.stage]} item={stageItem} {ratio} />
                    {/if}
                {/each}
            {/key}
        {/if}
    {:else if item.mirror?.show || nextSlide}
        {#key item.mirror?.show}
            {#await loadShows([item.mirror.show])}
                {#if !$currentWindow}Loading...{/if}
            {:then}
                {#if getMirroredItem()}
                    <Textbox item={getMirroredItem()} ref={{ showId: item.mirror.show, slideId, id: ref.id }} />
                {/if}
            {/await}
        {/key}
    {/if}
</Zoomed>

<!-- <style>
    .zoom {
        width: 100%;
        height: 100%;
    }
</style> -->
