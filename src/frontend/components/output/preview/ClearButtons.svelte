<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { clearAudio } from "../../../audio/audioFading"
    import { activeSlideRecording, activeTimers, isFadingOut, labelsDisabled, media, outLocked, outputCache, outputs, overlayTimers, playingAudio, playingMetronome, styles } from "../../../stores"
    import { presentationControllersKeysDisabled } from "../../../utils/shortcuts"
    import Icon from "../../helpers/Icon.svelte"
    import { getActiveOutputs, getOutputContent, isOutCleared } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { clearAll, clearBackground, clearOverlays, clearSlide, clearTimers, restoreOutput } from "../clear"

    export let autoChange: any
    export let activeClear: any

    $: audioCleared = !Object.keys($playingAudio).length && !$playingMetronome
    $: allCleared = isOutCleared(null, $outputs) && audioCleared
    $: if (allCleared) autoChange = true

    let enableRestore = false
    let restoreTimeout: NodeJS.Timeout | null = null
    $: if ($outputCache) {
        enableRestore = false
        if (restoreTimeout) clearTimeout(restoreTimeout)
        restoreTimeout = setTimeout(() => (enableRestore = true), 1000)
    }
    $: if (!allCleared) {
        enableRestore = false
        outputCache.set(null)
    }

    // ACTIONS

    const clearActions = {
        background: () => clearBackground(),
        slide: () => clearSlide(),
        overlays: () => clearOverlays(),
        audio: () => clearAudio("", { clearPlaylist: true, commonClear: true }),
        nextTimer: () => clearTimers()
    }

    function clear(key: string) {
        if ($outLocked || !clearActions[key]) return
        autoChange = true

        clearActions[key]()
    }

    let dispatch = createEventDispatcher()
    function openPreview(key: string) {
        if (activeClear === key) {
            autoChange = true
            return
        }

        autoChange = false
        dispatch("update", key)
    }

    $: outputContent = getOutputContent("", $outputs)

    $: backgroundCleared = isOutCleared("background", $outputs)
    $: outputId = getActiveOutputs($outputs, true, true, true)[0] || ""
    $: output = $outputs[outputId] || {}
    $: outputStyle = $styles[output.style || ""] || {}
    $: canDisplayStyleBG = !outputStyle.clearStyleBackgroundOnText || (!output.out?.slide && !output.out?.background)
    $: styleBackground = backgroundCleared && !$outLocked && outputStyle.backgroundImage && canDisplayStyleBG
    $: outBackground = output.out?.background || {}
    $: backgroundData = $media[outBackground.path || ""] || {}

    $: isScripture = outputContent?.id === "temp"
    $: isMetronome = $playingMetronome && !Object.keys($playingAudio).length
    $: isTimer = !output.out?.transition && !Object.values($overlayTimers).find((a) => a.outputId === outputId) && Object.keys($activeTimers).length

    $: slideCleared = isOutCleared("slide", $outputs)

    $: effectsCleared = isOutCleared("effects", $outputs, true)
    $: overlayCleared = isOutCleared("overlays", $outputs, true)
    $: lockedOverlay = !overlayCleared && isOutCleared("overlays", $outputs, false)

    $: slideTimerCleared = [isOutCleared("transition", $outputs), !!$overlayTimers, !!$activeTimers][0]

    // audio fade out
    let audioIcon = "audio"
    $: if ($isFadingOut) startAudioIcon()
    else audioIcon = isMetronome ? "metronome" : "audio"
    function startAudioIcon() {
        audioIcon = "volume"
        setTimeout(() => {
            if (!$isFadingOut) return
            audioIcon = "volume_down"

            setTimeout(() => {
                if (!$isFadingOut) return
                audioIcon = "volume_off"

                setTimeout(() => {
                    if (!$isFadingOut) return
                    startAudioIcon()
                }, 1000)
            }, 400)
        }, 400)
    }
</script>

<div class="clear">
    <span>
        {#if allCleared && $outputCache && $outputCache?.slide?.type !== "ppt"}
            <MaterialButton style="padding: 0.42em 0.8em;" class="clearAll" disabled={$outLocked || !enableRestore} on:click={restoreOutput}>
                <Icon id="reset" size={1.2} white />
                {#if !$labelsDisabled}<T id="preview.restore_output" />{/if}
            </MaterialButton>
        {:else}
            <MaterialButton style="padding: 0.42em 0.8em;" class="clearAll" disabled={$outLocked || allCleared} title="clear.all [esc]" on:click={() => clearAll(true)} red>
                <Icon id="clear" size={1.2} white />
                {#if !$labelsDisabled}<T id="clear.all" />{/if}
            </MaterialButton>
        {/if}
    </span>

    <span class="group">
        {#if outputContent?.type !== "pdf" && outputContent?.type !== "ppt"}
            <div class="combinedButton">
                <MaterialButton style="padding: 0.3em 0.6em;{styleBackground ? 'opacity: 0.5;cursor: default;' : ''}" disabled={($outLocked || backgroundCleared) && !styleBackground} title={$outLocked || backgroundCleared ? "" : "clear.background [F1]"} on:click={() => clear("background")} red>
                    <Icon id="background" size={1.2} white />
                </MaterialButton>
                {#if !allCleared}
                    <MaterialButton style="padding: {activeClear === 'background' ? 0 : 2}px !important;min-height: 15px;" isActive={activeClear === "background"} disabled={backgroundCleared} on:click={() => openPreview("background")} title="preview.background">
                        {#if activeClear === "background"}
                            <Icon style="opacity: 0.8;" id="expand" size={0.7} white />
                        {/if}
                    </MaterialButton>
                {/if}
            </div>
        {/if}

        {#if backgroundData.videoType !== "foreground"}
            <div class="combinedButton">
                <MaterialButton style="padding: 0.3em 0.6em;" disabled={$outLocked || slideCleared} title="clear.slide  [F2]" on:click={() => clear("slide")} red>
                    <!-- PDFs are visually the background layer as it is toggled by the style "Background" layer, but it behaves as a slide in the code -->
                    <!-- display recording icon here if a slide recoring is playing -->
                    <Icon id={isScripture ? "scripture" : outputContent?.type === "pdf" ? "background" : $activeSlideRecording ? "record" : "slide"} size={1.2} white />
                </MaterialButton>
                {#if !allCleared}
                    <MaterialButton style="padding: {activeClear === 'slide' ? 0 : 2}px !important;min-height: 15px;" isActive={activeClear === "slide"} disabled={slideCleared} on:click={() => openPreview("slide")} title="preview.slide">
                        {#if activeClear === "slide"}
                            <Icon style="opacity: 0.8;" id="expand" size={0.7} white />
                        {/if}
                    </MaterialButton>
                {/if}
            </div>
        {/if}

        <div class="combinedButton">
            <MaterialButton style="padding: 0.3em 0.6em;{lockedOverlay ? 'opacity: 0.5;cursor: default;' : ''}" disabled={$outLocked || (overlayCleared && effectsCleared)} title={lockedOverlay ? "" : "clear.overlays [F3]"} on:click={() => clear("overlays")} red>
                <Icon id="overlays" size={1.2} white />
            </MaterialButton>
            {#if !allCleared}
                <MaterialButton style="padding: {activeClear === 'overlays' ? 0 : 2}px !important;min-height: 15px;" isActive={activeClear === "overlays"} disabled={overlayCleared} on:click={() => openPreview("overlays")} title="preview.overlays">
                    {#if activeClear === "overlays"}
                        <Icon style="opacity: 0.8;" id="expand" size={0.7} white />
                    {/if}
                </MaterialButton>
            {/if}
        </div>

        <div class="combinedButton">
            <MaterialButton style="padding: 0.3em 0.6em;" disabled={$outLocked || audioCleared} title="clear.audio [F4]" on:click={() => clear("audio")} red>
                <Icon id={audioIcon} size={1.2} white />
            </MaterialButton>
            {#if !allCleared}
                <MaterialButton style="padding: {activeClear === 'audio' ? 0 : 2}px !important;min-height: 15px;" isActive={activeClear === "audio"} disabled={audioCleared} on:click={() => openPreview("audio")} title="preview.audio">
                    {#if activeClear === "audio"}
                        <Icon style="opacity: 0.8;" id="expand" size={0.7} white />
                    {/if}
                </MaterialButton>
            {/if}
        </div>

        {#if outputContent?.type !== "pdf"}
            <div class="combinedButton">
                <MaterialButton style="padding: 0.3em 0.6em;{isTimer ? 'opacity: 0.9;' : ''}" disabled={$outLocked || (slideTimerCleared && activeClear !== "nextTimer")} title="{isTimer ? 'actions.stop_timers' : `clear.${Object.keys($overlayTimers).length ? 'timer' : 'nextTimer'}`}{presentationControllersKeysDisabled() ? ' [F5]' : ''}" on:click={() => (isTimer ? activeTimers.set([]) : clear("nextTimer"))} red>
                    <Icon id={isTimer ? "timer" : "clock"} size={1.2} white />
                </MaterialButton>
                {#if !allCleared}
                    <MaterialButton style="padding: 2px !important;min-height: 15px;" isActive={activeClear === "nextTimer"} disabled={slideTimerCleared && activeClear !== "nextTimer"} on:click={() => openPreview("nextTimer")} title="preview.nextTimer">
                        {#if activeClear === "nextTimer"}
                            <Icon style="opacity: 0.8;" id="expand" size={0.7} white />
                        {/if}
                    </MaterialButton>
                {/if}
            </div>
        {/if}
    </span>
</div>

<style>
    .clear {
        display: flex;
        flex-direction: column;
    }

    :global(.clearAll) {
        width: 100%;
    }

    .group {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
    }
    .group :global(button) {
        flex-grow: 1;
        /* height: 40px; */

        border-radius: 0;
    }
    .clear :global(button:disabled) {
        background-color: var(--primary) !important;
    }
    .group :global(button.isActive) {
        border: none !important;
        border-right: 1px solid var(--primary-lighter) !important;
        border-left: 1px solid var(--primary-lighter) !important;
    }

    .combinedButton {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
    }
    .combinedButton :global(button:last-child) {
        padding: 5px !important;
    }
</style>
