<script lang="ts">
    import type { Output } from "../../../types/Output"
    import type { LayoutRef } from "../../../types/Show"
    import { activeEdit, activePage, activePopup, activeShow, activeSlideRecording, dictionary, outLocked, showsCache } from "../../stores"
    import { previewShortcuts } from "../../utils/shortcuts"
    import Icon from "../helpers/Icon.svelte"
    import { refreshOut, setOutput } from "../helpers/output"
    import { getLayoutRef } from "../helpers/show"
    import { updateOut } from "../helpers/showActions"
    import { _show } from "../helpers/shows"
    import Button from "../inputs/Button.svelte"

    export let currentOutput: Output
    export let ref: (LayoutRef | { temp: boolean; items: any; id: string })[]
    export let linesIndex: null | number
    export let maxLines: null | number

    $: slide = currentOutput?.out?.slide
    $: overlays = currentOutput?.out?.overlays?.length

    $: length = ref?.length || 0

    $: newEditSlide = $activePage === "edit" && slide?.index !== $activeEdit.slide
    $: showIsNotOutputtedSlide = newEditSlide || !slide || slide.id !== $activeShow?.id || !$activeShow || slide.layout !== $showsCache[$activeShow.id]?.settings?.activeLayout

    // transition
    $: slideData = $showsCache && slide && slide.id !== "temp" ? getLayoutRef(slide.id)[slide.index!]?.data : null
    $: customTransition = slideData ? slideData.transition || slideData.mediaTransition : null

    $: layoutLength = getLayoutRef("active", $showsCache).length
</script>

<span class="group">
    <Button
        on:click={() => previewShortcuts.ArrowLeft({ preview: true })}
        title={$dictionary.preview?._previous_slide + " [Arrow Left]"}
        disabled={$outLocked || (!$activeSlideRecording && (slide?.id === "temp" || (slide ? (slide.index || 0) < 1 && (linesIndex || 0) < 1 : !layoutLength)))}
        center
    >
        <Icon id="previous" size={1.2} />
    </Button>
    <Button
        on:click={() => previewShortcuts.ArrowRight({ preview: true, key: "ArrowRight" })}
        title={$dictionary.preview?._next_slide + " [Arrow Right]"}
        disabled={$outLocked || (!$activeSlideRecording && (slide?.id === "temp" || (slide ? (slide.index || 0) + 1 >= length && (linesIndex || 0) + 1 >= (maxLines || 0) : !layoutLength)))}
        center
    >
        <Icon id="next" size={1.2} />
    </Button>

    {#if showIsNotOutputtedSlide && (slide || newEditSlide || !overlays)}
        <Button
            on:click={(e) => {
                if ($activePage === "edit" && $activeShow && $activeEdit.slide !== null && $activeEdit.slide !== undefined)
                    setOutput("slide", { id: $activeShow.id, layout: $showsCache[$activeShow.id].settings.activeLayout, index: $activeEdit.slide })
                else if ($activeShow && layoutLength) {
                    setOutput("slide", { id: $activeShow.id, layout: $showsCache[$activeShow.id].settings.activeLayout, index: 0 })
                    // TODO: nextSlide(null)
                }
                updateOut("active", $activeEdit.slide || 0, getLayoutRef(), !e.altKey)
            }}
            title={$dictionary.preview?._start + " [Space]"}
            disabled={$outLocked || !$activeShow || !layoutLength}
            center
        >
            <Icon id="play" size={1.2} white />
        </Button>
    {:else}
        <Button on:click={() => refreshOut()} title={$dictionary.preview?._update + " [Ctrl+R]"} disabled={(!slide && !overlays) || $outLocked} center>
            <Icon id="refresh" size={1.1} />
        </Button>
    {/if}

    <Button on:click={() => outLocked.set(!$outLocked)} red={$outLocked} title={($outLocked ? $dictionary.preview?._unlock : $dictionary.preview?._lock) + " [Ctrl+L]"} center>
        <Icon id={$outLocked ? "locked" : "unlocked"} size={1.1} />
    </Button>
    <Button on:click={() => activePopup.set("transition")} title={$dictionary.popup?.transition} center>
        <Icon size={1.2} id="transition" white={!!customTransition} />
    </Button>
</span>

<style>
    .group {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
    }
    .group :global(button) {
        flex-grow: 1;
        /* height: 40px; */

        padding: 0.2em 0.8em !important;
    }
</style>
