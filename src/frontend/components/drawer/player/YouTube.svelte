<script>
    import { createEventDispatcher, onDestroy } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import { currentWindow, focusMode, playerVideos, special, volume } from "../../../stores"
    import { send } from "../../../utils/request"
    import YouTubePlayer from "./YouTubePlayer.svelte"

    export let videoData = { paused: false, muted: true, loop: false, duration: 0 }
    export let videoTime = 0
    export let playerId
    export let id
    export let outputId
    export let preview

    export let title
    export let startAt = 0

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
    let player = null
    let loaded = false
    let getDurationInterval = null
    function onReady(e) {
        player = e.detail.target

        if (videoData.muted || (!preview && $currentWindow !== "output")) player.mute()

        // get duration
        getDurationInterval = setInterval(() => {
            videoData.duration = player.getDuration()
            if (videoData.duration) clearInterval(getDurationInterval)
        }, 200)

        videoTime = startAt

        // WIP captions ?
        // player.setOption("captions", "fontSize", -1)

        // set name
        if (!$currentWindow) {
            // WIP this only works in preview now
            setTimeout(() => {
                let data = player.getVideoData()
                if (!data) return
                // console.log(player.playerInfo.videoData) // title | author
                title = data.title
                let noName = !$playerVideos[playerId].name || $playerVideos[playerId].name.includes($playerVideos[playerId].id)
                if (title && noName) {
                    playerVideos.update(a => {
                        a[playerId].name = title
                        return a
                    })
                }
            }, 2000)
        }

        loaded = true

        videoData.paused = $focusMode
        // if live, it should not start from the beginning
        if (videoTime > 0) seekTo(videoTime)
        else
            setTimeout(() => {
                videoTime = player.getCurrentTime()
                // player.getDuration()
            }, 3000)

        dispatch("loaded", true)
    }

    $: if (loaded) updateTime()
    let timeInterval = null
    function updateTime() {
        if (!preview) return

        if (timeInterval) clearInterval(timeInterval)
        timeInterval = setInterval(() => {
            if (player.getPlayerState() === 1) videoTime = player.getCurrentTime()
        }, 500)
    }

    onDestroy(() => {
        if (timeInterval) clearInterval(timeInterval)
        if (getDurationInterval) clearInterval(getDurationInterval)
    })

    $: if (!seeking && videoTime !== undefined) seekPlayer()
    function seekPlayer() {
        if (!player || !loaded || (preview && !videoData.paused) || player.getCurrentTime() === videoTime) return

        seekTo(videoTime)
    }

    let seeking = false
    function seekTo(time) {
        seeking = true

        player.pauseVideo()
        player.seekTo(time)

        setTimeout(() => {
            if (!player.g) return

            if (!videoData.paused) player.playVideo()
            seeking = false

            if (outputId) send(OUTPUT, ["MAIN_TIME"], { [outputId]: time })
        }, 500)
    }

    let updating = false
    $: if (player && loaded && !seeking && videoData) updateVideo()
    function updateVideo() {
        updating = true

        if (videoData.paused) player.pauseVideo()
        else player.playVideo()

        if (videoData.muted) player.mute()
        else if ($currentWindow === "output" || preview) player.unMute()

        // player.setLoop(videoData.loop)

        setTimeout(() => {
            updating = false
        }, 500)
    }

    $: if (!id && player) player.stopVideo()

    // $: if ($outputWindow && player && videoData.paused) player.seekTo(videoTime)

    let loopStop = false
    function change() {
        if (loopStop || !loaded || updating || seeking) return

        loopStop = true
        setTimeout(() => (loopStop = false), 50)

        // unstarted (-1), ended (0), playing (1), paused (2), buffering (3), cued (5)
        videoData.paused = player.getPlayerState() === 1 ? false : true
        if (preview) videoTime = player.getCurrentTime()
    }

    function ended() {
        dispatch("ended", true)
    }

    // update volume based on global slider value
    $: if (!preview && $volume !== undefined && player) updateVolume()
    function updateVolume() {
        player.setVolume($volume * 100)
    }
</script>

<div class="main" class:hide={!id}>
    {#if id}
        <!-- {#if $currentWindow === "output"} -->
        <YouTubePlayer class="yt" videoId={id} {options} on:ready={onReady} on:end={ended} on:stateChange={change} />
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
