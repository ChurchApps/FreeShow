<script lang="ts">
    import { uid } from "uid"
    import { Main } from "../../../types/IPC/Main"
    import type { MediaStyle } from "../../../types/Main"
    import { requestMain, sendMain } from "../../IPC/main"
    import { activeProject, activeRename, dictionary, focusMode, media, outLocked, outputs, playingVideos, projects, videoMarkers, videosData, videosTime, volume } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { enableSubtitle, encodeFilePath, getExtension, getFileName, removeExtension } from "../helpers/media"
    import { getActiveOutputs, setOutput } from "../helpers/output"
    import { joinTime, secondsToTime } from "../helpers/time"
    import Button from "../inputs/Button.svelte"
    import HiddenInput from "../inputs/HiddenInput.svelte"
    import HoverButton from "../inputs/HoverButton.svelte"
    import MediaPicker from "../inputs/MediaPicker.svelte"
    import VideoSlider from "../output/VideoSlider.svelte"
    import { clearSlide } from "../output/clear"
    import MediaControls from "../output/tools/MediaControls.svelte"
    import Player from "../system/Player.svelte"
    import { formatVTT, SRTtoVTT } from "./media/subtitles"

    export let show

    $: showId = show?.id
    $: type = show?.type

    // show updates when videoTime updates for some reason?
    // $: console.trace(show)
    // $: console.trace(videoTime)

    $: tracks = $media[showId]?.tracks || []
    $: subtitle = $media[showId]?.subtitle || ""
    $: if (type !== "player" && showId && $media[showId]?.tracks === undefined) sendMain(Main.MEDIA_TRACKS, { path: showId })

    export let mediaStyle: MediaStyle = {}

    let videoTime = 0
    let videoData = {
        paused: false,
        muted: true,
        duration: 0,
        loop: false
    }
    $: if (!videoData) videoData = { paused: false, muted: true, duration: 0, loop: false }
    $: if (playingInOutput && $videosData[outputId]) setVideoData()
    $: if (playingInOutput && $videosData[outputId]?.paused && !videoData.paused) setPaused()
    function setPaused() {
        videoData.paused = true
        // trigger time update
        videoTime = 0
    }
    function setVideoData() {
        videoData = { ...$videosData[outputId], muted: true }
    }

    let prevId: string | undefined = undefined
    $: if (showId !== prevId) {
        videoTime = 0
        autoPause = true
        prevId = showId

        timeMarkersEnabled = !!$videoMarkers[showId]?.length || false
    }

    $: outputId = getActiveOutputs($outputs, false, true, true)[0]
    $: currentOutput = $outputs[outputId]

    // outBackground.subscribe(backgroundChanged)
    $: background = currentOutput?.out?.background || {}
    $: if (background || showId) backgroundChanged()
    let playingInOutput = false
    function backgroundChanged() {
        // background = currentOutput?.out?.background || {}
        // || videoData.paused
        if (background === null || (background.path || background.id) !== showId) {
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
    $: if (playingInOutput && Math.abs(videoTime - $videosTime[outputId]) > 1) updateVideoTime()
    function updateVideoTime() {
        // get and set actual time
        videoTime = $videosTime[outputId]
    }

    // WIP toggle between output/preview video...
    // WIP player video output time

    // $: if (background.path === showId && autoPause) videoData.paused = true

    let autoPause = true
    let hasLoaded = false

    let previewControls = false
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
        // autoPause = false
        if (hasLoaded) {
            if (!playingInOutput) videoTime = 0
            hasLoaded = false

            // let analyser = await getAnalyser(video)
            // if (!analyser) return

            playingVideos.update((a) => {
                a.push({ id: showId, location: "preview" })
                return a
            })

            // WIP analyser
            // analyseAudio()
        }
    }
    // $: if (videoData) {
    //     playingVideos.update((a) => {
    //         let existing = a.findIndex((a) => a.id === showId && a.location === "preview")
    //         if (existing > -1) {
    //             a[existing].paused = videoData.muted ? true : videoData.paused
    //             if (!a[existing].paused) analyseAudio()
    //         }
    //         return a
    //     })
    // }

    function playVideo(startAt = 0) {
        if ($outLocked) return

        let videoType = mediaStyle.videoType || ""
        let loop = videoType === "background" ? true : false
        let muted = videoType === "background" ? true : false
        if (videoType === "foreground") clearSlide()
        let bg: any = { type, startAt, muted, loop, ...mediaStyle, ignoreLayer: videoType === "foreground" }

        if (type === "player") bg.id = showId
        else {
            bg.path = showId
            // if (filter) data.filter = filter
        }

        // autoPause = true
        // videoData.paused = true

        // TODO: playing in multiple outputs will create unclearable "ghost" video

        if ($activeProject && $projects[$activeProject].shows.find((a) => a.id === bg.path)) setOutput("slide", null)
        setOutput("background", bg)
    }

    $: if (video && mediaStyle.speed) video.playbackRate = Number(mediaStyle.speed)

    let edit = false

    // SUBTITLE

    function changeSubtitleName(e: any) {
        let subtitleIndex = e.detail?.id?.slice("subtitle_".length)
        let value = e.detail.value
        if (subtitleIndex === undefined || !value) return

        media.update((a) => {
            if (!a[showId]?.tracks?.[subtitleIndex]) return a
            a[showId].tracks[subtitleIndex].name = value
            if (a[showId].tracks[subtitleIndex].lang.length !== 2) a[showId].tracks[subtitleIndex].lang = value.replaceAll(" ", "_").toLowerCase()

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
            if (!a[showId]) a[showId] = {}
            if (!a[showId].tracks) a[showId].tracks = []

            let name = removeExtension(getFileName(path)).replaceAll(" ", "_")
            let id = name || uid(5)
            a[showId].tracks.push({ lang: id, name: "", vtt: content })

            activeRename.set("subtitle_" + (a[showId].tracks.length - 1))

            return a
        })
    }

    function setActiveSubtitle(e: any, lang: string) {
        if (e.target?.closest(".edit")) return

        media.update((a) => {
            if (!a[showId]) a[showId] = {}
            if (a[showId].subtitle === lang) {
                a[showId].subtitle = ""
                lang = ""
            } else a[showId].subtitle = lang

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
    $: mediaStyleBlurString = `position: absolute;filter: ${mediaStyle.filter || ""} blur(6px) opacity(0.3);object-fit: cover;width: 100%;height: 100%;transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`

    let blurVideo: HTMLVideoElement | undefined
    $: if (blurVideo && (videoTime < blurVideo.currentTime - 0.3 || videoTime > blurVideo.currentTime + 0.3)) blurVideo.currentTime = videoTime
    $: if (!videoData.paused && blurVideo?.paused) blurVideo.play()
    $: blurPausedState = videoData.paused
</script>

{#key showId}
    <div class="media context #media_preview" style="flex: 1;overflow: hidden;">
        <!-- TODO: info about: CTRL click to play at current pos -->
        <HoverButton icon="play" size={10} on:click={(e) => playVideo(e.ctrlKey || e.metaKey ? videoTime : 0)} title={$dictionary.media?.play}>
            {#if type === "player"}
                <Player id={showId} bind:videoData bind:videoTime preview />
            {:else}
                <!-- TODO: on:error={videoError} - ERR_FILE_NOT_FOUND -->
                {#if mediaStyle.fit === "blur"}
                    <video style={mediaStyleBlurString} src={encodeFilePath(showId)} bind:this={blurVideo} bind:paused={blurPausedState} loop={videoData.loop} muted />
                {/if}
                <video
                    style={mediaStyleString}
                    src={encodeFilePath(showId)}
                    on:loadedmetadata={onLoad}
                    on:playing={onPlay}
                    bind:this={video}
                    bind:currentTime={videoTime}
                    bind:paused={videoData.paused}
                    bind:duration={videoData.duration}
                    bind:muted={videoData.muted}
                    bind:volume={$volume}
                    loop={videoData.loop}
                >
                    <track kind="captions" src="" label="No captions available" />
                    {#each tracks as track}
                        <track label={track.name} srclang={track.lang} kind="subtitles" src="data:text/vtt;charset=utf-8,{encodeURI(track.vtt)}" />
                    {/each}
                </video>
            {/if}
        </HoverButton>
    </div>

    {#if playingInOutput ? tracks.length : manageSubtitles}
        <div class="buttons" style="display: flex;">
            <div class="markers">
                {#if tracks.length}
                    {#each tracks as track, i}
                        <Button on:click={(e) => setActiveSubtitle(e, track.lang)} outline={subtitle === track.lang} class="context #video_subtitle{track.embedded ? '_embedded' : ''}" id={i.toString()} bold={false} center>
                            {#if playingInOutput}
                                <p style="padding: 5px;">{track.name}</p>
                            {:else}
                                <HiddenInput value={track.name} id={"subtitle_" + i} on:edit={changeSubtitleName} bind:edit />
                            {/if}
                        </Button>
                    {/each}
                {:else}
                    <p style="opacity: 0.5;text-align: center;width: 100%;"><T id="empty.general" /></p>
                {/if}
            </div>

            {#if !playingInOutput}
                <div class="seperator" />

                <MediaPicker id="subtitles" filter={{ name: "Video Text Track", extensions: ["vtt", "srt"] }} on:picked={subtitlePicked} dark={false}>
                    <Icon id="add" right />
                    <T id="scripture.local" />
                </MediaPicker>
            {/if}
        </div>
    {/if}

    {#if playingInOutput ? $videoMarkers[showId]?.length : timeMarkersEnabled}
        <div class="buttons" style="display: flex;">
            <div class="markers">
                {#if $videoMarkers[showId]?.length}
                    {#each $videoMarkers[showId] as marker, i}
                        <Button
                            class="context #video_marker"
                            id={i}
                            on:click={() => {
                                if (!edit) {
                                    playVideo(marker.time || 0)
                                }
                            }}
                            bold={false}
                            center
                        >
                            <p style="display: flex;align-items: center;">
                                <HiddenInput value={marker.name} id={"marker_" + i} on:edit={changeName} bind:edit />
                                <span style="opacity: 0.7;">{joinTime(secondsToTime(marker.time))}</span>
                            </p>
                        </Button>
                    {/each}
                {:else}
                    <p style="opacity: 0.5;text-align: center;width: 100%;"><T id="empty.general" /></p>
                {/if}
            </div>

            {#if previewControls && !playingInOutput}
                <div class="seperator" />

                <Button on:click={addMarker}>
                    <Icon id="add" right />
                    <p><T id="actions.add_time_marker" /></p>
                </Button>
            {/if}
        </div>
    {/if}

    {#if playingInOutput}
        <MediaControls {currentOutput} {outputId} big />
    {:else if previewControls}
        <div class="buttons" style="display: flex;">
            <Button
                style="flex: 0;"
                center
                title={videoData.paused ? $dictionary.media?.play : $dictionary.media?.pause}
                on:click={() => {
                    autoPause = false
                    videoData.paused = !videoData.paused
                }}
            >
                <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} size={1.2} />
            </Button>
            <VideoSlider bind:videoData bind:videoTime />
            <Button style="flex: 0;" center title={videoData.muted ? $dictionary.actions?.unmute : $dictionary.actions?.mute} on:click={() => (videoData.muted = !videoData.muted)}>
                <Icon id={videoData.muted ? "muted" : "volume"} white={videoData.muted} size={1.2} />
            </Button>

            <div class="seperator" />

            <Button
                style="flex: 0;"
                title={$dictionary.actions?.manage_subtitles}
                on:click={() => {
                    manageSubtitles = !manageSubtitles
                    if (timeMarkersEnabled) timeMarkersEnabled = false
                }}
                center
            >
                <Icon id="captions" white={!manageSubtitles} size={1.2} />
            </Button>

            <Button
                style="flex: 0;"
                title={$dictionary.actions?.toggle_time_marker}
                on:click={() => {
                    timeMarkersEnabled = !timeMarkersEnabled
                    if (manageSubtitles) manageSubtitles = false
                }}
                center
            >
                <Icon id="timeMarker" white={!timeMarkersEnabled} size={1.2} />
            </Button>
        </div>
    {:else if !$focusMode && !playingInOutput}
        <Button on:click={() => (previewControls = true)} style="background-color: var(--primary-darkest);" center dark>
            <Icon id="eye" right />
            <T id="preview.enable_controls" />
        </Button>
    {/if}
{/key}

<style>
    .buttons {
        background-color: var(--primary-darkest);
    }

    .buttons :global(.slider input) {
        background-color: var(--primary);
    }

    .seperator {
        width: 1px;
        height: 100%;
        background-color: var(--primary);
    }

    .markers {
        flex: 1;
        /* padding: 0 10px; */
        display: flex;
        justify-content: space-between;
        align-items: center;
        overflow-x: auto;
    }

    .markers :global(button) {
        flex: 1;
    }
</style>
