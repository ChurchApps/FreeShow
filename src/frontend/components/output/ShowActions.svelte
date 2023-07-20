<script lang="ts">
    import { activeEdit, activePage, activePopup, activeShow, dictionary, outLocked, showsCache } from "../../stores"
    import { GetLayout } from "../helpers/get"
    import Icon from "../helpers/Icon.svelte"
    import { refreshOut, setOutput } from "../helpers/output"
    import { nextSlide, previousSlide, updateOut } from "../helpers/showActions"
    import { _show } from "../helpers/shows"
    import Button from "../inputs/Button.svelte"

    export let currentOutput: any
    export let ref: any[]
    export let linesIndex: null | number
    export let maxLines: null | number

    $: slide = currentOutput?.out?.slide
    $: overlays = currentOutput?.out?.overlays?.length

    $: length = ref?.length || 0

    $: newEditSlide = $activePage === "edit" && slide?.index !== $activeEdit.slide
    $: showIsNotOutputtedSlide = newEditSlide || !slide || slide.id !== $activeShow?.id || !$activeShow || slide.layout !== $showsCache[$activeShow.id]?.settings?.activeLayout

    // transition
    $: slideData = $showsCache && slide && slide.id !== "temp" ? _show(slide.id).layouts("active").ref()[0]?.[slide.index!]?.data : null
    $: customTransition = slideData ? slideData.transition || slideData.mediaTransition : null
</script>

<span class="group">
    <Button
        on:click={previousSlide}
        title={$dictionary.preview?._previous_slide}
        disabled={$outLocked || slide?.id === "temp" || (slide ? (slide.index || 0) < 1 && (linesIndex || 0) < 1 : !GetLayout(null, $showsCache[$activeShow?.id || ""]?.settings?.activeLayout || null).length)}
        center
    >
        <Icon id="previous" size={1.2} />
    </Button>
    <Button
        on:click={nextSlide}
        title={$dictionary.preview?._next_slide}
        disabled={$outLocked || slide?.id === "temp" || (slide ? (slide.index || 0) + 1 >= length && (linesIndex || 0) + 1 >= (maxLines || 0) : !GetLayout(null, $showsCache[$activeShow?.id || ""]?.settings?.activeLayout || null).length)}
        center
    >
        <Icon id="next" size={1.2} />
    </Button>

    {#if showIsNotOutputtedSlide && (slide || newEditSlide || !overlays)}
        <Button
            on:click={(e) => {
                if ($activePage === "edit" && $activeShow && $activeEdit.slide !== null && $activeEdit.slide !== undefined)
                    setOutput("slide", { id: $activeShow.id, layout: $showsCache[$activeShow.id].settings.activeLayout, index: $activeEdit.slide })
                else if ($activeShow && GetLayout().length) {
                    setOutput("slide", { id: $activeShow.id, layout: $showsCache[$activeShow.id].settings.activeLayout, index: 0 })
                    // TODO: nextSlide(null)
                }
                updateOut("active", $activeEdit.slide || 0, _show("active").layouts("active").ref()[0], !e.altKey)
            }}
            title={$dictionary.preview?._start}
            disabled={$outLocked || !$activeShow || !GetLayout(null, $showsCache[$activeShow.id]?.settings?.activeLayout || null).length}
            center
        >
            <Icon id="play" size={1.2} white />
        </Button>
    {:else}
        <Button on:click={() => refreshOut()} title={$dictionary.preview?._update} disabled={(!slide && !overlays) || $outLocked} center>
            <Icon id="refresh" size={1.1} />
        </Button>
    {/if}

    <Button on:click={() => outLocked.set(!$outLocked)} red={$outLocked} title={$outLocked ? $dictionary.preview?._unlock : $dictionary.preview?._lock} center>
        <Icon id={$outLocked ? "locked" : "unlocked"} size={1.1} />
    </Button>
    <Button on:click={() => activePopup.set("transition")} title={$dictionary.popup?.transition} center>
        <Icon size={1.2} id="transition" white={customTransition} />
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
    }
</style>
