<script lang="ts">
    import { onDestroy } from "svelte"
    import type { Unsubscriber } from "svelte/store"
    import { uid } from "uid"
    import { Main } from "../../../types/IPC/Main"
    import type { MediaStyle } from "../../../types/Main"
    import { requestMain, sendMain } from "../../IPC/main"
    import { activeProject, activeRename, audioChannelsData, focusMode, media, outLocked, outputs, playingVideos, projects, videoMarkers } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { enableSubtitle, encodeFilePath, getExtension, getFileName, getMediaLayerType, removeExtension } from "../helpers/media"
    import { getFirstActiveOutput, setOutput } from "../helpers/output"
    import { joinTime, secondsToTime } from "../helpers/time"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import HiddenInput from "../inputs/HiddenInput.svelte"
    import HoverButton from "../inputs/HoverButton.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MediaPicker from "../inputs/MediaPicker.svelte"
    import { SoftLoopSync } from "../media/video/softLoop"
    import { syncVideoToAudio, videoSync } from "../media/video/videoSync"
    import VideoSlider from "../output/VideoSlider.svelte"
    import { clearSlide } from "../output/clear"
    import MediaControls from "../output/tools/MediaControls.svelte"
    import Player from "../system/Player.svelte"
    import { formatVTT, SRTtoVTT } from "./media/subtitles"

    export let mediaPath: string
    export let show

    $: showId = show?.id
    $: type = show?.type

    // NOTE: subtitles uses local mediaPath - time markers uses synced showId path

    // show updates when videoTime updates for some reason?
    // $: console.trace(show)
    // $: console.trace(videoTime)

    $: subtitleData = $media[mediaPath] || {}
    $: tracks = subtitleData.tracks || []
    $: subtitle = subtitleData.subtitle || ""
    $: if (type !== "player" && mediaPath && subtitleData.tracks === undefined) sendMain(Main.MEDIA_TRACKS, { path: mediaPath })

    export let mediaStyle: MediaStyle = {}

    let softLoopVideo: HTMLVideoElement | null = null
    let softLoopOpacity = 0

    let unsubscriber: Unsubscriber | null = null
    $: setTimeout(() => pathChanged(mediaPath, outputId))
    function pathChanged(path: string | undefined, outputId: string) {
        if (unsubscriber) {
            unsubscriber()
            unsubscriber = null
        }

        if (!path || type !== "video") return

        videoData = { paused: false, muted: true, duration: 0, loop: false, softLoop: 0 }

        let firstLoad = true
        let lastSyncedTime: number | null = null
        unsubscriber = videoSync(path, outputId, (data) => {
            if (firstLoad) {
                firstLoad = false
                setTimeout(() => {
                    videoTime = data.currentTime || 0
                }, 50)
            } else {
                const isSoftLoop = !!(data.softLoop && data.softLoop > 0)
                const rate = Number(mediaStyle.speed) || 1
                syncVideoToAudio(video || null, data.currentTime, lastSyncedTime, isSoftLoop, rate)
                if (data.currentTime !== undefined) lastSyncedTime = data.currentTime
            }

            if (data.duration) videoData.duration = data.duration
            if (playingInOutput) videoData.paused = data.paused
            videoData.loop = playingInOutput ? data.loop : false
            if (data.softLoop !== undefined) videoData.softLoop = data.softLoop
            if (data.softLoopOpacity !== undefined) softLoopOpacity = data.softLoopOpacity
            softLoopAudioTime = data.currentTime
            // videoData.muted = data.muted
        })
    }
    onDestroy(() => {
        if (unsubscriber) unsubscriber()
    })

    let videoTime = 0
    let videoData = { paused: false, muted: true, duration: 0, loop: false, softLoop: 0 }
    $: if (showId) videoData.paused = false
    $: if (!videoData) videoData = { paused: false, muted: true, duration: 0, loop: false, softLoop: 0 }

    let prevId: string | undefined = undefined
    $: if (mediaPath !== prevId) {
        videoTime = 0
        autoPause = true
        prevId = mediaPath

        timeMarkersEnabled = !!$videoMarkers[mediaPath]?.length || false
        if (timeMarkersEnabled && manageSubtitles) manageSubtitles = false
    }

    // background output
    $: outputId = $playingVideos.find((a) => a.path === mediaPath)?.linkedOutputIds?.[0] || getFirstActiveOutput()?.id || ""
    $: currentOutput = outputId ? $outputs[outputId] || null : null

    // outBackground.subscribe(backgroundChanged)
    $: background = currentOutput?.out?.background || {}
    $: if (background || mediaPath) backgroundChanged()
    let playingInOutput = false
    function backgroundChanged() {
        // background = currentOutput?.out?.background || {}
        // || videoData.paused
        if (background === null || (background.path || background.id) !== mediaPath) {
            playingInOutput = false
            return
        }
        // if (background.type !== "media" && background.type !== "video") return

        autoPause = true
        // videoData.paused = true
        playingInOutput = true

        // trigger time update
        setTimeout(() => (videoTime = 0), 50)
    }

    // WIP player video output time

    let autoPause = true
    let hasLoaded = false

    let manageSubtitles = false
    let timeMarkersEnabled = false

    function onLoad() {
        hasLoaded = true
        if (videoData.paused) return

        if ($focusMode) {
            // set right after loaded
            setTimeout(() => {
                videoData.paused = true
                videoTime = videoData.duration ? videoData.duration / 2 : 0
            })
            return
        }

        if (autoPause) videoData.paused = false
        else videoTime = 0

        if (subtitle && video) enableSubtitle(video, subtitle)
    }

    // player
    $: if (type === "player") playerLoad()
    function playerLoad() {
        if (!$focusMode) return

        // timeout for loading, because if the video is not loaded in time it will start playing, but that's fine
        setTimeout(() => {
            videoData.paused = true
            videoTime = videoData.duration ? videoData.duration / 2 : 0
        }, 2000)
    }

    let video: HTMLVideoElement | undefined
    function onPlay() {
        if (hasLoaded) {
            if (!playingInOutput) videoTime = 0
            hasLoaded = false
        }
    }

    let shouldLoop = false
    let shouldBeMuted = false
    $: videoType = getMediaLayerType(mediaPath, mediaStyle)
    $: projectItem = $projects[$activeProject || ""]?.shows?.[show?.index]
    $: if (mediaPath) {
        shouldLoop = typeof projectItem?.loop === "boolean" ? projectItem.loop : videoType === "background" ? true : false
        shouldBeMuted = typeof projectItem?.muted === "boolean" ? projectItem.muted : videoType === "background" ? true : false
    }
    function playVideo(startAt = 0) {
        if ($outLocked) return

        let loop = shouldLoop
        let muted = shouldBeMuted
        if (videoType === "foreground" || (videoType !== "background" && !shouldLoop)) clearSlide()
        let bg: any = { type, startAt, muted, loop, ...mediaStyle, ignoreLayer: videoType === "foreground" }

        if (type === "player") bg.id = mediaPath
        else {
            bg.path = mediaPath
            // if (filter) data.filter = filter
        }

        // autoPause = true
        // videoData.paused = true

        // TODO: playing in multiple outputs will create unclearable "ghost" video

        setOutput("background", bg)
    }

    function toggleLoop() {
        shouldLoop = !shouldLoop
        saveToProject("loop", shouldLoop)
    }
    function toggleMute() {
        shouldBeMuted = !shouldBeMuted
        saveToProject("muted", shouldBeMuted)
    }

    // save in project item if any active
    function saveToProject(key: string, value: any) {
        if (!projectItem || projectItem.id !== showId) return

        projects.update((a) => {
            a[$activeProject || ""].shows[show.index][key] = value
            return a
        })
    }

    $: if (video && mediaStyle.speed) video.playbackRate = Number(mediaStyle.speed)

    let edit = false

    // SUBTITLE

    function changeSubtitleName(e: any) {
        let subtitleIndex = e.detail?.id?.slice("subtitle_".length)
        let value = e.detail.value
        if (subtitleIndex === undefined || !value) return

        media.update((a) => {
            if (!a[mediaPath]?.tracks?.[subtitleIndex]) return a
            a[mediaPath].tracks![subtitleIndex].name = value
            if (a[mediaPath].tracks![subtitleIndex].lang.length !== 2) a[mediaPath].tracks![subtitleIndex].lang = value.replaceAll(" ", "_").toLowerCase()

            return a
        })
    }

    async function subtitlePicked(e: any) {
        let path = e.detail || ""
        let content = (await requestMain(Main.READ_FILE, { path }))?.content
        if (!content) return

        let extension = getExtension(path)
        if (extension === "srt") {
            content = SRTtoVTT(content)
        }

        content = formatVTT(content)

        media.update((a) => {
            if (!a[mediaPath]) a[mediaPath] = {}
            if (!a[mediaPath].tracks) a[mediaPath].tracks = []

            let name = removeExtension(getFileName(path)).replaceAll(" ", "_")
            let id = name || uid(5)
            a[mediaPath].tracks!.push({ lang: id, name, vtt: content })

            activeRename.set("subtitle_" + (a[mediaPath].tracks!.length - 1))

            return a
        })
    }

    function setActiveSubtitle(e: any, lang: string) {
        if (e.target?.closest?.(".edit")) return

        media.update((a) => {
            if (!a[mediaPath]) a[mediaPath] = {}
            if (a[mediaPath].subtitle === lang) {
                a[mediaPath].subtitle = ""
                lang = ""
            } else a[mediaPath].subtitle = lang

            return a
        })
    }

    $: if (subtitle !== undefined && video) enableSubtitle(video, subtitle)

    // MARKER

    // TODO: history
    function addMarker() {
        videoMarkers.update((a) => {
            const newMarker = { name: "", time: Math.floor(videoTime || 0) }

            if (a[showId]?.find((a) => a.time === newMarker.time)) return a

            if (!a[showId]) a[showId] = []
            a[showId].push(newMarker)

            // sort by time
            a[showId] = a[showId].sort((a, b) => a.time - b.time)

            let markerIndex = a[showId].findIndex((a) => a.time === newMarker.time)
            activeRename.set("marker_" + markerIndex)

            return a
        })
    }

    function changeName(e: any) {
        let currentMarker = e.detail?.id?.slice("marker_".length)
        if (currentMarker === undefined) return

        videoMarkers.update((a) => {
            a[showId][currentMarker].name = e.detail.value

            return a
        })
        // history({ id: "UPDATE", newData: { key: "layouts", keys: [currentLayout], subkey: "name", data: e.detail.value }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
    }

    let pausedByEdit = false
    $: if (edit) {
        if (!videoData.paused) {
            videoData.paused = true
            pausedByEdit = true
        }
    } else if (pausedByEdit) {
        videoData.paused = false
        pausedByEdit = false
    }

    $: mediaStyleString = `width: 100%;height: 100%;filter: ${mediaStyle.filter || ""};object-fit: ${mediaStyle.fit === "blur" ? "contain" : mediaStyle.fit || "contain"};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`
    $: mediaStyleBlurString = `position: absolute;filter: ${mediaStyle.filter || ""} blur(${mediaStyle.fitOptions?.blurAmount ?? 6}px) opacity(${mediaStyle.fitOptions?.blurOpacity || 0.3});object-fit: cover;width: 100%;height: 100%;transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`

    let blurVideo: HTMLVideoElement | undefined
    $: if (blurVideo && (videoTime < blurVideo.currentTime - 0.3 || videoTime > blurVideo.currentTime + 0.3)) blurVideo.currentTime = videoTime
    $: if (!videoData.paused && blurVideo?.paused) blurVideo.play()
    $: blurPausedState = videoData.paused

    onDestroy(() => {
        const cleanupVideo = (el: HTMLVideoElement | null | undefined) => {
            if (!el) return
            try {
                el.pause()
                el.removeAttribute("src")
                el.load()
            } catch (e) {
                console.error("Error cleaning up video element in VideoShow:", e)
            }
        }
        cleanupVideo(video)
        cleanupVideo(blurVideo)
        cleanupVideo(softLoopVideo)
    })

    // WIP if paused on mount, blur video does not get paused

    // Soft loop

    $: softLoopValue = videoData.softLoop ?? mediaStyle.softLoop ?? 0
    $: fromTime = mediaStyle.fromTime || 0
    $: toTime = mediaStyle.toTime || 0

    const softLoopSync = new SoftLoopSync()
    onDestroy(() => softLoopSync.destroy())

    let softLoopAudioTime: number | undefined
    $: effectiveSoftLoopOpacity = softLoopSync.update(softLoopOpacity, videoTime, fromTime, softLoopValue, video || null, softLoopVideo, videoData.paused, toTime, softLoopAudioTime)
</script>

{#key mediaPath || showId}
    <div id={mediaPath || showId} class="media context #media_preview" style="flex: 1;overflow: hidden;">
        <!-- TODO: info about: CTRL click to play at current pos -->
        <HoverButton hide={playingInOutput} icon="play" size={10} on:click={(e) => playVideo(e.ctrlKey || e.metaKey ? videoTime : 0)}>
            {#if type === "player"}
                <Player id={showId} {outputId} preview />
            {:else if mediaPath}
                <!-- TODO: use Video.svelte element instead -->
                <!-- TODO: on:error={videoError} - ERR_FILE_NOT_FOUND -->
                {#if mediaStyle.fit === "blur"}
                    <video style={mediaStyleBlurString} src={encodeFilePath(mediaPath)} bind:this={blurVideo} bind:paused={blurPausedState} loop={videoData.loop} muted />
                {/if}
                {@const mainVol = $audioChannelsData.main?.volume ?? 1}
                <video style={mediaStyleString} src={encodeFilePath(mediaPath)} on:loadedmetadata={onLoad} on:playing={onPlay} bind:this={video} bind:currentTime={videoTime} bind:paused={videoData.paused} bind:duration={videoData.duration} bind:muted={videoData.muted} volume={Math.min(1, Math.max(0, mainVol))} loop={videoData.loop}>
                    <track kind="captions" src="" label="No captions available" />
                    {#each tracks as track}
                        <track label={track.name} srclang={track.lang} kind="subtitles" src="data:text/vtt;charset=utf-8,{encodeURI(track.vtt)}" />
                    {/each}
                </video>

                {#if softLoopValue > 0 && videoData.loop}
                    <video style="{mediaStyleString} position: absolute;top: 0;left: 0;transition: 0.2s opacity;opacity: {effectiveSoftLoopOpacity};pointer-events: none;" bind:this={softLoopVideo} src={encodeFilePath(mediaPath)} muted loop={videoData.loop} />
                {/if}
            {/if}
        </HoverButton>
    </div>
{/key}

{#if !$focusMode}
    {#if !playingInOutput && !manageSubtitles && !timeMarkersEnabled}
        <FloatingInputs side="left">
            <MaterialButton title={"media._loop" + (shouldLoop ? ": settings.enabled" : "")} on:click={toggleLoop}>
                <Icon id="loop" size={1.2} white={!shouldLoop} />
            </MaterialButton>

            <!-- <div class="divider" /> -->

            <MaterialButton title={!shouldBeMuted ? "actions.mute" : "actions.unmute"} disabled={$outLocked} on:click={toggleMute}>
                <Icon id={!shouldBeMuted ? "volume" : "muted"} size={1.2} white={shouldBeMuted} />
            </MaterialButton>
        </FloatingInputs>
    {/if}

    {#if playingInOutput ? tracks.length : manageSubtitles}
        <FloatingInputs side="left" style={playingInOutput ? `margin-bottom: ${$videoMarkers[showId]?.length ? 100 : 50}px;` : "max-width: 50%;"}>
            {#if tracks.length}
                <div class="scroll">
                    {#each tracks as track, i}
                        <MaterialButton id={i.toString()} style="font-weight: normal;" isActive={subtitle === track.lang} class="context #video_subtitle{track.embedded ? '_embedded' : ''}" on:click={(e) => setActiveSubtitle(e, track.lang)}>
                            {#if playingInOutput}
                                <p style="padding: 5px;">{track.name}</p>
                            {:else}
                                <HiddenInput value={track.name} id={"subtitle_" + i} on:edit={changeSubtitleName} bind:edit />
                            {/if}
                        </MaterialButton>
                    {/each}
                </div>
            {/if}

            {#if !playingInOutput}
                <div class="divider" />

                <MediaPicker id="subtitles" title={translateText("scripture.local")} filter={{ name: "Video Text Track", extensions: ["vtt", "srt"] }} on:picked={subtitlePicked} dark={false}>
                    <Icon id="add" right={!tracks.length} />
                    {#if !tracks.length}<T id="scripture.local" />{/if}
                    <!-- <Icon id="captions" right={!tracks.length} />
                    {#if !tracks.length}<T id="actions.manage_subtitles" />{/if} -->
                </MediaPicker>
                <!-- <MaterialFilePicker label="scripture.local" style="flex: 1;" icon="add" value="" filter={{ name: "Video Text Track", extensions: ["vtt", "srt"] }} on:change={subtitlePicked} /> -->
            {/if}
        </FloatingInputs>
    {/if}

    {#if playingInOutput ? $videoMarkers[showId]?.length : timeMarkersEnabled}
        <FloatingInputs side="left" style={playingInOutput || manageSubtitles ? "margin-bottom: 50px;" : "max-width: 50%;"}>
            {#if $videoMarkers[showId]?.length}
                <div class="scroll">
                    {#each $videoMarkers[showId] as marker, i}
                        <MaterialButton
                            id={i}
                            style="font-weight: normal;"
                            class="context #video_marker"
                            on:click={() => {
                                if (!edit) {
                                    playVideo(marker.time || 0)
                                }
                            }}
                        >
                            <p style="display: flex;align-items: center;">
                                <HiddenInput value={marker.name} id={"marker_" + i} on:edit={changeName} bind:edit />
                                <span style="opacity: 0.7;">{joinTime(secondsToTime(marker.time))}</span>
                            </p>
                        </MaterialButton>
                    {/each}
                </div>
            {/if}

            {#if !playingInOutput}
                <div class="diviver" />

                <MaterialButton icon="add" title="actions.add_time_marker" on:click={addMarker}>
                    {#if !$videoMarkers[showId]?.length}<T id="actions.add_time_marker" />{/if}
                </MaterialButton>
            {/if}
        </FloatingInputs>
    {/if}

    {#if playingInOutput}
        <MediaControls {currentOutput} {outputId} big />
    {:else}
        <FloatingInputs arrow={type === "video"} let:open>
            <div slot="menu" style="display: flex;min-width: 500px;">
                <MaterialButton
                    title={videoData.paused ? "media.play" : "media.pause"}
                    on:click={() => {
                        autoPause = false
                        videoData.paused = !videoData.paused
                    }}
                >
                    <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} />
                </MaterialButton>

                <VideoSlider {outputId} path={mediaPath} bind:videoData bind:videoTime />

                <MaterialButton title={videoData.muted ? "actions.unmute" : "actions.mute"} on:click={() => (videoData.muted = !videoData.muted)}>
                    <Icon id={videoData.muted ? "muted" : "volume"} white={videoData.muted} />
                </MaterialButton>

                <div class="divider"></div>
            </div>

            <MaterialButton
                isActive={manageSubtitles}
                title="actions.manage_subtitles"
                on:click={() => {
                    manageSubtitles = !manageSubtitles
                    if (timeMarkersEnabled) timeMarkersEnabled = false
                }}
            >
                <Icon id="captions" white={!tracks.length} size={1.2} />
            </MaterialButton>

            {#if open}
                <div class="divider"></div>
            {/if}

            <MaterialButton
                isActive={timeMarkersEnabled}
                title="actions.toggle_time_marker"
                on:click={() => {
                    timeMarkersEnabled = !timeMarkersEnabled
                    if (manageSubtitles) manageSubtitles = false
                }}
            >
                <Icon id="timeMarker" white={!$videoMarkers[showId]?.length} size={1.2} />
            </MaterialButton>
        </FloatingInputs>
    {/if}
{/if}

<style>
    .scroll {
        display: flex;
        overflow-x: auto;
    }
    .scroll :global(button) {
        overflow: initial;
    }
</style>
