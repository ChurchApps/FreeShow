<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import Button from "../../../common/components/Button.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { dictionary, outData, playingAudioData, playingAudioTime, playingVideoDuration, playingVideoLoop, playingVideoPaused, playingVideoTime } from "../../util/stores"
    import { joinTime, secondsToTime } from "../../../common/util/time"

    let timeIncrementer: ReturnType<typeof setInterval> | null = null

    $: background = $outData?.background
    $: backgroundType = background?.type
    $: backgroundPath = background?.path || background?.id || ""

    $: audioData = $playingAudioData || {}
    $: hasAudio = !!audioData?.id
    $: isVideo = backgroundType === "video" || backgroundType === "player"
    $: isMediaActive = isVideo || hasAudio

    // Local time tracking for smooth display (especially for player/YouTube videos)
    let localVideoTime = 0
    let lastServerTime = 0
    let timeJustUpdated = false

    // Sync from server, but avoid jitter for small differences
    $: {
        const serverTime = $playingVideoTime || 0
        // Only sync if server time changed significantly (more than 2 seconds difference)
        // This avoids jitter while allowing seeks to sync properly
        if (Math.abs(serverTime - lastServerTime) > 2 || localVideoTime === 0) {
            localVideoTime = serverTime
            lastServerTime = serverTime
            timeJustUpdated = true
            setTimeout(() => (timeJustUpdated = false), 900)
        }
    }

    $: videoDuration = $playingVideoDuration || (background as any)?.duration || 0
    $: audioTime = hasAudio ? $playingAudioTime || 0 : 0
    $: audioDuration = hasAudio ? audioData.duration || 0 : 0

    // Use local time for video, server time for audio
    $: currentTime = isVideo ? localVideoTime : audioTime
    $: totalDuration = isVideo ? videoDuration : audioDuration

    let lastKnownDuration = 0
    $: {
        const dur = totalDuration || 0
        if (dur > 0) lastKnownDuration = dur
        else if (isVideo && currentTime > 0) lastKnownDuration = Math.max(lastKnownDuration, currentTime)
        else if (hasAudio && audioDuration > 0) lastKnownDuration = Math.max(lastKnownDuration, audioDuration)
    }

    function baseName(path: string) {
        if (!path) return ""
        const cleaned = path.replace(/\\/g, "/")
        const parts = cleaned.split("/")
        return parts[parts.length - 1] || path
    }

    $: label = isVideo ? background?.name || baseName(backgroundPath) || "—" : audioData?.name || audioData?.id || baseName(backgroundPath) || "—"

    $: isPaused = isVideo ? $playingVideoPaused : hasAudio ? (audioData.paused ?? false) : false
    $: isLooping = $playingVideoLoop

    // Increment local time every second when playing (for player videos that don't report time)
    function startTimeIncrementer() {
        if (timeIncrementer) return
        timeIncrementer = setInterval(() => {
            if (isPaused || timeJustUpdated || !isVideo) return
            // Don't increment past duration
            if (totalDuration > 0 && localVideoTime >= totalDuration) return
            localVideoTime++
        }, 1000)
    }

    function stopTimeIncrementer() {
        if (timeIncrementer) clearInterval(timeIncrementer)
        timeIncrementer = null
    }

    // No automatic polling - state comes from OUT_DATA updates pushed by server
    // Only fetch on mount and user interactions

    let mounted = false

    onMount(() => {
        mounted = true
        if (isMediaActive) {
            startTimeIncrementer()
        }
    })

    // Start/stop time incrementer based on media state
    $: if (mounted && isMediaActive && !isPaused) {
        startTimeIncrementer()
    } else if (mounted) {
        stopTimeIncrementer()
    }

    // Reset local time when background changes
    let lastBackgroundPath = ""
    $: if (backgroundPath && backgroundPath !== lastBackgroundPath) {
        lastBackgroundPath = backgroundPath
        localVideoTime = 0
        lastServerTime = 0
    }

    onDestroy(() => {
        stopTimeIncrementer()
    })

    function togglePlayPause() {
        if (isVideo) {
            playingVideoPaused.set(!isPaused) // optimistic update
            send("API:toggle_playing_media")
        } else if (hasAudio) {
            if (audioData.paused) send("API:play_audio", { path: audioData.id })
            else send("API:pause_audio", { path: audioData.id })
        }
    }

    function toggleLoop() {
        if (isVideo) {
            playingVideoLoop.set(!isLooping) // optimistic update
            send("API:toggle_media_loop")
        }
    }

    function seekRelative(delta: number) {
        const target = Math.max(0, Math.min((currentTime || 0) + delta, Math.max(totalDuration || 0, 0)))
        seekTo(target)
    }

    function seekTo(value: number) {
        // Update local time immediately for responsive UI
        if (isVideo) {
            localVideoTime = value
            lastServerTime = value
            timeJustUpdated = true
            setTimeout(() => (timeJustUpdated = false), 900)
        }

        const payload = { seconds: value }
        if (isVideo) {
            send("API:video_seekto", payload)
        } else if (hasAudio) send("API:audio_seekto", payload)
    }

    $: playIcon = isPaused ? "play" : "pause"

    // display duration with fallback
    $: displayDuration = totalDuration > 0 ? totalDuration : lastKnownDuration
</script>

{#if isMediaActive}
    <div class="media-controls">
        <div class="title-row">
            <div class="title">
                <Icon id={isVideo ? "video" : "music"} size={1} />
                <span>{label}</span>
            </div>
            <div class="times">
                <span>{joinTime(secondsToTime(Math.floor(currentTime)))}</span>
                <span>{displayDuration ? joinTime(secondsToTime(Math.max(displayDuration - Math.floor(currentTime), 0))) : "--:--"}</span>
            </div>
        </div>

        <div class="slider-row">
            <input class="slider" type="range" min="0" max={Math.max(totalDuration || 1, 1)} step="1" value={currentTime} on:change={(e) => seekTo(Number(e.currentTarget.value))} />
        </div>

        <div class="controls-row">
            <Button class="icon-btn {isPaused ? 'play-btn' : 'pause-btn'}" on:click={togglePlayPause} title={translate(isPaused ? "actions.play" : "actions.pause", $dictionary)} compact>
                <Icon id={playIcon} size={1.1} white={isPaused} />
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
        flex-direction: row;
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
    }

    .times {
        display: flex;
        gap: 12px;
        font-variant-numeric: tabular-nums;
        opacity: 0.85;
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

    /* Play button: white icon */
    .controls-row :global(.play-btn) {
        color: white;
    }
    .controls-row :global(.play-btn svg) {
        fill: white;
    }

    /* Pause button: FreeShow color */
    .controls-row :global(.pause-btn) {
        color: var(--secondary);
    }
    .controls-row :global(.pause-btn svg) {
        fill: var(--secondary);
    }

    /* Seek buttons: white normally, FreeShow color on active/pressed */
    .controls-row :global(.seek-btn) {
        color: white;
    }
    .controls-row :global(.seek-btn svg) {
        fill: white;
    }
    .controls-row :global(.seek-btn:active) {
        color: var(--secondary);
    }
    .controls-row :global(.seek-btn:active svg) {
        fill: var(--secondary);
    }

    /* Loop button: white when off, secondary when on */
    .controls-row :global(.loop-btn) {
        color: white;
    }
    .controls-row :global(.loop-btn svg) {
        fill: white;
    }
    .controls-row :global(.loop-btn.loop-on) {
        color: var(--secondary);
    }
    .controls-row :global(.loop-btn.loop-on svg) {
        fill: var(--secondary);
    }
</style>
