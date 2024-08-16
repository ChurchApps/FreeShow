<script>
    import Player from "@vimeo/player"
    import { currentWindow, theme, themes, volume } from "../../../stores"
    import { OUTPUT } from "../../../../types/Channels"
    import { createEventDispatcher } from "svelte"
    import { send } from "../../../utils/request"

    export let videoData = { paused: false, muted: true, loop: false, duration: 0 }
    export let videoTime = 0
    export let id
    export let outputId
    export let preview

    export let title
    export let startAt = 0

    const options = {
        autoplay: true,
        autopause: false,
        loop: videoData.loop,
        muted: videoData.muted,
        color: $themes[$theme]?.colors?.secondary,
        controls: false,
        // title: false,
        // byline: false,
    }

    let dispatch = createEventDispatcher()
    let iframe = null
    let player = null
    let loaded = false
    let paused = true
    let time = 0
    function iframeLoaded() {
        player = new Player(iframe, options)
        player.setColor(options.color)

        if (videoData.muted || (!preview && $currentWindow !== "output")) player.setMuted(true)

        videoTime = startAt
        // WIP captions...

        setTimeout(() => {
            player.getVideoTitle().then((t) => {
                title = t
            })
        }, 1000)

        loaded = true

        videoData.paused = false
        seekTo(videoTime)
        dispatch("loaded", true)

        player.on("play", () => (paused = false))
        player.on("pause", () => (paused = true))
        player.on("durationchange", ({ duration }) => (videoData.duration = duration))
        player.on("timeupdate", ({ seconds }) => {
            time = seconds
            videoTime = seconds
        })
        player.on("seeked", () => change)
    }

    $: if (player && loaded && !seeking) {
        if (videoData.paused) player.pause()
        else player.play()

        if (videoData.muted) player.setMuted(true)
        else if ($currentWindow === "output" || preview) player.setMuted(false)

        // player.setLoop(videoData.loop)
    }

    $: if (!id && player) player.unload()

    $: if (!seeking && videoTime !== undefined) seekPlayer()
    function seekPlayer() {
        if (!player || (preview && !paused) || time === videoTime) return

        seekTo(videoTime)
    }

    let seeking = false
    function seekTo(time) {
        let isPlaying = !videoData.paused
        videoData.paused = true
        seeking = true
        setTimeout(() => {
            player.setCurrentTime(videoTime)

            setTimeout(() => {
                if (isPlaying) videoData.paused = false
                seeking = false

                if (outputId) send(OUTPUT, ["MAIN_TIME"], { [outputId]: videoTime })
            }, 800)
        }, 100)
    }

    function change() {
        if (!loaded && !seeking) return

        videoData.paused = paused
        if (preview) player.getCurrentTime((time) => (videoTime = time.duration))
    }

    // update volume based on global slider value
    $: if (!preview && $volume !== undefined && player) updateVolume()
    function updateVolume() {
        player.setVolume($volume)
    }
</script>

<div class="main" class:hide={!id}>
    {#if id}
        <!-- TODO: looping vimeo video will reload the video -->
        <iframe
            bind:this={iframe}
            on:load={iframeLoaded}
            data-vimeo-title="0"
            data-vimeo-autopause="0"
            data-vimeo-dnt="0"
            allow="autopause;"
            {id}
            title="video"
            src="https://player.vimeo.com/video/{id}?autopause=0&controls=0&loop={videoData.loop}"
            width="640"
            height="360"
            frameborder="0"
        />
    {/if}
</div>

<style>
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
