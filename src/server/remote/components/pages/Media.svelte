<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { active, dictionary, mediaCache, outData, playingVideoDuration, playingVideoLoop, playingVideoMuted, playingVideoPaused, playingVideoTime } from "../../util/stores"
    import { joinTime, secondsToTime } from "../../../common/util/time"

    $: path = $active?.id
    $: mediaType = $active?.type
    $: thumbnailPath = $mediaCache[path]
    $: hasThumbnail = !!thumbnailPath

    // Is this a video type?
    $: isVideo = mediaType === "video" || mediaType === "player"

    // Check if this item is currently playing in output
    $: background = $outData?.background
    $: backgroundPath = background?.path || background?.id || ""
    $: isPlayingInOutput = path && backgroundPath === path

    // Video state (only relevant when playing in output)
    $: videoTime = $playingVideoTime || 0
    $: videoDuration = $playingVideoDuration || 0
    $: isPaused = $playingVideoPaused
    $: isLooping = $playingVideoLoop
    $: isMuted = $playingVideoMuted

    // Local settings (for when not yet outputting)
    let shouldLoop = false
    let shouldMute = false

    // Playback polling (keep remote UI responsive)
    const POLL_PLAYING = 500
    const POLL_PAUSED = 2000
    let pollInterval: ReturnType<typeof setInterval> | null = null
    let pollRate = POLL_PAUSED
    let mounted = false

    onMount(() => {
        mounted = true
        if (isVideo && isPlayingInOutput) startPolling()
    })

    onDestroy(() => stopPolling())

    function playInOutput() {
        send("API:play_media", { path, data: { type: mediaType, loop: shouldLoop, muted: shouldMute } })
        send("API:get_cleared")
    }

    function togglePlayPause() {
        send("API:toggle_playing_media")
        scheduleRefresh()
    }

    function toggleLoop() {
        if (isPlayingInOutput) {
            send("API:toggle_media_loop")
            scheduleRefresh()
        } else {
            shouldLoop = !shouldLoop
        }
    }

    function toggleMute() {
        if (isPlayingInOutput) {
            send("API:toggle_media_mute")
            scheduleRefresh()
        } else {
            shouldMute = !shouldMute
        }
    }

    function seekRelative(delta: number) {
        const target = Math.max(0, Math.min(videoTime + delta, videoDuration || 0))
        seekTo(target)
    }

    function seekTo(value: number) {
        send("API:video_seekto", { seconds: value })
        scheduleRefresh()
    }

    function fetchVideoState() {
        if (!isVideo || !isPlayingInOutput) return
        send("API:get_playing_video_state")
    }

    function startPolling() {
        if (pollInterval || !isVideo || !isPlayingInOutput) return
        fetchVideoState()
        pollInterval = setInterval(fetchVideoState, pollRate)
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval)
            pollInterval = null
        }
    }

    function restartPolling() {
        stopPolling()
        startPolling()
    }

    function scheduleRefresh() {
        if (!isVideo || !isPlayingInOutput) return
        setTimeout(fetchVideoState, 75)
        setTimeout(fetchVideoState, 300)
    }

    $: if (mounted) {
        if (isVideo && isPlayingInOutput) {
            const nextRate = isPaused ? POLL_PAUSED : POLL_PLAYING
            if (pollRate !== nextRate) {
                pollRate = nextRate
                restartPolling()
            } else if (!pollInterval) {
                startPolling()
            }
        } else {
            stopPolling()
        }
    }

    $: displayTime = isPlayingInOutput ? videoTime : 0
    $: displayDuration = isPlayingInOutput ? videoDuration : 0
</script>

<div class="media">
    {#if path}
        {#if isPlayingInOutput}
            {#if hasThumbnail}
                <img src={thumbnailPath} alt="Preview" draggable="false" />
            {:else}
                <div class="placeholder">
                    <Icon id={mediaType === "player" ? "player" : "video"} size={2.5} />
                    <p>{translate("remote.no_preview", $dictionary) || "No preview available"}</p>
                    <small style="opacity: 0.6; word-break: break-all;">{path}</small>
                </div>
            {/if}

            <!-- Full playback controls when playing in output -->
            <div class="floating-controls center">
                <div class="floating-bar">
                    <button class="float-btn play-pause" class:paused={isPaused} on:click={togglePlayPause} title={translate(isPaused ? "actions.play" : "actions.pause", $dictionary)}>
                        <Icon id={isPaused ? "play" : "pause"} size={1.5} white />
                    </button>

                    <div class="divider"></div>

                    <div class="time-section">
                        <span class="time">{joinTime(secondsToTime(Math.floor(displayTime)))}</span>
                        <input class="slider" type="range" min="0" max={Math.max(displayDuration || 1, 1)} step="1" value={displayTime} on:change={(e) => seekTo(Number(e.currentTarget.value))} />
                        <span class="time">{displayDuration > 0 ? joinTime(secondsToTime(Math.floor(displayDuration))) : "--:--"}</span>
                    </div>

                    <div class="divider"></div>

                    <button class="float-btn back-btn" on:click={() => seekRelative(-10)} title={translate("media.back10", $dictionary) || "Back 10s"}>
                        <Icon id="back_10" size={1.3} white />
                    </button>

                    <button class="float-btn forward-btn" on:click={() => seekRelative(10)} title={translate("media.forward10", $dictionary) || "Forward 10s"}>
                        <Icon id="forward_10" size={1.3} white />
                    </button>

                    <div class="divider"></div>

                    <button class="float-btn loop-btn" class:loop-on={isLooping} on:click={toggleLoop} title={translate("media._loop", $dictionary) || "Loop"}>
                        <Icon id="loop" size={1.3} white />
                    </button>

                    <button class="float-btn mute-btn" class:muted={!isMuted} on:click={toggleMute} title={translate(isMuted ? "actions.unmute" : "actions.mute", $dictionary) || "Mute"}>
                        <Icon id={isMuted ? "muted" : "volume"} size={1.3} white />
                    </button>
                </div>
            </div>
        {:else}
            <!-- Entire preview becomes the play button when not playing -->
            <button class="media-click" on:click={playInOutput}>
                {#if hasThumbnail}
                    <img src={thumbnailPath} alt="Preview" draggable="false" />
                {:else}
                    <div class="placeholder">
                        <Icon id={mediaType === "player" ? "player" : "video"} size={2.5} />
                        <p>{translate("remote.no_preview", $dictionary) || "No preview available"}</p>
                        <small style="opacity: 0.6; word-break: break-all;">{path}</small>
                    </div>
                {/if}
                <div class="play-icon">
                    <Icon id="play" style="opacity: 0.8;" size={8} white />
                </div>
            </button>

            <!-- Loop and mute options on the left (when not playing) -->
            {#if isVideo}
                <div class="floating-controls left">
                    <div class="floating-bar">
                        <button class="float-btn loop-btn" class:loop-on={shouldLoop} on:click={toggleLoop} title={translate("media._loop", $dictionary) || "Loop"}>
                            <Icon id="loop" size={1.2} white />
                        </button>

                        <button class="float-btn mute-btn" class:muted={!shouldMute} on:click={toggleMute} title={translate(shouldMute ? "actions.unmute" : "actions.mute", $dictionary) || "Mute"}>
                            <Icon id={shouldMute ? "muted" : "volume"} size={1.2} white />
                        </button>
                    </div>
                </div>
            {/if}
        {/if}
    {/if}
</div>

<style>
    .media {
        background-color: var(--primary-darker);
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        overflow: hidden;
    }

    img {
        object-fit: contain;
        width: 100%;
        height: 100%;
        flex: 1;
    }

    .placeholder {
        width: 100%;
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        color: var(--text);
        text-align: center;
        padding: 16px;
        box-sizing: border-box;
        opacity: 0.8;
    }

    .media-click {
        position: relative;
        border: none;
        padding: 0;
        margin: 0;
        background: none;
        width: 100%;
        height: 100%;
        display: flex;
        cursor: pointer;
    }

    .media-click:focus-visible {
        outline: 2px solid var(--secondary);
        outline-offset: -2px;
    }

    .play-icon {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 5;
        color: white;
    }

    /* Floating controls - similar to main app */
    .floating-controls {
        position: absolute;
        bottom: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        z-index: 10;
    }

    .floating-controls.center {
        left: 50%;
        transform: translateX(-50%);
        width: 90%;
        max-width: 600px;
    }

    .floating-controls.left {
        left: 12px;
    }

    .floating-bar {
        display: flex;
        align-items: center;
        background-color: rgba(25, 25, 35, 0.85);
        backdrop-filter: blur(3px);
        border: 1px solid var(--primary-lighter);
        box-shadow: 1px 1px 6px rgb(0 0 0 / 0.4);
        border-radius: 40px;
        height: 44px;
        overflow: hidden;
    }

    .float-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0 14px;
        height: 100%;
        transition: background-color 0.15s;
    }

    /* Default all control icons to white */
    .float-btn :global(svg) {
        fill: white;
    }

    .float-btn:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }

    .float-btn:active {
        background-color: rgba(255, 255, 255, 0.15);
    }

    .float-btn.play-pause {
        padding: 0 18px;
    }

    /* Play/Pause: white when paused (play icon), secondary when playing (pause icon) */
    .float-btn.play-pause:not(.paused) :global(svg) {
        fill: var(--secondary);
    }

    .divider {
        width: 1px;
        height: 100%;
        background-color: var(--primary-lighter);
    }

    .time-section {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 10px;
        flex: 1;
        min-width: 0;
    }

    .time {
        font-size: 0.75em;
        font-variant-numeric: tabular-nums;
        color: white;
        opacity: 0.9;
        min-width: 38px;
        text-align: center;
    }

    .slider {
        flex: 1;
        min-width: 60px;
        accent-color: var(--secondary);
        height: 4px;
        cursor: pointer;
    }

    /* Loop button: white when off, secondary color when on */
    .float-btn.loop-btn.loop-on :global(svg) {
        fill: var(--secondary);
    }

    /* Mute button: white when muted, secondary color when unmuted (has sound) */
    .float-btn.mute-btn.muted :global(svg) {
        fill: var(--secondary);
    }

    @media (max-width: 768px) {
        .floating-controls {
            position: static;
            width: 100%;
            left: auto;
            transform: none;
            bottom: auto;
            align-items: stretch;
            padding: 0;
            margin-top: auto;
            box-sizing: border-box;
        }

        .floating-controls.center {
            width: 100%;
            max-width: none;
            left: auto;
            transform: none;
        }

        .floating-bar {
            width: 100%;
            box-shadow: none;
            border-radius: 12px 12px 0 0;
            border-left: none;
            border-right: none;
        }
    }

    /* Mobile: two-row layout, time/seek on top, controls below */
    @media (max-width: 768px) {
        .floating-bar {
            display: grid;
            grid-template-columns: repeat(5, minmax(44px, 1fr));
            grid-template-areas:
                "time time time time time"
                "play back forward loop mute";
            row-gap: 8px;
            column-gap: 8px;
            height: auto;
            padding: 10px 12px;
        }

        .divider {
            display: none;
        }

        .time-section {
            grid-area: time;
            width: 100%;
            padding: 0 4px;
            gap: 12px;
        }

        .float-btn {
            height: 36px;
            padding: 6px 10px;
            justify-self: center;
        }

        .float-btn.play-pause {
            grid-area: play;
            padding: 6px 12px;
        }

        .float-btn.back-btn {
            grid-area: back;
        }

        .float-btn.forward-btn {
            grid-area: forward;
        }

        .float-btn.loop-btn {
            grid-area: loop;
        }

        .float-btn.mute-btn {
            grid-area: mute;
        }

        .slider {
            min-width: 0;
        }
    }
</style>
