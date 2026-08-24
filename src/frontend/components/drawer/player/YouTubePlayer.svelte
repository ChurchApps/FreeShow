<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import YoutubePlayer from "youtube-player"

    export let videoId: string
    export let options: any = {}

    let playerElem: HTMLDivElement | undefined
    let player // YT player API instance

    onMount(() => createPlayer())

    let currentPlayingId = ""
    // load new video if URL changes
    $: if (player && videoId && videoId !== currentPlayingId) play(videoId)

    function createPlayer() {
        currentPlayingId = videoId
        player = YoutubePlayer(playerElem, { ...options, videoId })

        // EVENTS
        player.on("ready", onPlayerReady)
        player.on("error", onPlayerError)
        player.on("stateChange", onPlayerStateChange)
        // player.on("playbackRateChange", onPlayerPlaybackRateChange)
        // player.on("playbackQualityChange", onPlayerPlaybackQualityChange)

        // destroy on unmount
        return () => player.destroy()
    }

    function play(id: string) {
        if (!player || !id) return
        currentPlayingId = id

        // the loadVideoById function always starts playing, even if autoplay is set to 1, causing cueVideoById to never start autoplaying
        if (options?.playerVars?.autoplay === 1) player.loadVideoById(id)
        else player.cueVideoById(id)
    }

    /// EVENT HANDLING ///
    const dispatch = createEventDispatcher()

    // https://developers.google.com/youtube/iframe_api_reference#onReady
    function onPlayerReady(e) {
        dispatch("ready", e)
    }

    // https://developers.google.com/youtube/iframe_api_reference#onError
    function onPlayerError(e) {
        dispatch("error", e)
    }

    // https://developers.google.com/youtube/iframe_api_reference#onStateChange
    const PlayerState = {
        UNSTARTED: -1,
        ENDED: 0,
        PLAYING: 1,
        PAUSED: 2,
        BUFFERING: 3,
        CUED: 5
    }
    function onPlayerStateChange(e) {
        dispatch("stateChange", e)

        switch (e.data) {
            case PlayerState.ENDED:
                dispatch("end", e)
                break

            case PlayerState.PLAYING:
                dispatch("play", e)
                break

            case PlayerState.PAUSED:
                dispatch("pause", e)
                break

            default:
        }
    }

    // // https://developers.google.com/youtube/iframe_api_reference#onPlaybackRateChange
    // function onPlayerPlaybackRateChange(e) {
    //     dispatch("playbackRateChange", e)
    // }

    // // https://developers.google.com/youtube/iframe_api_reference#onPlaybackQualityChange
    // function onPlayerPlaybackQualityChange(e) {
    //     dispatch("playbackQualityChange", e)
    // }
</script>

<div class={$$props.class}>
    <div bind:this={playerElem}></div>
</div>
