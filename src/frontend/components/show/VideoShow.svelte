<script lang="ts">
    import { activeProject, dictionary, outLocked, outputs, playingVideos, projects, videoMarkers, volume } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { analyseAudio, getAnalyser } from "../helpers/audio"
    import { getActiveOutputs, setOutput } from "../helpers/output"
    import { joinTime, secondsToTime } from "../helpers/time"
    import Button from "../inputs/Button.svelte"
    import HiddenInput from "../inputs/HiddenInput.svelte"
    import HoverButton from "../inputs/HoverButton.svelte"
    import VideoSlider from "../output/VideoSlider.svelte"
    import Player from "../system/Player.svelte"

    export let show

    export let filter
    export let flipped
    export let fit
    export let speed

    let videoTime: number = 0
    let videoData = {
        paused: false,
        muted: true,
        duration: 0,
        loop: false,
    }
    $: if (!videoData) videoData = { paused: false, muted: true, duration: 0, loop: false }

    let prevId: string | undefined = undefined
    $: if (show?.id !== prevId) {
        videoTime = 0
        autoPause = true
        prevId = show?.id

        timeMarkersEnabled = !!$videoMarkers[show.id]?.length || false
    }

    $: currentOutput = $outputs[getActiveOutputs()[0]]

    // outBackground.subscribe(backgroundChanged)
    $: background = currentOutput?.out?.background || {}
    $: if (JSON.stringify(background) !== JSON.stringify(currentOutput?.out?.background || {})) backgroundChanged()
    function backgroundChanged() {
        background = currentOutput?.out?.background || {}
        if (background === null || background.path !== show?.id || videoData.paused) return
        if (background.type !== undefined || background.type !== "media") return
        autoPause = true
        videoData.paused = true
    }

    $: if (background.path === show?.id && autoPause) videoData.paused = true

    let autoPause: boolean = true
    let hasLoaded: boolean = false

    let previewControls: boolean = false
    let timeMarkersEnabled: boolean = false

    function onLoad() {
        hasLoaded = true
        if (autoPause) videoData.paused = false
        else videoTime = 0
    }

    let video: any
    async function onPlay() {
        // autoPause = false
        if (hasLoaded) {
            videoTime = 0
            hasLoaded = false

            let analyser = await getAnalyser(video)
            if (!analyser) return

            playingVideos.update((a) => {
                a.push({ id: show!.id, location: "preview", analyser })
                return a
            })
            analyseAudio()
        }
    }
    $: if (videoData) {
        playingVideos.update((a) => {
            let existing = a.findIndex((a) => a.id === show?.id && a.location === "preview")
            if (existing > -1) {
                a[existing].paused = videoData.muted ? true : videoData.paused
                if (!a[existing].paused) analyseAudio()
            }
            return a
        })
    }

    function keydown(e: any) {
        if (e.target.closest("input") || e.target.closest(".edit")) return

        let output = $outputs[getActiveOutputs()[0]] || {}
        let outputPath = output.out?.background?.path

        if (e.key === " " && show && (!outputPath || outputPath !== show.id)) {
            e.preventDefault()
            if ((show!.type === "video" && outputPath !== show.id) || (show!.type === "player" && output.out?.background?.id !== show.id)) playVideo()
            else if (show!.type === "image" && !$outLocked) setOutput("background", { path: show?.id, filter })
            // TODO: this will play first slide
            // else if (show.type === "section") goToNextProjectItem()
        }
    }

    function playVideo(startAt: number = 0) {
        if ($outLocked) return

        let bg: any = { type: show!.type, startAt, loop: false, filter, flipped, fit, speed }

        if (show!.type === "player") bg.id = show!.id
        else {
            bg.path = show!.id
            // if (filter) data.filter = filter
        }

        // autoPause = true
        // videoData.paused = true

        // TODO: playing in multiple outputs will create unclearable "ghost" video

        if ($activeProject && $projects[$activeProject].shows.find((a) => a.id === bg.path)) setOutput("slide", null)
        setOutput("background", bg)
    }

    $: if (video && speed) video.playbackRate = speed

    // MARKER

    // TODO: history
    function addMarker() {
        videoMarkers.update((a) => {
            const newMarker = { name: "", time: Math.floor(videoTime || 0) }

            if (a[show.id]?.find((a) => a.time === newMarker.time)) return a

            if (!a[show.id]) a[show.id] = []
            a[show.id].push(newMarker)

            // sort by time
            a[show.id] = a[show.id].sort((a, b) => a.time - b.time)

            return a
        })
    }

    let edit: boolean = false

    function changeName(e: any) {
        let currentMarker = e.detail?.id?.slice("marker_".length)
        if (currentMarker === undefined) return

        videoMarkers.update((a) => {
            a[show.id][currentMarker].name = e.detail.value

            return a
        })
        // history({ id: "UPDATE", newData: { key: "layouts", keys: [currentLayout], subkey: "name", data: e.detail.value }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
    }

    let pausedByEdit: boolean = false
    $: if (edit) {
        if (!videoData.paused) {
            videoData.paused = true
            pausedByEdit = true
        }
    } else if (pausedByEdit) {
        videoData.paused = false
        pausedByEdit = false
    }
</script>

<svelte:window on:keydown={keydown} />

{#key show.id}
    <div class="media context #media_preview" style="flex: 1;overflow: hidden;">
        <!-- TODO: info about: CTRL click to play at current pos -->
        <HoverButton icon="play" size={10} on:click={(e) => playVideo(e.ctrlKey || e.metaKey ? videoTime : 0)} title={$dictionary.media?.play}>
            {#if show.type === "player"}
                <Player id={show.id} bind:videoData bind:videoTime preview />
            {:else}
                <!-- TODO: on:error={videoError} - ERR_FILE_NOT_FOUND -->
                <video
                    style="width: 100%;height: 100%;filter: {filter};{flipped ? 'transform: scaleX(-1);' : ''}"
                    src={show.id}
                    on:loadedmetadata={onLoad}
                    on:playing={onPlay}
                    bind:this={video}
                    bind:currentTime={videoTime}
                    bind:paused={videoData.paused}
                    bind:duration={videoData.duration}
                    bind:muted={videoData.muted}
                    bind:volume={$volume}
                >
                    <track kind="captions" />
                </video>
            {/if}
        </HoverButton>
    </div>
    {#if timeMarkersEnabled}
        <div class="buttons" style="display: flex;">
            <div class="markers">
                {#if $videoMarkers[show.id]?.length}
                    {#each $videoMarkers[show.id] as marker, i}
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
                            dark
                        >
                            <p style="display: flex;align-items: center;">
                                <HiddenInput value={marker.name} id={"marker_" + i} on:edit={changeName} bind:edit />
                                <span style="opacity: 0.7;">{joinTime(secondsToTime(marker.time))}</span>
                            </p>
                        </Button>
                    {/each}
                {:else}
                    <p style="opacity: 0.7;text-align: center;width: 100%;"><T id="empty.general" /></p>
                {/if}
            </div>

            {#if previewControls}
                <Button on:click={addMarker}>
                    <Icon id="add" right />
                    <p><T id="actions.add_time_marker" /></p>
                </Button>
            {/if}
        </div>
    {/if}
    {#if previewControls}
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
            <Button style="flex: 0;" title={$dictionary.actions?.toggle_time_marker} on:click={() => (timeMarkersEnabled = !timeMarkersEnabled)} center>
                <Icon id="timeMarker" white={!timeMarkersEnabled} size={1.2} />
            </Button>
        </div>
    {:else}
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
