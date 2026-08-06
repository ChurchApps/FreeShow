<script lang="ts">
    import Player from "@vimeo/player"
    import { createEventDispatcher, onDestroy } from "svelte"
    import { currentWindow, focusMode, theme, themes } from "../../../stores"

    export let videoData = { paused: false, muted: true, loop: false, duration: 0 }
    export let videoTime = 0
    export let actualVideoTime = 0
    export let id
    // export let outputId
    export let preview

    // export let startAt = 0

    let shouldBeMuted = preview || $currentWindow !== "output" ? true : !!videoData.muted
    $: if (videoData) shouldBeMuted = preview || $currentWindow !== "output" ? true : !!videoData.muted

    const options = {
        autoplay: true,
        autopause: false,
        loop: videoData.loop,
        muted: shouldBeMuted,
        color: $themes[$theme]?.colors?.secondary || "#ffffff",
        controls: false
        // title: false,
        // byline: false,
    }

    let dispatch = createEventDispatcher()
    let iframe: HTMLIFrameElement | null = null
    let player: Player | null = null
    let loaded = false
    let paused = true
    let time = 0
    function iframeLoaded() {
        if (!iframe) return

        player = new Player(iframe, options)
        player.on("error", (err) => console.warn("Vimeo player error event:", err))
        player.setColor(options.color).catch((err) => console.warn("Vimeo setColor error:", err))

        if (shouldBeMuted) {
            player.setMuted(true).catch((err) => console.warn("Vimeo setMuted error:", err))
        }

        loaded = true

        videoData.paused = $focusMode
        seekTo(videoTime)
        dispatch("loaded", true)

        player.on("play", () => {
            paused = false
            isPlayPending = false
        })
        player.on("pause", () => {
            paused = true
            isPlayPending = false
        })
        player.on("durationchange", ({ duration }) => (videoData.duration = duration))
        player.on("timeupdate", ({ seconds }) => {
            time = seconds
            videoTime = seconds
        })
    }

    $: if (loaded) updateTime()
    let timeInterval: NodeJS.Timeout | null = null
    function updateTime() {
        // if (!preview) return
        if (timeInterval) clearInterval(timeInterval)
        timeInterval = setInterval(async () => {
            if (player) actualVideoTime = await player.getCurrentTime()
        }, 500)
    }
    onDestroy(() => {
        if (timeInterval) clearInterval(timeInterval)
    })

    let isPlayPending = false
    let currentMuteState: boolean | null = null
    $: if (player && loaded && !seeking) {
        if (videoData.paused && (!paused || isPlayPending)) {
            isPlayPending = false
            player.pause().catch((err) => console.warn("Vimeo pause error:", err))
        } else if (!videoData.paused && paused && !isPlayPending) {
            isPlayPending = true
            player
                .play()
                .catch((err) => {
                    console.warn("Vimeo play error:", err)
                    isPlayPending = false
                })
        }

        if (currentMuteState !== shouldBeMuted) {
            currentMuteState = shouldBeMuted
            player.setMuted(shouldBeMuted).catch((err) => console.warn("Vimeo setMuted error:", err))
        }
    }

    $: if (!id && player) player.unload().catch((err) => console.warn("Vimeo unload error:", err))

    $: if (loaded && !seeking && videoTime !== undefined) seekPlayer()
    function seekPlayer() {
        if (!player || !loaded || (preview && !paused) || Math.abs(time - videoTime) < 1.0) return

        seekTo(videoTime)
    }

    let seeking = false
    let pendingSeekTime: number | null = null

    function timeoutPromise(ms: number) {
        return new Promise<void>((resolve) => setTimeout(resolve, ms))
    }

    async function seekTo(targetTime: number) {
        if (!player) return

        if (seeking) {
            pendingSeekTime = targetTime
            return
        }

        let isPlaying = !videoData.paused
        videoData.paused = true
        seeking = true
        pendingSeekTime = null

        try {
            if (targetTime > 0) {
                await Promise.race([
                    player.setCurrentTime(targetTime),
                    timeoutPromise(500)
                ])
            }
        } catch (err) {
            console.warn("Vimeo setCurrentTime error:", err)
        } finally {
            if (isPlaying) videoData.paused = false
            seeking = false

            if (pendingSeekTime !== null && pendingSeekTime !== targetTime) {
                const nextSeek = pendingSeekTime
                pendingSeekTime = null
                seekTo(nextSeek)
            }
        }
    }

    // function change() {
    //     if (!loaded && !seeking) return

    //     videoData.paused = paused

    //     if (!preview || !player) return

    //     player
    //         .getCurrentTime()
    //         .then((seconds) => {
    //             videoTime = seconds
    //         })
    //         .catch((err) => console.warn("Vimeo getCurrentTime error:", err))
    // }

    // $: mainVol = $audioChannelsData.main?.isMuted ? 0 : ($audioChannelsData.main?.volume ?? 1)
    // $: if (!shouldBeMuted && mainVol !== undefined) updateVolume()
    // function updateVolume() {
    //     if (!player) return
    //     player.setVolume(mainVol).catch((err) => console.warn("Vimeo setVolume error:", err))
    // }
</script>

<div class="main" class:hide={!id}>
    {#if id}
        <!-- TODO: looping vimeo video will reload the video -->
        <iframe bind:this={iframe} on:load={iframeLoaded} data-vimeo-title="0" data-vimeo-autopause="0" data-vimeo-dnt="0" allow="autoplay;" {id} title="video" src="https://player.vimeo.com/video/{id}?autopause=0&controls=0&loop={videoData.loop}" width="640" height="360" />
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
        border: none;
    }

    .hide :global(.yt) {
        display: none;
    }
</style>
