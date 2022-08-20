<script lang="ts">
  import { OUTPUT } from "../../../types/Channels"
  import type { Transition } from "../../../types/Show"
  import { audioChannels, mediaFolders, playingVideos, videoExtensions, volume } from "../../stores"
  import { send } from "../../utils/request"
  import { custom } from "../../utils/transitions"
  import { analyseAudio, getAnalyser } from "../helpers/audio"
  import { getStyleResolution } from "../slide/getStyleResolution"
  import Player from "../system/Player.svelte"
  import Camera from "./Camera.svelte"
  import Window from "./Window.svelte"

  export let background: any = {}
  export let outputId: string
  export let transition: Transition
  export let path: string = ""
  export let id: string = ""
  export let name: string = ""
  export let type: string = "media"
  export let startAt: number = 0

  export let video: any
  export let videoData: any
  export let videoTime: any
  export let title: string
  export let mirror: boolean = false

  $: if (type === "video" || type === "image" || type === undefined) type = "media"
  $: if (type === "media" && !path?.length && $mediaFolders[id]?.path && name) {
    // TODO: what's this for?
    let seperator = "/"
    if ($mediaFolders[id].path?.includes("\\")) seperator = "\\"
    path = $mediaFolders[id].path + seperator + name || ""
  }
  // $: extension = path?.match(/\.[0-9a-z]+$/i)?.[0]! || ""
  // $: isVideo = extension ? $videoExtensions.includes(extension.substring(1)) : false
  $: extension = path ? path.substring(path.lastIndexOf(".") + 1) : ""
  $: isVideo = extension ? $videoExtensions.includes(extension) : false

  // $: if ($outputWindow && !videoData.muted) videoData.muted = $outputWindow
  let alt = "Could not find image!"

  // $: outputId = getActiveOutputs($outputs)[0]
  // $: currentOutput = $outputs[outputId]
  // $: background = currentOutput.out?.background || {}

  // let background = {}
  // let prevBackground = {}
  // $: if (JSON.stringify(background) !== JSON.stringify(currentOutput.out?.background || {})) {
  //   background = currentOutput.out?.background || {}
  // }

  let width: number = 0
  let height: number = 0
  let filter: string = ""
  let flipped: boolean = false

  let hasLoaded: boolean = false
  let autoMute: boolean = false
  function loaded() {
    // if ($currentWindow) return
    hasLoaded = true

    if (background.loop !== undefined) videoData.loop = background.loop
    // if (background.filter !== undefined) filter = background.filter

    if (mirror) {
      // request data
      send(OUTPUT, ["REQUEST_VIDEO_DATA"], outputId)
    } else {
      if (background.muted !== undefined) videoData.muted = background.muted
      // videoData.muted = false

      if (!videoData.muted) autoMute = videoData.muted = true
    }
  }

  function playing() {
    // if (!hasLoaded || $currentWindow) return
    if (!hasLoaded || mirror) return
    hasLoaded = false
    console.log("PLAYING")

    videoData.paused = true
    setTimeout(() => {
      videoTime = startAt || 0
      send(OUTPUT, ["MAIN_VIDEO"], { id: outputId, time: videoTime })
      setTimeout(() => send(OUTPUT, ["MAIN_VIDEO"], { id: outputId, data: videoData, time: videoTime }), 100)

      // TODO: draw get time
      // sendCurrentTime()

      if (autoMute) {
        autoMute = false
        videoData.muted = false
      }

      videoData.paused = false
      startAt = 0
    }, 50)
  }

  // let timeout: any = null
  // function sendCurrentTime() {
  //   if (timeout) clearTimeout()
  //   timeout = setTimeout(() => {
  //     if (!videoData.paused) send(OUTPUT, ["MAIN_VIDEO_TIME"], videoTime)
  //     sendCurrentTime()
  //   }, 1000)
  // }

  $: console.log(mirror, videoData.muted)

  function updateFilter() {
    let temp: any = { ...background }
    filter = ""
    filter = temp.filter
    flipped = temp.flipped
  }

  $: if (background !== null) updateFilter()
  $: if (type === "video") setUpdater()
  // let bg: any = null
  let oldFilter: string = ""
  setUpdater()
  function setUpdater() {
    if (oldFilter === filter) videoTime = 0
    else oldFilter = filter
  }

  // only output window
  let currentAnalysedElem: any = null
  let currentAnalyser: any = null
  async function analyseVideo() {
    // if ($playingVideos[0]?.video === video) return
    // Failed to execute 'createMediaElementSource' on 'AudioContext': HTMLMediaElement already connected previously to a different MediaElementSourceNode.
    if (currentAnalysedElem !== video) {
      currentAnalyser = await getAnalyser(video)
      currentAnalysedElem = video
    }
    playingVideos.set([{ analyser: currentAnalyser }])
    analyseAudio()
  }

  $: if (!mirror && $audioChannels) send(OUTPUT, ["AUDIO_MAIN"], { id: path, channels: $audioChannels })
  $: if (!mirror && (video === null || videoData.paused === true)) playingVideos.set([])
  $: if (!mirror && video !== null && videoData.paused === false) analyseVideo()
</script>

<!-- TODO: display image stretch / scale -->
{#if type === "media"}
  {#if isVideo}
    <div transition:custom={transition} bind:clientWidth={width} bind:clientHeight={height}>
      <video
        class="media"
        style="{getStyleResolution({ width: video?.videoWidth || 0, height: video?.videoHeight || 0 }, width, height, 'cover')};filter: {filter};{flipped
          ? 'transform: scaleX(-1);'
          : ''}"
        bind:this={video}
        on:loadedmetadata={loaded}
        on:playing={playing}
        bind:currentTime={videoTime}
        bind:paused={videoData.paused}
        bind:duration={videoData.duration}
        bind:volume={$volume}
        muted={mirror ? true : videoData.muted}
        src={path}
        autoplay
        loop={videoData.loop || false}
      >
        <track kind="captions" />
      </video>
    </div>
  {:else}
    {#key path}
      <div transition:custom={transition}>
        <!-- style={getStyleResolution({ width: image?.naturalWidth || 0, height: image?.naturalHeight || 0 }, width, height, "cover")} -->
        <img class="media" style="object-fit: contain;width: 100%;height: 100%;filter: {filter};{flipped ? 'transform: scaleX(-1);' : ''}" src={path} {alt} draggable="false" />
      </div>
    {/key}
  {/if}
{:else if type === "screen"}
  {#key id}
    <div transition:custom={transition} bind:clientWidth={width} bind:clientHeight={height}>
      <Window {id} class="media" style="{getStyleResolution({ width: video?.videoWidth || 0, height: video?.videoHeight || 0 }, width, height, 'cover')};" />
    </div>
  {/key}
{:else if type === "camera"}
  {#key id}
    <div transition:custom={transition} bind:clientWidth={width} bind:clientHeight={height}>
      <Camera {id} class="media" style="{getStyleResolution({ width: video?.videoWidth || 0, height: video?.videoHeight || 0 }, width, height, 'cover')};" bind:videoElem={video} />
    </div>
  {/key}
{:else if type === "player"}
  {#key id}
    <div transition:custom={transition}>
      <!-- remove when finished -->
      <!-- TODO: this has to be disabled to get rid of ads! -->
      <!-- {#if mirror} -->
      <div class="overlay" />
      <!-- {/if} -->
      <Player {id} bind:videoData bind:videoTime bind:title {startAt} />
    </div>
  {/key}
{/if}

<style>
  /* hide alt text */
  img {
    text-indent: 100%;
    white-space: nowrap;
    overflow: hidden;
  }

  div {
    /* position: relative; */
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  div :global(.media) {
    max-width: 100%;
    max-height: 100%;
  }

  .overlay {
    position: absolute;
    width: 100%;
    height: 100%;
    background-color: transparent;
    z-index: 1;
  }
</style>
