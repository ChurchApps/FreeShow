<script lang="ts">
    import type { Output } from "../../../types/Output"
    import type { LayoutRef } from "../../../types/Show"
    import { activeEdit, activePage, activePopup, activeShow, outLocked, popupData, showsCache } from "../../stores"
    import { previewShortcuts } from "../../utils/shortcuts"
    import Icon from "../helpers/Icon.svelte"
    import { refreshOut, setOutput } from "../helpers/output"
    import { getLayoutRef } from "../helpers/show"
    import { updateOut } from "../helpers/showActions"
    import MaterialButton from "../inputs/MaterialButton.svelte"

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

        if (!currentShow || !$showsCache[currentShow.id]?.settings) return

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
    <MaterialButton title="preview._previous_slide [Arrow Left]" disabled={$outLocked || outSlide?.id === "temp" || (outSlide ? (outSlide.index || 0) < 1 && (linesIndex || 0) < 1 : !layoutLength)} on:click={() => previewShortcuts.ArrowLeft({ preview: true })}>
        <Icon id="previous" size={1.2} />
    </MaterialButton>
    <MaterialButton title="preview._next_slide [Arrow Right]" disabled={$outLocked || outSlide?.id === "temp" || (outSlide ? (outSlide.index || 0) + 1 >= length && (linesIndex || 0) + 1 >= (maxLines || 0) : !layoutLength)} on:click={() => previewShortcuts.ArrowRight({ preview: true, key: "ArrowRight" })}>
        <Icon id="next" size={1.2} />
    </MaterialButton>

    {#if shouldRefresh}
        <MaterialButton title="preview._update [Ctrl+R]" disabled={$outLocked} on:click={() => refreshOut()}>
            <Icon id="refresh" size={1.1} />
        </MaterialButton>
    {:else}
        <MaterialButton title="preview._start [Space]" disabled={$outLocked || !shouldPlay || ($activePage === "edit" && ($activeEdit.type === "template" || $activeEdit.type === "effect"))} on:click={playCurrent}>
            <Icon id="play" size={1.2} white />
        </MaterialButton>
    {/if}

    <MaterialButton title={($outLocked ? "preview._unlock" : "preview._lock") + " [Ctrl+L]"} on:click={() => outLocked.set(!$outLocked)} red={$outLocked}>
        <Icon id={$outLocked ? "locked" : "unlocked"} size={1.1} white={$outLocked} />
    </MaterialButton>
    <MaterialButton
        title="popup.transition"
        on:click={() => {
            popupData.set({})
            activePopup.set("transition")
        }}
    >
        <Icon size={1.2} id="transition" white={!!customTransition} />
    </MaterialButton>
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

        padding: 0.4em 0.8em !important;
    }
</style>
