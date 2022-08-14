<script>
  import Player from "@vimeo/player"
  import { currentWindow, theme, themes } from "../../../stores"

  export let videoData = { paused: false, muted: true, loop: false, duration: 0 }
  export let videoTime = 0
  export let id
  export let preview

  export let title
  export let startAt = 0

  // $: id = id.includes("=") ? id.slice(id.lastIndexOf("=") + 1, id.length) : id
  // $: id = id.length === 11 ? id : ""
  // $: console.log(id)

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

  $: console.log(options)
  $: console.log(videoData)

  let iframe = null
  let player = null
  let loaded = false
  let paused = true
  let time = 0
  function iframeLoaded() {
    player = new Player(iframe, options)
    player.setColor(options.color)

    // console.log(player)

    if (videoData.muted || (!preview && $currentWindow !== "output")) player.setMuted(true)
    // videoData.paused = false
    videoTime = startAt
    // player.hideVideoInfo()
    // player.setOption("captions", "fontSize", -1)
    setTimeout(() => {
      // TODO: output update startAt
      videoData.paused = true
      player.setCurrentTime(videoTime)
      player.getVideoTitle().then((t) => {
        title = t
      })
      // console.log(player.getVideoData(), title)
      // console.log(player.playerInfo.videoData) // title | author
      setTimeout(() => {
        videoData.paused = false
        loaded = true
        // if (!$outputWindow) window.api.send(OUTPUT, { channel: "VIDEO_TIME", data: videoTime })
      }, 100)
    }, 500)

    player.on("play", () => (paused = false))
    player.on("pause", () => (paused = true))
    player.on("durationchange", ({ duration }) => (videoData.duration = duration))
    player.on("timeupdate", ({ seconds }) => {
      time = seconds
      videoTime = seconds
    })
    player.on("seeked", () => change)
  }

  // setInterval(() => {
  //   if (!$currentWindow && loaded && !paused) {
  //     player.getCurrentTime((time) => (videoTime = time))
  //   }
  //   // else player.seekTo(videoTime)
  // }, 500)
  // $: console.log(player?.getCurrentTime(), videoTime)
  $: if (player && paused && time !== videoTime) player.setCurrentTime(videoTime)

  $: {
    if (player && loaded) {
      if (videoData.paused) player.pause()
      else player.play()
      if (videoData.muted) player.setMuted(true)
      else if ($currentWindow === "output" || preview) player.setMuted(false)
      // player.setLoop(videoData.loop)
    }
  }

  $: if (!id && player) player.unload()

  // $: if ($outputWindow && player && videoData.paused) player.seekTo(videoTime)

  function change() {
    if ($currentWindow) return

    if (loaded) {
      videoData.paused = paused
      player.getCurrentTime((time) => (videoTime = time.duration))
    }
  }

  // $: if (videoTime) player.seekTo()
</script>

<div class="main" class:hide={!id}>
  <!-- https://www.youtube.com/watch?v=rfxnmIPCzIc -->
  {#if id}
    <!-- <YouTube class="yt" videoId={id} {options} on:ready={onReady} on:stateChange={change} /> -->
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
    <!-- <p><a href="https://vimeo.com/426363743">Jesus, Only Jesus</a> from <a href="https://vimeo.com/ridgecrestbaptist">Ridgecrest Baptist Church</a> on <a href="https://vimeo.com">Vimeo</a>.</p> -->
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
