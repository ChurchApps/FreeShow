<script lang="ts">
    import { activePage, activeShow, dictionary, groups, outLocked, outputs, playingAudio, slideTimers, special, styles } from "../../../stores"
    import { previewCtrlShortcuts, previewShortcuts } from "../../../utils/shortcuts"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { getActiveOutputs, isOutCleared, outputSlideHasContent, setOutput } from "../../helpers/output"
    import { getItemWithMostLines, playNextGroup, updateOut } from "../../helpers/showActions"
    import { _show } from "../../helpers/shows"
    import { newSlideTimer } from "../../helpers/tick"
    import Button from "../../inputs/Button.svelte"
    import ShowActions from "../ShowActions.svelte"
    import Audio from "../tools/Audio.svelte"
    import MediaControls from "../tools/MediaControls.svelte"
    import NextTimer from "../tools/NextTimer.svelte"
    import Overlay from "../tools/Overlay.svelte"
    import Show from "../tools/Show.svelte"
    import AudioMeter from "./AudioMeter.svelte"
    import ClearButtons from "./ClearButtons.svelte"
    import MultiOutputs from "./MultiOutputs.svelte"
    import PreviewOutputs from "./PreviewOutputs.svelte"

    $: allActiveOutputs = getActiveOutputs($outputs, true, true, true)
    $: outputId = allActiveOutputs[0]
    let currentOutput: any = {}
    $: currentOutput = outputId ? $outputs[outputId] || {} : {}

    let numberKeyTimeout: any = null
    let previousNumberKey: string = ""
    function keydown(e: any) {
        if ((e.ctrlKey || e.metaKey || e.altKey) && previewCtrlShortcuts[e.key]) {
            e.preventDefault()
            previewCtrlShortcuts[e.key]()
        }

        if (e.target.closest("input") || e.target.closest(".edit")) return

        // group shortcuts
        if ($activeShow && !e.ctrlKey && !e.metaKey && !$outLocked) {
            // play group with custom shortcut keys (A-Z)
            if (/^[A-Z]{1}$/i.test(e.key) && checkGroupShortcuts(e)) {
                e.preventDefault()
                return
            }

            // play slide with number keys
            if ($special.numberKeys && !isNaN(e.key)) {
                previousNumberKey += e.key

                if (numberKeyTimeout) clearTimeout(numberKeyTimeout)
                numberKeyTimeout = setTimeout(() => {
                    let slideIndex = Number(previousNumberKey) - 1
                    playSlideAtIndex(slideIndex)

                    numberKeyTimeout = null
                    previousNumberKey = ""
                }, 300)

                return
            }
        }

        if (previewShortcuts[e.key]) {
            if (previewShortcuts[e.key](e)) e.preventDefault()
            return
        }
    }

    function checkGroupShortcuts(e: any) {
        let currentShowId = outSlide?.id || ($activeShow !== null ? ($activeShow.type === undefined || $activeShow.type === "show" ? $activeShow.id : null) : null)
        if (!currentShowId) return

        let showRef = _show(currentShowId).layouts("active").ref()[0] || []
        let groupIds = showRef.map((a) => a.id)
        let showGroups = groupIds.length ? _show(currentShowId).slides(groupIds).get() : []
        if (!showGroups.length) return

        let globalGroupIds: string[] = []
        Object.entries($groups).forEach(([groupId, group]: any) => {
            if (!group.shortcut || group.shortcut.toLowerCase() !== e.key.toLowerCase()) return
            showGroups.forEach((slide) => {
                if (slide.globalGroup === groupId) globalGroupIds.push(slide.id)
            })
        })

        return playNextGroup(globalGroupIds, { showRef, outSlide, currentShowId }, !e.altKey)
    }

    function playSlideAtIndex(index: number) {
        let slideRef: any = _show("active").layouts("active").ref()[0]
        if (!slideRef[index]) return

        updateOut("active", index, slideRef)
        setOutput("slide", { id: $activeShow?.id, layout: _show("active").get("settings.activeLayout"), index, line: 0 })
    }

    // active menu
    let activeClear: any = null
    let autoChange: boolean = true
    $: if (outputId) autoChange = true
    $: if (autoChange && $outputs) {
        let active = getActiveClear(!isOutCleared("transition"), $playingAudio, !isOutCleared("overlays"), !isOutCleared("slide") && (outputSlideHasContent(currentOutput) || isOutCleared("background")), !isOutCleared("background"))
        if (active !== activeClear) activeClear = active
    }

    function getActiveClear(slideTimer: any, audio: any, overlays: any, slide: any, background: any) {
        if (slideTimer) return "nextTimer"
        if (Object.keys(audio).length) return "audio"
        if (overlays) return "overlays"
        if (slide) return "slide"
        if (background) return "background"
        return null
    }

    // slide timer
    let timer: any = {}
    $: timer = outputId && $slideTimers[outputId] ? $slideTimers[outputId] : {}
    $: Object.entries($outputs).forEach(([id, output]: any) => {
        if ((Object.keys($outputs)?.length > 1 && !output.enabled) || output.keyOutput || output.stageOutput) return
        if (!output.out?.transition || $slideTimers[id]?.timer) return

        newSlideTimer(id, output.out.transition.duration)
    })

    $: currentStyle = $styles[currentOutput?.style] || {}

    // LINES

    $: outSlide = currentOutput.out?.slide
    $: ref = outSlide ? (outSlide?.id === "temp" ? [{ temp: true, items: outSlide.tempItems }] : _show(outSlide.id).layouts([outSlide.layout]).ref()[0]) : []
    let linesIndex: null | number = null
    let maxLines: null | number = null
    $: amountOfLinesToShow = currentStyle.lines !== undefined ? Number(currentStyle.lines) : 0
    $: linesIndex = amountOfLinesToShow && outSlide ? outSlide.line || 0 : null
    $: showSlide = outSlide?.index !== undefined && ref ? _show(outSlide.id).slides([ref[outSlide.index]?.id]).get()[0] : null
    $: slideLines = showSlide ? getItemWithMostLines(showSlide) : null
    $: maxLines = slideLines && linesIndex !== null ? (amountOfLinesToShow >= slideLines ? null : Math.ceil(slideLines / amountOfLinesToShow)) : null

    // HIDE PREVIEW

    let enablePreview = true

    // hide preview in draw page
    // $: enablePreview = ["show", "edit", "settings"].includes($activePage)
    // $: if ($activePage === "draw") enablePreview = false
</script>

<svelte:window on:keydown={keydown} />

<div class="main">
    {#if enablePreview}
        <PreviewOutputs bind:currentOutputId={outputId} />

        <div class="top">
            <Button class="hide" on:click={() => (enablePreview = false)} style="z-index: 2;" title={$dictionary.preview?._hide_preview} center>
                <Icon id="hide" white />
            </Button>
            <!-- disable before hiding: disableTransitions={!enablePreview} -->
            <MultiOutputs />
            <AudioMeter />
        </div>
    {:else}
        <Button on:click={() => (enablePreview = true)} style="width: 100%;" center dark>
            <Icon id="eye" right />
            <T id="preview.show_preview" />
        </Button>
    {/if}

    {#if enablePreview}
        <ShowActions {currentOutput} {ref} {linesIndex} {maxLines} />
    {/if}

    {#if $activePage === "show"}
        <ClearButtons bind:autoChange bind:activeClear />

        {#if activeClear === "background"}
            <MediaControls {currentOutput} {outputId} />
        {:else if activeClear === "slide"}
            <Show {currentOutput} {ref} {linesIndex} {maxLines} />
        {:else if activeClear === "overlays"}
            <Overlay {currentOutput} />
        {:else if activeClear === "audio" && Object.keys($playingAudio).length}
            <Audio />
        {:else if activeClear === "nextTimer"}
            <NextTimer {currentOutput} {timer} />
        {/if}
    {/if}
</div>

<style>
    .main {
        /* max-height: 50%; */
        flex: 1;
        min-width: 50%;
    }

    .top {
        display: flex;
        position: relative;
    }
    /* button {
    background-color: inherit;
    color: inherit;
    border: none;
  } */

    .top :global(.hide) {
        position: absolute;
        top: 10px;
        right: 16px;
        z-index: 1;
        background-color: rgb(0 0 0 / 0.6) !important;
        border: 1px solid rgb(255 255 255 / 0.3);
        width: 40px;
        height: 40px;
        opacity: 0;
        transition: opacity 0.2s;
    }
    .top:hover > :global(.hide) {
        opacity: 1;
    }
</style>
