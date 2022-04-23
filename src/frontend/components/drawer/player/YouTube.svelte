<script>
  import YouTube from "svelte-youtube"
  import { OUTPUT } from "../../../../types/Channels"
  import { currentWindow } from "../../../stores"

  export let videoData = { paused: false, muted: true, loop: false, duration: 0 }
  export let videoTime = 0
  export let id
  export let preview

  export let title
  export let startAt = 0

  $: id = id.includes("=") ? id.slice(id.lastIndexOf("=") + 1, id.length) : id
  $: id = id.length === 11 ? id : ""

  const options = {
    // height: "390",
    // width: "640",
    //  see https://developers.google.com/youtube/player_parameters
    playerVars: {
      autoplay: 1,
      loop: videoData.loop,
      fs: 0,
      rel: 0,
      controls: 0,
      // cc_load_policy: true
    },
  }

  let player = null
  let loaded = false
  function onReady(e) {
    // access to player in all event handlers via event.target
    // console.log(e, video)
    // console.log("READY")
    // console.log(e.detail.target)
    player = e.detail.target
    if (videoData.muted || (!preview && $currentWindow !== "output")) player.mute()
    // videoData.paused = false
    videoData.duration = player.getDuration()
    videoTime = startAt
    // player.hideVideoInfo()
    // player.setOption("captions", "fontSize", -1)
    setTimeout(() => {
      // TODO: output update startAt
      videoData.paused = true
      player.seekTo(videoTime)
      title = player.getVideoData().title
      // console.log(player.getVideoData(), title)
      // console.log(player.playerInfo.videoData) // title | author
      setTimeout(() => {
        videoData.paused = false
        loaded = true
        // if (!$outputWindow) window.api.send(OUTPUT, { channel: "VIDEO_TIME", data: videoTime })
      }, 300)
    }, 500)
  }

  setInterval(() => {
    if (!$currentWindow && loaded && player.getPlayerState() === 1) videoTime = player.getCurrentTime()
    // else player.seekTo(videoTime)
  }, 500)
  // $: console.log(player?.getCurrentTime(), videoTime)
  $: if (player && player.getPlayerState() === 2 && player.getCurrentTime() !== videoTime) player.seekTo(videoTime)

  $: {
    if (player && loaded) {
      if (videoData.paused) player.pauseVideo()
      else player.playVideo()
      if (videoData.muted) player.mute()
      else if ($currentWindow === "output" || preview) player.unMute()
      // player.setLoop(videoData.loop)
    }
  }

  $: if (!id && player) player.stopVideo()

  // $: if ($outputWindow && player && videoData.paused) player.seekTo(videoTime)

  let loopStop = false
  function change(e) {
    // ended (0), playing (1), paused (2), video cued (5) or unstarted (-1).
    if ($currentWindow || loopStop) return
    loopStop = true

    if (loaded) {
      videoData.paused = player.getPlayerState() === 1 ? false : true
      videoTime = player.getCurrentTime()
    }
    videoData.duration = player.getDuration()

    setTimeout(() => (loopStop = false), 50)
  }

  // $: if (videoTime) player.seekTo()
</script>

<div class="main" class:hide={!id}>
  <!-- https://www.youtube.com/watch?v=rfxnmIPCzIc -->
  {#if id}
    <YouTube class="yt" videoId={id} {options} on:ready={onReady} on:stateChange={change} />
    <!-- {:else}
    [[[Type video url/id into search area!]]] -->
    <!-- {:else}
    <YouTube class="yt" videoId={id} {options} on:ready={onReady} /> -->
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
