<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte"
    import { currentWindow, focusMode, special } from "../../../stores"
    import YouTubePlayer from "./YouTubePlayer.svelte"

    export let videoData = { paused: false, muted: true, loop: false, duration: 0 }
    export let videoTime = 0
    export let actualVideoTime = 0
    export let id
    // export let outputId
    export let preview

    // export let startAt = 0

    // <= 0.5.4
    $: id = id.includes("?list") ? id.slice(0, id.indexOf("?list")) : id
    $: id = id.slice(-11)

    // https://developers.google.com/youtube/player_parameters
    const options = {
        playerVars: {
            autoplay: 1,
            loop: videoData.loop,
            fs: 0,
            rel: 0,
            controls: $special.hideCursor ? 0 : 1
            // enablejsapi: 1
            // cc_load_policy: true
        }
    }

    let dispatch = createEventDispatcher()
    let player: any | null = null
    let loaded = false
    function onReady(e) {
        player = e.detail.target

        // if (videoData.muted || (!preview && $currentWindow !== "output")) player.mute()

        loaded = true

        videoData.paused = $focusMode

        dispatch("loaded", true)
    }

    $: if (loaded) updateTime()
    let timeInterval: NodeJS.Timeout | null = null
    function updateTime() {
        // if (!preview) return
        if (timeInterval) clearInterval(timeInterval)
        timeInterval = setInterval(() => {
            if (player.getPlayerState() === 1) actualVideoTime = player.getCurrentTime()
        }, 500)
    }
    onDestroy(() => {
        if (timeInterval) clearInterval(timeInterval)
    })

    let seeking = false
    $: if (!seeking && videoTime !== undefined) seekPlayer()
    function seekPlayer() {
        if (!player || !loaded || player.getCurrentTime() === videoTime) return

        seeking = true

        if (!videoData.paused) player.pauseVideo()
        player.seekTo(videoTime)

        setTimeout(() => {
            if (!player.g) return

            if (!videoData.paused) player.playVideo()
            seeking = false
        }, 500)
    }

    // pause/play state
    $: if (player && loaded && !seeking && videoData.paused !== undefined) {
        if (videoData.paused) player.pauseVideo()
        else player.playVideo()
    }

    // mute state
    $: shouldBeMuted = preview || $currentWindow !== "output" ? true : !!videoData.muted
    $: if (player && loaded && shouldBeMuted !== undefined) {
        if (shouldBeMuted) {
            if (!player.isMuted()) player.mute()
        } else if ($currentWindow === "output" || preview) {
            player.unMute()
        }
    }

    $: if (!id && player) player.stopVideo()

    // WIP update frontend state if changing output values directly?

    // $: if ($outputWindow && player && videoData.paused) player.seekTo(videoTime)

    // let loopStop = false
    // function change() {
    //     if (loopStop || !loaded || updating || seeking) return

    //     loopStop = true
    //     setTimeout(() => (loopStop = false), 50)

    //     // unstarted (-1), ended (0), playing (1), paused (2), buffering (3), cued (5)
    //     videoData.paused = player.getPlayerState() === 1 ? false : true
    //     if (preview) videoTime = player.getCurrentTime()
    // }

    function ended() {
        dispatch("ended", true)
    }

    // WIP main volume channel should control player videos even though it's not connected at the moment ?
    // $: mainVol = $audioChannelsData.main?.isMuted ? 0 : ($audioChannelsData.main?.volume ?? 1)
    // $: if (!shouldBeMuted && mainVol !== undefined) updateVolume()
    // function updateVolume() {
    //     if (!player) return
    //     player.setVolume(mainVol * 100)
    // }
</script>

<div class="main" class:hide={!id}>
    {#if id}
        <!-- {#if $currentWindow === "output"} -->
        <!-- on:stateChange={change} -->
        <YouTubePlayer class="yt" videoId={id} {options} on:ready={onReady} on:end={ended} />
        <!-- {:else}
            <div style="width: 100%;height: 100%;display: flex;align-items: center;justify-content: center;">
                <Icon id="youtube" size={6} white />
            </div>
        {/if} -->
    {/if}
</div>

<style>
    .main {
        pointer-events: initial;
    }

    .main,
    .main :global(.yt),
    .main :global(iframe) {
        height: 100%;
        width: 100%;
    }

    .hide :global(.yt) {
        display: none;
    }
</style>
