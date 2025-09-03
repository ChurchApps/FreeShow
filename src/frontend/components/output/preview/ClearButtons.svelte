<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { clearAudio } from "../../../audio/audioFading"
    import { activeSlideRecording, dictionary, isFadingOut, labelsDisabled, outLocked, outputCache, outputs, overlayTimers, playingAudio, playingMetronome, styles } from "../../../stores"
    import { presentationControllersKeysDisabled } from "../../../utils/shortcuts"
    import Icon from "../../helpers/Icon.svelte"
    import { getActiveOutputs, getOutputContent, isOutCleared } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import { clearAll, clearBackground, clearOverlays, clearSlide, clearTimers, restoreOutput } from "../clear"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

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
            activeClear = null
            return
        }

        autoChange = false
        dispatch("update", key)
    }

    $: outputContent = getOutputContent("", $outputs)

    $: backgroundCleared = isOutCleared("background", $outputs)
    $: output = $outputs[getActiveOutputs($outputs, true, true, true)[0]] || {}
    $: outputStyle = $styles[output.style || ""] || {}
    $: canDisplayStyleBG = !outputStyle.clearStyleBackgroundOnText || (!output.out?.slide && !output.out?.background)
    $: styleBackground = backgroundCleared && !$outLocked && outputStyle.backgroundImage && canDisplayStyleBG

    $: slideCleared = isOutCleared("slide", $outputs)

    $: effectsCleared = isOutCleared("effects", $outputs, true)
    $: overlayCleared = isOutCleared("overlays", $outputs, true)
    $: lockedOverlay = !overlayCleared && isOutCleared("overlays", $outputs, false)

    $: slideTimerCleared = isOutCleared("transition", $outputs)

    // audio fade out
    let audioIcon = "audio"
    $: if ($isFadingOut) startAudioIcon()
    else audioIcon = "audio"
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
            <Button style="padding: 0.45em 0.8em;" class="clearAll" disabled={$outLocked || !enableRestore} on:click={restoreOutput} dark center>
                <Icon id="reset" size={1.2} right={!$labelsDisabled} white />
                {#if !$labelsDisabled}<T id={"preview.restore_output"} />{/if}
            </Button>
        {:else}
            <Button style="padding: 0.45em 0.8em;" class="clearAll" disabled={$outLocked || allCleared} on:click={() => clearAll(true)} title="{$dictionary.clear?.all} [esc]" red dark center>
                <Icon id="clear" size={1.2} right={!$labelsDisabled} white />
                {#if !$labelsDisabled}<T id={"clear.all"} />{/if}
            </Button>
        {/if}
    </span>

    <span class="group">
        {#if outputContent?.type !== "pdf" && outputContent?.type !== "ppt"}
            <div class="combinedButton">
                <Button
                    style={styleBackground ? "opacity: 0.5;cursor: default;" : ""}
                    disabled={($outLocked || backgroundCleared) && !styleBackground}
                    on:click={() => clear("background")}
                    title={$outLocked || backgroundCleared ? "" : $dictionary.clear?.background + " [F1]"}
                    dark
                    red
                    center
                >
                    <Icon id="background" size={1.2} white />
                </Button>
                {#if !allCleared}
                    <MaterialButton
                        style="padding: {activeClear === 'background' ? 0 : 2}px !important;min-height: 15px;"
                        isActive={activeClear === "background"}
                        disabled={backgroundCleared}
                        on:click={() => openPreview("background")}
                        title="preview.background"
                    >
                        {#if activeClear === "background"}
                            <Icon style="opacity: 0.8;" id="expand" size={0.7} white />
                        {/if}
                    </MaterialButton>
                {/if}
            </div>
        {/if}

        <div class="combinedButton">
            <Button disabled={$outLocked || slideCleared} on:click={() => clear("slide")} title={$dictionary.clear?.slide + " [F2]"} dark red center>
                <!-- PDFs are visually the background layer as it is toggled by the style "Background" layer, but it behaves as a slide in the code -->
                <!-- display recording icon here if a slide recoring is playing -->
                <Icon id={outputContent?.type === "pdf" ? "background" : $activeSlideRecording ? "record" : "slide"} size={1.2} white />
            </Button>
            {#if !allCleared}
                <MaterialButton style="padding: {activeClear === 'slide' ? 0 : 2}px !important;min-height: 15px;" isActive={activeClear === "slide"} disabled={slideCleared} on:click={() => openPreview("slide")} title="preview.slide">
                    {#if activeClear === "slide"}
                        <Icon style="opacity: 0.8;" id="expand" size={0.7} white />
                    {/if}
                </MaterialButton>
            {/if}
        </div>

        <div class="combinedButton">
            <Button
                style={lockedOverlay ? "opacity: 0.5;cursor: default;" : ""}
                disabled={$outLocked || (overlayCleared && effectsCleared)}
                on:click={() => clear("overlays")}
                title={lockedOverlay ? "" : $dictionary.clear?.overlays + " [F3]"}
                dark
                red
                center
            >
                <Icon id="overlays" size={1.2} white />
            </Button>
            {#if !allCleared}
                <MaterialButton style="padding: {activeClear === 'overlays' ? 0 : 2}px !important;min-height: 15px;" isActive={activeClear === "overlays"} disabled={overlayCleared} on:click={() => openPreview("overlays")} title="preview.overlays">
                    {#if activeClear === "overlays"}
                        <Icon style="opacity: 0.8;" id="expand" size={0.7} white />
                    {/if}
                </MaterialButton>
            {/if}
        </div>

        <div class="combinedButton">
            <Button disabled={$outLocked || audioCleared} on:click={() => clear("audio")} title={$dictionary.clear?.audio + " [F4]"} dark red center>
                <Icon id={audioIcon} size={1.2} white />
            </Button>
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
                <Button
                    disabled={$outLocked || (slideTimerCleared && activeClear !== "nextTimer")}
                    on:click={() => clear("nextTimer")}
                    title={$dictionary.clear?.[Object.keys($overlayTimers).length ? "timer" : "nextTimer"] + (presentationControllersKeysDisabled() ? " [F5]" : "")}
                    dark
                    red
                    center
                >
                    <Icon id="clock" size={1.2} white />
                </Button>
                {#if !allCleared}
                    <MaterialButton
                        style="padding: 2px !important;min-height: 15px;"
                        isActive={activeClear === "nextTimer"}
                        disabled={slideTimerCleared && activeClear !== "nextTimer"}
                        on:click={() => openPreview("nextTimer")}
                        title="preview.nextTimer"
                    >
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
