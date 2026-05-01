<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { destroySpotifyManager, fadePause, initSpotifyManager, seekTo, skipNext, skipPrev, spotifyIsFading, spotifyState, togglePlay } from "./SpotifyManager"

    onMount(() => {
        initSpotifyManager()
    })

    onDestroy(() => {
        destroySpotifyManager()
    })

    let isDragging = false
    let dragPercentage = 0
    let barEl: HTMLDivElement

    function getBarPercentageFromEvent(e: PointerEvent) {
        const rect = barEl.getBoundingClientRect()
        return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    }

    function handleBarPointerDown(e: PointerEvent) {
        if ($spotifyIsFading) return
        isDragging = true
        dragPercentage = getBarPercentageFromEvent(e)
        window.addEventListener("pointermove", handleBarPointerMove)
        window.addEventListener("pointerup", handleBarPointerUp)
    }

    function handleBarPointerMove(e: PointerEvent) {
        if (!isDragging) return
        dragPercentage = getBarPercentageFromEvent(e)
    }

    function handleBarPointerUp() {
        if (!isDragging) return
        isDragging = false
        window.removeEventListener("pointermove", handleBarPointerMove)
        window.removeEventListener("pointerup", handleBarPointerUp)
        if ($spotifyState) seekTo(dragPercentage * $spotifyState.durationSec)
    }

    function handleSeek(e: MouseEvent) {
        if ($spotifyIsFading) return
        const rect = barEl.getBoundingClientRect()
        const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        if ($spotifyState) seekTo(percentage * $spotifyState.durationSec)
    }

    function formatTime(seconds: number) {
        if (!seconds || isNaN(seconds)) return "0:00"
        const m = Math.floor(seconds / 60)
        const s = Math.floor(seconds % 60)
        return `${m}:${s < 10 ? "0" : ""}${s}`
    }
</script>

{#if $spotifyState}
    <div class="spotify-controller" class:fading={$spotifyIsFading} style="--dynamic-bg: {$spotifyState.bgColor || 'transparent'}">
        <div class="header">
            {#if $spotifyState.albumArt}
                <img class="album-art" src={$spotifyState.albumArt} alt="Album Art" draggable="false" />
            {:else}
                <Icon id="spotify" color="#1db954" size={1.2} box={50} white />
            {/if}
            <div class="info">
                <div class="title">{$spotifyState.title || "Unknown Title"}</div>
                <div class="artist">{$spotifyState.artist || "Unknown Artist"}</div>
            </div>
        </div>

        <div class="controls">
            <MaterialButton on:click={skipPrev} title="media.previous" disabled={$spotifyIsFading}>
                <Icon id="previousFull" white />
            </MaterialButton>
            <MaterialButton on:click={togglePlay} title={$spotifyState.isPlaying ? "media.pause" : "media.play"} class="play-btn" disabled={$spotifyIsFading}>
                <Icon id={$spotifyState.isPlaying ? "pause" : "play"} white />
            </MaterialButton>
            <MaterialButton on:click={skipNext} title="media.next" disabled={$spotifyIsFading}>
                <Icon id="nextFull" white />
            </MaterialButton>
        </div>

        <div class="progress" class:disabled={$spotifyIsFading}>
            <span class="time">{formatTime(isDragging && $spotifyState ? dragPercentage * $spotifyState.durationSec : $spotifyState.positionSec)}</span>
            <div class="bar" bind:this={barEl} on:pointerdown={handleBarPointerDown} on:click={handleSeek} style="touch-action: none;">
                <!-- transition: {isDragging ? 'none' : 'width 0.1s linear'}; -->
                <div class="fill" style="width: {isDragging && $spotifyState ? Math.min(dragPercentage * 100, 100) : Math.min(($spotifyState.positionSec / Math.max($spotifyState.durationSec, 1)) * 100, 100)}%;"></div>
            </div>
            <span class="time">{formatTime($spotifyState.durationSec)}</span>
        </div>

        {#if $spotifyState.isPlaying}
            <MaterialButton variant="outlined" on:click={fadePause} style="padding: 4px 8px;margin-top: 5px;background: none;" title="media.fade_out" disabled={$spotifyIsFading}>
                <!-- <Icon id="volume_down" white /> -->
                <Icon id="clear" white />
                <p><T id="media.fade_out" /></p>
            </MaterialButton>
        {/if}
    </div>
{/if}

<style>
    .spotify-controller {
        margin: 5px;
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        background: var(--bg-1, #1e1e1e);
        background-image: linear-gradient(180deg, var(--dynamic-bg, transparent) 0%, transparent 100%);
        border: 1px solid var(--border-1, #333);
        border-radius: 8px;
        padding: 9px 15px;
        color: var(--text-1, #fff);
        box-sizing: border-box;
        user-select: none;
        -webkit-user-drag: none;
        transition:
            background-image 0.5s ease,
            opacity 0.3s ease;
    }

    .spotify-controller.fading {
        opacity: 0.8;
    }

    .spotify-controller.fading :not(.fade-btn) {
        pointer-events: none;
    }

    .header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 6px;
        width: 100%;
    }

    .album-art {
        width: 48px;
        height: 48px;
        border-radius: 4px;
        object-fit: cover;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    }

    .info {
        text-align: left;
        flex: 1;
        overflow: hidden;
    }

    .title {
        font-weight: 600;
        font-size: 14px;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
    }

    .artist {
        font-size: 12px;
        color: var(--text-2, #aaa);
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
        margin-top: 2px;
    }

    .controls {
        display: flex;
        align-items: center;
        justify-content: space-evenly;

        width: 100%;
        margin-bottom: 2px;
    }

    .progress {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        font-size: 11px;
        color: var(--text-2, #aaa);
        font-variant-numeric: tabular-nums;
    }

    .progress.disabled {
        opacity: 0.5;
        pointer-events: none;
    }

    .bar {
        flex: 1;
        height: 4px;
        background: var(--bg-3, #333);
        border-radius: 2px;
        overflow: hidden;
        position: relative;
        cursor: pointer;
    }

    .bar:hover {
        height: 6px;
        margin: -1px 0;
    }

    .fill {
        height: 100%;
        background: #1db954; /* Spotify green */
        border-radius: 2px;
    }
</style>
