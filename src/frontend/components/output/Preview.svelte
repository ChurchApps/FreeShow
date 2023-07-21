<script lang="ts">
    import { OUTPUT } from "../../../types/Channels"
    import { activePage, activeShow, dictionary, groups, outLocked, outputs, playingAudio, presenterControllerKeys, showsCache, slideTimers, styles } from "../../stores"
    import { send } from "../../utils/request"
    import { clearAudio } from "../helpers/audio"
    import Icon from "../helpers/Icon.svelte"
    import { clearPlayingVideo, getActiveOutputs, getResolution, isOutCleared, refreshOut, setOutput } from "../helpers/output"
    import { clearAll, getItemWithMostLines, nextSlide, playNextGroup, previousSlide } from "../helpers/showActions"
    import { _show } from "../helpers/shows"
    import T from "../helpers/T.svelte"
    import { newSlideTimer } from "../helpers/tick"
    import Button from "../inputs/Button.svelte"
    import { getStyleResolution } from "../slide/getStyleResolution"
    import AudioMeter from "./AudioMeter.svelte"
    import ClearButtons from "./ClearButtons.svelte"
    import Output from "./Output.svelte"
    import PreviewOutputs from "./PreviewOutputs.svelte"
    import ShowActions from "./ShowActions.svelte"
    import Audio from "./tools/Audio.svelte"
    import Media from "./tools/Media.svelte"
    import NextTimer from "./tools/NextTimer.svelte"
    import Overlay from "./tools/Overlay.svelte"
    import Show from "./tools/Show.svelte"

    $: outputId = getActiveOutputs($outputs, true, true)[0]
    let currentOutput: any = {}
    $: currentOutput = outputId ? $outputs[outputId] || {} : {}
    // TODO: outputIds for multiple outputs (update multiple videos at the same time)

    const ctrlShortcuts: any = {
        // c: () => (callClear = true),
        // f: () => (fullscreen = !fullscreen),
        l: () => outLocked.set(!$outLocked),
        r: () => {
            if (!$outLocked) {
                // outSlide.set($outSlide)
                // outBackground.set($outBackground)
                refreshOut()
            }
        },
    }

    const shortcuts: any = {
        // presenter controller keys
        Escape: () => {
            // if ($activePage !== "show") return
            if ($presenterControllerKeys) {
                // clearVideo()
                clearAll()
            } else if (fullscreen) fullscreen = false
        },
        F1: () => {
            if (!$outLocked) setOutput("background", null)
        },
        F2: () => {
            if ($outLocked) return false

            setOutput("slide", null)
            return true
        },
        F3: () => {
            if (!$outLocked) setOutput("overlays", [])
        },
        F4: () => {
            if (!$outLocked) clearAudio()
        },
        ".": () => {
            if ($activePage !== "show") return
            // if ($presenterControllerKeys)

            // clearVideo()
            clearAll()
        },
        F5: () => {
            if ($presenterControllerKeys) nextSlide(null)
            else setOutput("transition", null)
        },
        PageDown: (e: any) => {
            if ($activeShow?.type !== "show" && $activeShow?.type !== undefined) return
            if ($presenterControllerKeys) nextSlide(e)
        },
        PageUp: () => {
            if ($activeShow?.type !== "show" && $activeShow?.type !== undefined) return
            if ($presenterControllerKeys) previousSlide()
        },

        ArrowRight: (e: any) => {
            // if ($activeShow?.type !== "show" && $activeShow?.type !== undefined) return
            if ($outLocked || e.ctrlKey || e.metaKey) return
            nextSlide(e)
        },
        ArrowLeft: (e: any) => {
            // if ($activeShow?.type !== "show" && $activeShow?.type !== undefined) return
            if ($outLocked || e.ctrlKey || e.metaKey) return
            previousSlide()
        },
        " ": (e: any) => {
            if ($activeShow?.type !== "show" && $activeShow?.type !== undefined) return
            // TODO: ...
            e.preventDefault()
            if (currentOutput.out?.slide?.id !== $activeShow?.id || ($activeShow && currentOutput.out?.slide?.layout !== $showsCache[$activeShow.id].settings.activeLayout)) nextSlide(e, true)
            else {
                if (e.shiftKey) previousSlide()
                else nextSlide(e)
            }
        },
        Home: (e: any) => {
            if ($activeShow?.type !== "show" && $activeShow?.type !== undefined) return
            nextSlide(e, true)
        },
        End: (e: any) => {
            if ($activeShow?.type !== "show" && $activeShow?.type !== undefined) return
            nextSlide(e, false, true)
        },
    }

    function keydown(e: any) {
        if ((e.ctrlKey || e.metaKey || e.altKey) && ctrlShortcuts[e.key]) {
            e.preventDefault()
            ctrlShortcuts[e.key]()
        }

        if (e.target.closest("input") || e.target.closest(".edit")) return

        // group shortcuts
        if ($activeShow && !e.ctrlKey && !e.metaKey && /^[A-Z]{1}$/i.test(e.key) && checkGroupShortcuts(e)) {
            e.preventDefault()
            return
        }

        // ($activeShow?.type === "show" || $activeShow?.type === undefined) &&
        if (shortcuts[e.key]) {
            if (shortcuts[e.key](e)) e.preventDefault()
            return
        }

        // if (["media", "video", "player"].includes(currentOutput.out?.background?.type || "")) {
        //     e.preventDefault()
        //     if (e.key === " ") {
        //         videoData.paused = !videoData.paused
        //         // send(OUTPUT, ["UPDATE_VIDEO"], { id: outputId, data: videoData })
        //         // // send(OUTPUT, ["UPDATE_VIDEO_TIME"], videoTime)

        //         // Media.svelte sentToOutput()
        //         send(OUTPUT, ["UPDATE_VIDEO"], { id: outputId, data: videoData, updatePreview: true })
        //         if (currentOutput.keyOutput) send(OUTPUT, ["UPDATE_VIDEO"], { id: currentOutput.keyOutput, data: videoData, updatePreview: true })
        //     }
        // }
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

    let fullscreen: boolean = false
    $: resolution = getResolution(currentStyle.resolution)

    // TODO: video gets ((removed)) if video is starting while another is fading out
    let video: any = null
    let videoData: any = {
        duration: 0,
        paused: true,
        muted: false,
        loop: false,
    }
    let videoTime: number = 0

    // duration is for some reason NaN sometimes
    $: if (video && videoData && !videoData?.duration) videoData.duration = video.duration
    $: if (!video && videoTime) videoTime = 0

    let title: string = ""

    // active menu
    // TODO: remember previous and go back on clear!
    let activeClear: any = null
    let autoChange: boolean = true
    $: {
        if (autoChange && $outputs) {
            // let active = getActiveClear(currentOutput.out?.transition, $playingAudio, currentOutput.out?.overlays, currentOutput.out?.slide, currentOutput.out?.background)
            let active = getActiveClear(!isOutCleared("transition"), $playingAudio, !isOutCleared("overlays"), !isOutCleared("slide"), !isOutCleared("background"))
            if (active !== activeClear) activeClear = active
        }
    }

    $: if (outputId) autoChange = true

    function getActiveClear(slideTimer: any, audio: any, overlays: any, slide: any, background: any) {
        if (slideTimer) return "nextTimer"
        if (Object.keys(audio).length) return "audio"
        //   if (overlays?.length) return "overlays"
        //   if (slide?.id) return "slide"
        if (overlays) return "overlays"
        if (slide) return "slide"
        if (background) return "background"
        return null
    }

    // slide timer
    let timer: any = {}
    $: timer = outputId && $slideTimers[outputId] ? $slideTimers[outputId] : {}
    $: {
        Object.entries($outputs).forEach(([id, output]: any) => {
            if (output.enabled && output.out?.transition && !$slideTimers[id]) {
                newSlideTimer(id, output.out.transition.duration)
            }
        })
    }

    $: currentStyle = $styles[currentOutput?.style] || {}

    // lines
    $: outSlide = currentOutput.out?.slide
    $: ref = outSlide ? (outSlide?.id === "temp" ? [{ temp: true, items: outSlide.tempItems }] : _show(outSlide.id).layouts([outSlide.layout]).ref()[0]) : []
    let linesIndex: null | number = null
    let maxLines: null | number = null
    $: amountOfLinesToShow = currentStyle.lines !== undefined ? Number(currentStyle.lines) : 0
    $: linesIndex = amountOfLinesToShow && outSlide ? outSlide.line || 0 : null
    $: showSlide = outSlide?.index !== undefined && ref ? _show(outSlide.id).slides([ref[outSlide.index].id]).get()[0] : null
    $: slideLines = showSlide ? getItemWithMostLines(showSlide) : null
    $: maxLines = slideLines && linesIndex !== null ? (amountOfLinesToShow >= slideLines ? null : Math.round(slideLines / amountOfLinesToShow)) : null

    // TODO: only show preview in "show" ? (toggle in settings)
    // $: enablePreview = ["show", "edit", "settings"].includes($activePage)
    $: enablePreview = true

    // clear video
    let callVideoClear: boolean = false
    $: if (callVideoClear) clearVideo()
    async function clearVideo() {
        // outputCache.set(clone($outputs))

        // videoData.paused = true // ?
        videoData = await clearPlayingVideo()

        // RESET
        video = null
        videoTime = 0

        callVideoClear = false
    }

    function toggleFullscreen(e: any) {
        if (!e.target.closest(".zoomed")) return
        fullscreen = !fullscreen
    }

    // MEDIA

    // auto clear video on finish
    $: if (videoTime && videoData.duration && !videoData.paused && videoTime + 0.5 >= videoData.duration) {
        // this will start changing 0.2s before video ends (video is paused when changing)
        setTimeout(clearVideo2, 300)
    }

    let clearing: boolean = false
    function clearVideo2() {
        if (clearing) return

        clearing = true
        setTimeout(() => {
            clearing = false
        }, 1000)

        // check nextAfterMedia
        let slideOut = currentOutput.out?.slide
        if (slideOut) {
            let layoutSlide = _show(slideOut.id).layouts([slideOut.layout]).ref()[0][slideOut.index]
            let nextAfterMedia = layoutSlide?.data?.actions?.nextAfterMedia
            if (nextAfterMedia) {
                // videoTime = 0
                setTimeout(() => {
                    nextSlide(null, false, false, true, true, outputId)
                }, 100)
                return
            }
        }

        if (videoData.loop) return

        setOutput("background", null)
        videoTime = 0
        send(OUTPUT, ["UPDATE_VIDEO"], { id: outputId, time: 0 })
        if (currentOutput.keyOutput) send(OUTPUT, ["UPDATE_VIDEO"], { id: currentOutput.keyOutput, time: 0 })

        // dont think this is nessesary
        setTimeout(() => {
            if (!currentOutput.out?.background) video = null
        }, 500)
    }

    // $: if (currentOutput.out?.background === null) {
    //     clearVideo()
    // }
</script>

<svelte:window on:keydown={keydown} />

<div class="main">
    {#if enablePreview}
        <PreviewOutputs bind:currentOutputId={outputId} />
    {:else}
        <Button on:click={() => (enablePreview = true)} style="width: 100%;" center dark>
            <Icon id="eye" right />
            <T id="preview.show_preview" />
        </Button>
    {/if}
    <div class="top" class:hide={!enablePreview}>
        <Button class="hide" on:click={() => (enablePreview = false)} style="z-index: 2;" title={$dictionary.preview?._hide_preview} center>
            <Icon id="hide" white />
        </Button>
        <div on:click={toggleFullscreen} class:fullscreen style={fullscreen ? "width: 100%;height: 100%;" : "width: calc(100% - 6px);"}>
            {#if fullscreen}
                <Button class="hide" on:click={() => (fullscreen = false)} style="z-index: 2;opacity: 1;right: 10px;" title={$dictionary.actions?.close} center>
                    <Icon id="close" size={1.5} white />
                </Button>
                <span class="resolution">
                    <!-- TODO: get actual resultion ... -->
                    <p><b><T id="screen.width" />:</b> {resolution.width} <T id="screen.pixels" /></p>
                    <p><b><T id="screen.height" />:</b> {resolution.height} <T id="screen.pixels" /></p>
                </span>
            {/if}
            <Output center={fullscreen} style={fullscreen ? getStyleResolution(resolution, window.innerWidth, window.innerHeight, "fit") : ""} mirror preview bind:video bind:videoData bind:videoTime bind:title />
            <!-- <RecordedOutput /> -->
        </div>
        <AudioMeter />
        <!-- {#if $activePage === 'live'}
    {/if} -->
    </div>

    <!-- TODO: enable stage output -->

    <!-- TODO: title keyboard shortcuts -->

    {#if enablePreview}
        <ShowActions {currentOutput} {ref} {linesIndex} {maxLines} />
    {/if}

    {#if $activePage === "show"}
        <ClearButtons bind:autoChange bind:activeClear bind:callVideoClear />

        {#if activeClear === "background"}
            <Media {currentOutput} {outputId} {video} bind:videoData bind:videoTime bind:title />
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
    .top.hide {
        display: none;
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

    .fullscreen {
        position: fixed;
        background-color: var(--primary-darkest);
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        /* border: 4px solid var(--secondary); */
        z-index: 90;
    }
    .resolution {
        position: absolute;
        bottom: 0;
        right: 0;

        color: var(--secondary-text);
        /* background-color: var(--primary);
    background-color: black; */
        text-align: right;
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 10px 12px;
        opacity: 0.8;
        transition: opacity ease-in-out 0.2s;

        z-index: 30;
    }
    .resolution:hover {
        opacity: 0;
    }
    .resolution p {
        display: flex;
        gap: 5px;
        justify-content: space-between;
    }
</style>
