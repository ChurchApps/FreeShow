<script lang="ts">
    import type { Output } from "../../../types/Output"
    import type { LayoutRef } from "../../../types/Show"
    import { activeEdit, activePage, activePopup, activeShow, activeSlideRecording, dictionary, outLocked, showsCache } from "../../stores"
    import { previewShortcuts } from "../../utils/shortcuts"
    import Icon from "../helpers/Icon.svelte"
    import { refreshOut, setOutput } from "../helpers/output"
    import { getLayoutRef } from "../helpers/show"
    import { updateOut } from "../helpers/showActions"
    import Button from "../inputs/Button.svelte"

    export let currentOutput: Output
    export let ref: (LayoutRef | { temp: boolean; items: any; id: string })[]
    export let linesIndex: null | number
    export let maxLines: null | number

    $: outSlide = currentOutput?.out?.slide
    $: length = ref?.length || 0

    // transition
    $: slideData = $showsCache && outSlide && outSlide.id !== "temp" ? getLayoutRef(outSlide.id)[outSlide.index!]?.data : null
    $: customTransition = slideData ? slideData.transition || slideData.mediaTransition : null

    $: layoutLength = [$activeShow, getLayoutRef("active", $showsCache).length][1]

    // NEW

    $: isEdit = $activePage === "edit"

    // overlay
    $: currentOverlay = isEdit ? $activeEdit.id || "" : $activeShow?.type === "overlay" ? $activeShow.id : ""
    $: activeOverlayIds = currentOutput?.out?.overlays || []
    $: overlayActive = activeOverlayIds.includes(currentOverlay)

    // audio
    // $: currentAudio = isEdit ? $activeEdit.id || "" : $activeShow?.type === "audio" ? $activeShow.id : ""
    // $: activeAudioIds = Object.keys($playingAudio)
    // $: audioActive = activeAudioIds.includes(currentAudio)

    // media
    // type === "player", pdf, etc.
    // $: currentMedia = isEdit ? $activeEdit.id || "" : $activeShow?.type === "video" || $activeShow?.type === "image" ? $activeShow.id : ""
    // $: activeMediaId = currentOutput?.out?.background
    // $: mediaActive = activeMediaId && activeMediaId === currentMedia

    // slide
    $: currentShow = ($activeShow?.type || "show") === "show" ? $activeShow : null
    $: showActive = outSlide?.id && outSlide.id === currentShow?.id && outSlide.layout === $showsCache[currentShow?.id || ""]?.settings?.activeLayout
    $: slideActive = showActive && (isEdit ? outSlide?.index === $activeEdit.slide : true)

    // PLAY OR REFRESH
    $: shouldRefresh = !!(overlayActive || slideActive) // || audioActive || mediaActive
    $: shouldPlay = !!(currentOverlay || currentShow) // || currentAudio || currentMedia

    function playCurrent(e: any) {
        if (currentOverlay) {
            setOutput("overlays", currentOverlay, true)
            return
        }

        // if (currentAudio) {
        // not working in edit...
        //     const name = removeExtension(getFileName(currentAudio))
        //     AudioPlayer.start(currentAudio, { name })
        //     return
        // }

        // if (currentMedia) {
        //     // WIP play media (see VideoShow.svelte)
        //     // setOutput("background", { path: currentMedia, ...mediaStyle })
        //     return
        // }

        if (!currentShow) return

        const layout = $showsCache[currentShow.id].settings.activeLayout
        if (isEdit) setOutput("slide", { id: currentShow.id, layout, index: $activeEdit.slide })
        else {
            setOutput("slide", { id: currentShow.id, layout, index: 0 })
        }

        // ref || getLayoutRef()
        updateOut("active", $activeEdit.slide || 0, getLayoutRef(), !e.altKey)
    }
</script>

<span class="group">
    <Button
        on:click={() => previewShortcuts.ArrowLeft({ preview: true })}
        title={$dictionary.preview?._previous_slide + " [Arrow Left]"}
        disabled={$outLocked || (!$activeSlideRecording && (outSlide?.id === "temp" || (outSlide ? (outSlide.index || 0) < 1 && (linesIndex || 0) < 1 : !layoutLength)))}
        center
    >
        <Icon id="previous" size={1.2} />
    </Button>
    <Button
        on:click={() => previewShortcuts.ArrowRight({ preview: true, key: "ArrowRight" })}
        title={$dictionary.preview?._next_slide + " [Arrow Right]"}
        disabled={$outLocked || (!$activeSlideRecording && (outSlide?.id === "temp" || (outSlide ? (outSlide.index || 0) + 1 >= length && (linesIndex || 0) + 1 >= (maxLines || 0) : !layoutLength)))}
        center
    >
        <Icon id="next" size={1.2} />
    </Button>

    {#if shouldRefresh}
        <Button on:click={() => refreshOut()} title={$dictionary.preview?._update + " [Ctrl+R]"} disabled={$outLocked} center>
            <Icon id="refresh" size={1.1} />
        </Button>
    {:else}
        <Button on:click={playCurrent} title={$dictionary.preview?._start + " [Space]"} disabled={$outLocked || !shouldPlay || ($activePage === "edit" && $activeEdit.type === "effect")} center>
            <Icon id="play" size={1.2} white />
        </Button>
    {/if}

    <Button on:click={() => outLocked.set(!$outLocked)} red={$outLocked} title={($outLocked ? $dictionary.preview?._unlock : $dictionary.preview?._lock) + " [Ctrl+L]"} center>
        <Icon id={$outLocked ? "locked" : "unlocked"} size={1.1} white={$outLocked} />
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
