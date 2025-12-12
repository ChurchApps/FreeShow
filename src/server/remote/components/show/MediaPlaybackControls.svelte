<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import Button from "../../../common/components/Button.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { dictionary, outData, playingAudioData, playingAudioTime, playingVideoDuration, playingVideoLoop, playingVideoPaused, playingVideoTime } from "../../util/stores"
    import { joinTime, secondsToTime } from "../../../common/util/time"

    // === State from stores ===
    $: background = $outData?.background
    $: backgroundType = background?.type
    $: backgroundPath = background?.path || background?.id || ""
    $: isVideo = backgroundType === "video" || backgroundType === "player"

    $: audioData = $playingAudioData || {}
    $: hasAudio = !!audioData?.id
    $: isMediaActive = isVideo || hasAudio

    // Video state from stores
    $: videoTime = $playingVideoTime || 0
    $: videoDuration = $playingVideoDuration || 0
    $: videoPaused = $playingVideoPaused
    $: videoLoop = $playingVideoLoop

    // Audio state
    $: audioTime = hasAudio ? $playingAudioTime || 0 : 0
    $: audioDuration = hasAudio ? audioData.duration || 0 : 0
    $: audioPaused = hasAudio ? (audioData.paused ?? false) : false

    // Combined state
    $: currentTime = isVideo ? videoTime : audioTime
    $: totalDuration = isVideo ? videoDuration : audioDuration
    $: isPaused = isVideo ? videoPaused : audioPaused
    $: isLooping = isVideo ? videoLoop : false

    // === Adaptive Polling ===
    // Fast (500ms) when playing, slow (3s) when paused
    const POLL_FAST = 500
    const POLL_SLOW = 3000

    let pollInterval: ReturnType<typeof setInterval> | null = null
    let currentPollRate = POLL_SLOW
    let mounted = false

    onMount(() => {
        mounted = true
        if (isMediaActive) {
            fetchState()
            startPolling()
        }
    })

    // Adjust poll rate based on playback state
    $: if (mounted && isMediaActive) {
        const newRate = isPaused ? POLL_SLOW : POLL_FAST
        if (newRate !== currentPollRate) {
            currentPollRate = newRate
            restartPolling()
        } else if (!pollInterval) {
            startPolling()
        }
    } else if (mounted && !isMediaActive) {
        stopPolling()
    }

    function startPolling() {
        if (pollInterval) return
        pollInterval = setInterval(fetchState, currentPollRate)
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

    function fetchState() {
        if (isVideo) send("API:get_playing_video_state")
        if (hasAudio) send("API:get_playing_audio_data")
    }

    onDestroy(() => {
        stopPolling()
    })

    // === Label ===
    $: label = isVideo ? background?.name || getFileName(backgroundPath) || "—" : audioData?.name || audioData?.id || "—"

    function getFileName(path: string): string {
        if (!path) return ""
        return path.replace(/\\/g, "/").split("/").pop() || path
    }

    // === Actions (with immediate state fetch) ===
    function togglePlayPause() {
        if (isVideo) {
            send("API:toggle_playing_media")
        } else if (hasAudio) {
            if (audioPaused) send("API:play_audio", { path: audioData.id })
            else send("API:pause_audio", { path: audioData.id })
        }
        // Fetch state quickly after action
        setTimeout(fetchState, 50)
        setTimeout(fetchState, 200)
    }

    function toggleLoop() {
        if (isVideo) {
            send("API:toggle_media_loop")
            setTimeout(fetchState, 50)
        }
    }

    function seekTo(seconds: number) {
        if (isVideo) send("API:video_seekto", { seconds })
        else if (hasAudio) send("API:audio_seekto", { seconds })
        setTimeout(fetchState, 50)
    }

    function seekRelative(delta: number) {
        seekTo(Math.max(0, Math.min(currentTime + delta, totalDuration || 0)))
    }

    // === Display ===
    $: timeDisplay = joinTime(secondsToTime(Math.floor(currentTime)))
    $: remainingDisplay = totalDuration > 0 ? joinTime(secondsToTime(Math.max(Math.floor(totalDuration - currentTime), 0))) : "--:--"
</script>

{#if isMediaActive}
    <div class="media-controls">
        <div class="title-row">
            <div class="title">
                <Icon id={isVideo ? "video" : "music"} size={1} />
                <span>{label}</span>
            </div>
            <div class="times">
                <span>{timeDisplay}</span>
                <span>{remainingDisplay}</span>
            </div>
        </div>

        <div class="slider-row">
            <input class="slider" type="range" min="0" max={Math.max(totalDuration || 1, 1)} step="1" value={currentTime} on:change={(e) => seekTo(Number(e.currentTarget.value))} />
        </div>

        <div class="controls-row">
            <Button class="icon-btn {isPaused ? 'play-btn' : 'pause-btn'}" on:click={togglePlayPause} title={translate(isPaused ? "actions.play" : "actions.pause", $dictionary)} compact>
                <Icon id={isPaused ? "play" : "pause"} size={1.1} white={isPaused} />
            </Button>

            <Button class="icon-btn seek-btn" on:click={() => seekRelative(-10)} title={translate("media.back10", $dictionary) || "Back 10s"} compact>
                <Icon id="back_10" size={1.1} white />
            </Button>

            <Button class="icon-btn seek-btn" on:click={() => seekRelative(10)} title={translate("media.forward10", $dictionary) || "Forward 10s"} compact>
                <Icon id="forward_10" size={1.1} white />
            </Button>

            {#if isVideo}
                <Button class="icon-btn loop-btn {isLooping ? 'loop-on' : ''}" on:click={toggleLoop} title={translate("media._loop", $dictionary) || "Loop"} compact>
                    <Icon id="loop" size={1.1} white={!isLooping} />
                </Button>
            {/if}
        </div>
    </div>
{/if}

<style>
    .media-controls {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 10px 12px;
        background: var(--primary-darker);
        border-radius: 10px;
    }

    .title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
    }

    .title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        opacity: 0.9;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
        flex: 1;
    }

    .title span {
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .times {
        display: flex;
        gap: 12px;
        font-variant-numeric: tabular-nums;
        opacity: 0.85;
        flex-shrink: 0;
    }

    .slider-row {
        width: 100%;
    }

    .slider {
        width: 100%;
        accent-color: var(--secondary);
    }

    .controls-row {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    .controls-row :global(button) {
        min-width: 40px;
        padding: 8px;
    }

    .controls-row :global(.play-btn svg) {
        fill: white;
    }

    .controls-row :global(.pause-btn svg) {
        fill: var(--secondary);
    }

    .controls-row :global(.seek-btn svg) {
        fill: white;
    }
    .controls-row :global(.seek-btn:active svg) {
        fill: var(--secondary);
    }

    .controls-row :global(.loop-btn svg) {
        fill: white;
    }
    .controls-row :global(.loop-btn.loop-on svg) {
        fill: var(--secondary);
    }
</style>
